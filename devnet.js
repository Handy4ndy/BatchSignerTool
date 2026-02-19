// devnet.js - Devnet Demo Mode Logic for BatchSigner Generator

const DEVNET_WS = 'wss://s.devnet.rippletest.net:51233';

// Helper: Log to status div
function logStatus(message, type = 'info') {
    const statusEl = document.getElementById('devnetStatus');
    if (!statusEl) return;

    const prefix = { info: 'ℹ️ ', success: '✅ ', error: '❌ ', step: '→ ' }[type] || '';
    const colorClass = type === 'success' ? 'text-green-400' : 
                      type === 'error' ? 'text-red-400' : 
                      type === 'step' ? 'text-teal-400' : 'text-gray-400';

    statusEl.innerHTML += `<div class="${colorClass}">${prefix}${message}</div>`;
    statusEl.scrollTop = statusEl.scrollHeight;
}

// Main demo
async function runDevnetDemo() {
    logStatus('Starting Devnet Demo Mode...', 'step');

    let client;
    // Helper to show Devnet result view
    function showDevnetResultView(hash) {
        const devnetResultView = document.getElementById('devnetResultView');
        const devnetHash = document.getElementById('devnetHash');
        const devnetExplorerLink = document.getElementById('devnetExplorerLink');
        const copyBtn = document.getElementById('copyDevnetResultBtn');
        if (devnetResultView && devnetHash && devnetExplorerLink) {
            devnetResultView.classList.remove('hidden');
            devnetHash.textContent = hash;
            devnetExplorerLink.href = `https://devnet.xrpl.org/transactions/${hash}`;
            // Make the link more visible
            devnetExplorerLink.style.fontSize = '1.15rem';
            devnetExplorerLink.style.fontWeight = 'bold';
            devnetExplorerLink.style.color = '#1de9b6';
            devnetExplorerLink.style.background = 'rgba(0,255,200,0.08)';
            devnetExplorerLink.style.padding = '4px 10px';
            devnetExplorerLink.style.borderRadius = '6px';
            devnetExplorerLink.style.display = 'inline-block';
            devnetExplorerLink.style.margin = '10px 0 0 0';
        }
        // Remove the copy button if present
        if (copyBtn) {
            copyBtn.parentNode.removeChild(copyBtn);
        }
    }
    try {
        logStatus('Connecting to XRPL Devnet...', 'step');
        client = new xrpl.Client(DEVNET_WS);
        await client.connect();
        logStatus('Connected.', 'success');

        const serverInfo = await client.request({ command: 'server_info' });
        logStatus(`rippled ${serverInfo.result.info.build_version}`, 'info');

        logStatus('Generating & funding 3 accounts...', 'step');
        const acc1 = await client.fundWallet();
        const acc2 = await client.fundWallet();
        const acc3 = await client.fundWallet();

        logStatus(`Acc1 (Submitter/Payer1): ${acc1.wallet.address}`, 'success');
        logStatus(`Acc2 (Signer/Payer2): ${acc2.wallet.address}`, 'success');
        logStatus(`Acc3 (Receiver): ${acc3.wallet.address}`, 'success');

        logStatus('Building Batch template...', 'step');
        const batchTemplate = {
            TransactionType: 'Batch',
            Account: acc1.wallet.address,
            Flags: 262144, // UNTILFAILURE
            RawTransactions: [
                {
                    RawTransaction: {
                        TransactionType: 'Payment',
                        Account: acc1.wallet.address,
                        Destination: acc3.wallet.address,
                        Amount: '1000000',
                        Fee: '0',
                        Flags: 1073741824
                    }
                },
                {
                    RawTransaction: {
                        TransactionType: 'Payment',
                        Account: acc2.wallet.address,
                        Destination: acc3.wallet.address,
                        Amount: '1000000',
                        Fee: '0',
                        Flags: 1073741824
                    }
                }
            ]
        };

        logStatus('Autofilling template...', 'step');
        let autofilled = await client.autofill(batchTemplate);
        logStatus('Autofill done.', 'success');

        // STEP: Increase Fee & LastLedgerSequence for reliability
        const currentLedger = await client.getLedgerIndex();
        autofilled.Fee = '100'; // Higher fee to avoid telINSUF_FEE_P
        autofilled.LastLedgerSequence = currentLedger + 60; // ~1-2 min buffer

        logStatus('Generating BatchSigner for Acc2...', 'step');
        const batchCopy = JSON.parse(JSON.stringify(autofilled));
        xrpl.signMultiBatch(acc2.wallet, batchCopy);

        if (!batchCopy.BatchSigners?.length) {
            throw new Error('No BatchSigner generated');
        }

        const signerEntry = batchCopy.BatchSigners[0].BatchSigner;
        const signersArray = [{ BatchSigner: signerEntry }];
        if (typeof batchSignersOutput !== 'undefined' && batchSignersOutput) {
            batchSignersOutput.textContent = JSON.stringify(signersArray, null, 2);
        }
        const fullBatch = { ...autofilled, BatchSigners: signersArray };
        if (typeof fullBatchOutput !== 'undefined' && fullBatchOutput) {
            fullBatchOutput.textContent = JSON.stringify(fullBatch, null, 2);
        }

        logStatus(`BatchSigner ready for ${acc2.wallet.address}`, 'success');

        logStatus('Signing outer tx (Acc1) & submitting...', 'step');
        const signedOuter = acc1.wallet.sign(fullBatch);

        let response;
        for (let attempt = 1; attempt <= 2; attempt++) {
            logStatus(`Submission attempt ${attempt}...`);
            response = await client.submitAndWait(signedOuter.tx_blob);

            if (response.result.meta.TransactionResult === 'tesSUCCESS') {
                logStatus('Success! Batch executed.', 'success');
                logStatus(`Hash: ${response.result.hash}`, 'success');
                logStatus(`Explorer: https://devnet.xrpl.org/transactions/${response.result.hash}`, 'success');
                // Show results section and devnet result view
                if (typeof resultSection !== 'undefined') {
                    resultSection.style.display = 'block';
                }
                showDevnetResultView(response.result.hash);
                break;
            } else if (response.result.meta.TransactionResult.includes('telLAST_LEDGER_SEQUENCE')) {
                logStatus('Ledger expired - retrying with higher fee...', 'warning');
                autofilled.Fee = '200';
                const newSigned = acc1.wallet.sign(autofilled);
                signedOuter.tx_blob = newSigned.tx_blob; // update blob
            } else {
                throw new Error(`Failed: ${response.result.meta.TransactionResult} - ${response.result.meta.TransactionResultMessage || ''}`);
            }
        }
        // Always show results section if not already shown
        if (typeof resultSection !== 'undefined') {
            resultSection.style.display = 'block';
        }

    } catch (err) {
        logStatus(`ERROR: ${err.message}`, 'error');
        console.error(err);
    } finally {
        if (client) {
            await client.disconnect();
            logStatus('Disconnected.', 'step');
        }
        logStatus('Demo complete.', 'step');
    }
}

window.runDevnetDemo = runDevnetDemo;
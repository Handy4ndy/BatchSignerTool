// Security warning expand/collapse
document.addEventListener('DOMContentLoaded', function() {
    const card = document.getElementById('securityWarningCard');
    const chevronBtn = document.getElementById('securityChevron');
    if (card && chevronBtn) {
        chevronBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            card.classList.toggle('collapsed');
        });
    }
});
// Toggle switch label highlight logic
document.addEventListener('DOMContentLoaded', function() {
    const devnetMode = document.getElementById('devnetMode');
    const labelManual = document.getElementById('toggleLabelManual');
    const labelDevnet = document.getElementById('toggleLabelDevnet');
    function updateLabels() {
        if (devnetMode.checked) {
            labelManual.classList.remove('active');
            labelDevnet.classList.add('active');
        } else {
            labelManual.classList.add('active');
            labelDevnet.classList.remove('active');
        }
    }
    if (devnetMode && labelManual && labelDevnet) {
        devnetMode.addEventListener('change', updateLabels);
        updateLabels();
    }
});
// DOM Elements
const batchJsonInput = document.getElementById('batchJson');
const seedInput = document.getElementById('seed');
const toggleSeedBtn = document.getElementById('toggleSeed');
const generateBtn = document.getElementById('generateBtn');
const startDemoBtn = document.getElementById('startDemoBtn');
const resultSection = document.getElementById('resultSection');
const accountAddress = document.getElementById('accountAddress');
const batchValidation = document.getElementById('batchValidation');
const seedValidation = document.getElementById('seedValidation');
const devnetModeCheckbox = document.getElementById('devnetMode');
const manualBatchSection = document.getElementById('manualBatchSection');
const manualSeedSection = document.getElementById('manualSeedSection');
const devnetProgress = document.getElementById('devnetProgress');

// Outputs
const signerOutput = document.getElementById('signerOutput');
const batchSignersOutput = document.getElementById('batchSignersOutput');
const fullBatchOutput = document.getElementById('fullBatchOutput');

// Copy buttons
const copySingleBtn = document.getElementById('copySingleBtn');
const copyArrayBtn = document.getElementById('copyArrayBtn');
const copyFullBtn = document.getElementById('copyFullBtn');

// State
let batchTemplate = null;
let wallet = null;

// Toggle seed visibility
toggleSeedBtn.addEventListener('click', () => {
    const type = seedInput.type === 'password' ? 'text' : 'password';
    seedInput.type = type;
    toggleSeedBtn.textContent = type === 'password' ? '👁️' : '🙈';
});

// Validation (unchanged)
batchJsonInput.addEventListener('input', () => {
    try {
        const text = batchJsonInput.value.trim();
        if (!text) {
            batchTemplate = null;
            batchValidation.textContent = '';
            batchValidation.className = 'validation';
            checkReadyToGenerate();
            return;
        }

        const parsed = JSON.parse(text);

        if (parsed.TransactionType !== 'Batch') {
            throw new Error('TransactionType must be "Batch"');
        }
        if (!parsed.Account || typeof parsed.Account !== 'string') {
            throw new Error('Missing or invalid outer "Account" field');
        }
        if (!Array.isArray(parsed.RawTransactions) || 
            parsed.RawTransactions.length < 2 || 
            parsed.RawTransactions.length > 8) {
            throw new Error('RawTransactions must be an array with 2–8 items');
        }

        if (parsed.BatchSigners && parsed.BatchSigners.length > 0) {
            throw new Error('Remove existing BatchSigners array — this tool adds one signer at a time');
        }

        parsed.RawTransactions.forEach((entry, i) => {
            const tx = entry.RawTransaction;
            if (!tx || typeof tx !== 'object') throw new Error(`RawTransactions[${i}]: Invalid RawTransaction`);
            if (tx.Fee !== '0') throw new Error(`RawTransactions[${i}]: Fee must be "0"`);
            if (tx.SigningPubKey && tx.SigningPubKey !== '') throw new Error(`RawTransactions[${i}]: SigningPubKey must be empty`);
            if (tx.TxnSignature) throw new Error(`RawTransactions[${i}]: TxnSignature not allowed`);
            if (!(tx.Flags & 0x40000000)) throw new Error(`RawTransactions[${i}]: Missing tfInnerBatchTxn flag`);
        });

        batchTemplate = parsed;
        batchValidation.textContent = '✓ Valid Batch template';
        batchValidation.className = 'validation success';
        checkReadyToGenerate();
    } catch (err) {
        batchTemplate = null;
        batchValidation.textContent = '✗ ' + err.message;
        batchValidation.className = 'validation error';
        checkReadyToGenerate();
    }
});

seedInput.addEventListener('input', () => {
    const seed = seedInput.value.trim();
    if (!seed) {
        wallet = null;
        seedValidation.textContent = '';
        seedValidation.className = 'validation';
        checkReadyToGenerate();
        return;
    }
    try {
        wallet = xrpl.Wallet.fromSeed(seed);
        seedValidation.textContent = `✓ Valid seed (${wallet.address})`;
        seedValidation.className = 'validation success';
        checkReadyToGenerate();
    } catch (err) {
        wallet = null;
        seedValidation.textContent = '✗ Invalid seed';
        seedValidation.className = 'validation error';
        checkReadyToGenerate();
    }
});

function checkReadyToGenerate() {
    if (devnetModeCheckbox.checked) {
        generateBtn.disabled = true; // Demo mode uses startDemoBtn
        startDemoBtn.disabled = false;
    } else {
        generateBtn.disabled = !(batchTemplate && wallet);
        startDemoBtn.disabled = true;
    }
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block';
    });
});

// Manual Generate (unchanged)
generateBtn.addEventListener('click', async () => {
    if (!batchTemplate || !wallet) return;

    try {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';

        const signerAddress = wallet.address;

        if (signerAddress === batchTemplate.Account) {
            throw new Error('Seed matches outer Batch Account — use an inner account seed');
        }

        const involved = batchTemplate.RawTransactions.some(
            e => e.RawTransaction?.Account === signerAddress
        );

        if (!involved && !confirm('Your address not in any inner txn — proceed anyway?')) {
            throw new Error('Cancelled');
        }

        const batchCopy = JSON.parse(JSON.stringify(batchTemplate));
        xrpl.signMultiBatch(wallet, batchCopy);

        if (!batchCopy.BatchSigners || batchCopy.BatchSigners.length !== 1) {
            throw new Error('No BatchSigner generated');
        }

        const entry = batchCopy.BatchSigners[0].BatchSigner;

        signerOutput.textContent = JSON.stringify({ BatchSigner: entry }, null, 2);
        const signersArray = [{ BatchSigner: entry }];
        batchSignersOutput.textContent = JSON.stringify(signersArray, null, 2);
        const fullBatch = { ...batchTemplate, BatchSigners: signersArray };
        fullBatchOutput.textContent = JSON.stringify(fullBatch, null, 2);

        accountAddress.textContent = signerAddress;
        resultSection.style.display = 'block';

        setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);

    } catch (err) {
        alert('Error:\n' + err.message);
    } finally {
        generateBtn.textContent = 'Generate BatchSigner Object';
        generateBtn.disabled = false;
    }
});

// Devnet Mode Toggle Behavior
devnetModeCheckbox.addEventListener('change', () => {
    const isDevnet = devnetModeCheckbox.checked;

    // Toggle visibility
    manualBatchSection.classList.toggle('hidden', isDevnet);
    manualSeedSection.classList.toggle('hidden', isDevnet);
    generateBtn.classList.toggle('hidden', isDevnet);
    startDemoBtn.classList.toggle('hidden', !isDevnet);
    document.getElementById('devnetInfo').classList.toggle('hidden', !isDevnet);

    // Reset validation when switching
    batchValidation.textContent = '';
    batchValidation.className = 'validation';
    seedValidation.textContent = '';
    seedValidation.className = 'validation';

    checkReadyToGenerate();
});

// Start Devnet Demo (calls into devnet.js)
startDemoBtn.addEventListener('click', async () => {
    startDemoBtn.disabled = true;
    startDemoBtn.textContent = 'Running Demo...';
    devnetProgress.classList.remove('hidden');
    resultSection.style.display = 'none'; // Hide normal results during demo

    // Clear previous status
    document.getElementById('devnetStatus').textContent = '';

    try {
        // The full demo logic lives in devnet.js
        if (typeof window.runDevnetDemo !== 'function') {
            throw new Error('devnet.js not loaded or runDevnetDemo function missing');
        }

        await window.runDevnetDemo(); // This function will log progress to #devnetStatus

        // After demo completes, show results again if needed
        resultSection.style.display = 'block';

    } catch (err) {
        document.getElementById('devnetStatus').innerHTML += 
            `<span class="text-red-400">ERROR: ${err.message}</span>\n`;
    } finally {
        startDemoBtn.textContent = 'Start Devnet Demo';
        startDemoBtn.disabled = false;
    }
});

// Copy handlers (unchanged)
async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = orig;
            btn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = '✓ Copied!';
        setTimeout(() => btn.textContent = '📋 Copy', 2000);
    }
}

copyArrayBtn.addEventListener('click', () => copyToClipboard(batchSignersOutput.textContent, copyArrayBtn));
copyFullBtn.addEventListener('click', () => copyToClipboard(fullBatchOutput.textContent, copyFullBtn));

// Initial check
checkReadyToGenerate();
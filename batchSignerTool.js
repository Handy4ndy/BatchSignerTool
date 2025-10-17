/**
 * BatchSigner Tool - Secure Multi-Party Batch Transaction Signing
 * 
 * Enables secure individual signing of XRPL batch transactions without exposing
 * private keys. Generate BatchSigner signatures that can be safely shared with
 * the batch submitter for final transaction assembly and submission.
 * 
 * Quick Start:
 *   Production:  node batchSignerTool.js myCustomBatch.json
 *   Testing:     node batchSignerTool.js examplePayment.json --test
 * 
 * For complete documentation, examples, and setup instructions, see README.md
 */

import * as xrpl from "xrpl";
import { signMultiBatch, combineBatchSigners } from 'xrpl/dist/npm/Wallet/batchSigner.js';
import fs from 'fs';
import readline from 'readline';

class BatchSignerTool {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Validate that the provided data looks like a valid batch transaction
   */
  validateBatchTransaction(batchTx) {
    if (!batchTx || typeof batchTx !== 'object') {
      throw new Error('Invalid batch transaction: must be a valid JSON object');
    }

    if (batchTx.TransactionType !== 'Batch') {
      throw new Error('Invalid batch transaction: TransactionType must be "Batch"');
    }

    if (!Array.isArray(batchTx.RawTransactions) || batchTx.RawTransactions.length === 0) {
      throw new Error('Invalid batch transaction: must contain RawTransactions array');
    }

    return true;
  }

  /**
   * Validate seed phrase format
   */
  validateSeed(seed) {
    if (!seed || typeof seed !== 'string') {
      throw new Error('Invalid seed: must be a string');
    }

    if (!seed.startsWith('s')) {
      throw new Error('Invalid seed: must start with "s"');
    }

    if (seed.length < 25) {
      throw new Error('Invalid seed: too short');
    }

    return true;
  }

  /**
   * Check if the signer account is involved in any of the batch transactions
   */
  checkSignerInvolvement(batchTx, signerAddress) {
    // Check if this signer is also submitting inner transactions
    const involvedAccounts = batchTx.RawTransactions
      .map(rawTx => rawTx.RawTransaction.Account)
      .filter(account => account === signerAddress);

    // Check if this signer is the batch submitter (parent account)
    if (batchTx.Account === signerAddress) {
      let errorMsg = `Error: Account ${signerAddress} is the batch submitter (parent account)`;
      
      if (involvedAccounts.length > 0) {
        errorMsg += ` AND is also submitting ${involvedAccounts.length} inner transaction(s) in the batch.\n`;
        errorMsg += `   The parent account signs the entire batch transaction and does not need a BatchSigner signature.\n`;
        errorMsg += `   Note: The parent account can submit inner transactions, but only child accounts need BatchSigner signatures.`;
      } else {
        errorMsg += `.\n   The parent account signs the entire batch transaction and does not need a BatchSigner signature.\n`;
        errorMsg += `   Please use a different account that submits inner transactions in the batch.`;
      }
      
      throw new Error(errorMsg);
    }

    if (involvedAccounts.length === 0) {
      console.warn(`⚠️  Warning: Signer account ${signerAddress} is not submitting any transactions in this batch.`);
      console.warn('   This signature may not be required.');
    } else {
      console.log(`✅ Signer account ${signerAddress} is submitting ${involvedAccounts.length} transaction(s) in this batch.`);
    }
  }

  /**
   * Generate multiple BatchSigner signatures for an array of seeds
   */
  async generateMultipleBatchSignatures(batchTx, signerSeeds, options = {}) {
    try {
      console.log('🔐 Multi-Signer Mode: Generating signatures for multiple accounts...\n');
      
      this.validateBatchTransaction(batchTx);
      
      const batchSignatures = [];
      
      for (let i = 0; i < signerSeeds.length; i++) {
        const signerSeed = signerSeeds[i];
        console.log(`📝 Signer ${i + 1}/${signerSeeds.length}:`);
        
        this.validateSeed(signerSeed);
        const signerWallet = xrpl.Wallet.fromSeed(signerSeed);
        console.log(`   🔑 Address: ${signerWallet.address}`);
        
        // Check involvement
        this.checkSignerInvolvement(batchTx, signerWallet.address);
        
        // Create copy and sign
        const txToSign = { ...batchTx };
        signMultiBatch(signerWallet, txToSign, options);
        
        const batchSigner = txToSign.BatchSigners[0];
        batchSignatures.push(batchSigner);
        
        console.log(`   ✅ Signature generated for ${signerWallet.address}\n`);
      }
      
      console.log('🎉 All BatchSigner signatures generated successfully!');
      console.log('📋 Copy the following BatchSigners array:\n');
      
      console.log(JSON.stringify(batchSignatures, null, 2));
      
      console.log('\n📝 Instructions:');
      console.log('1. Copy the BatchSigners array above');
      console.log('2. Add it as the "BatchSigners" field in your batch transaction');
      console.log('3. The parent can then sign and submit the complete batch');
      
      return batchSignatures;
      
    } catch (error) {
      console.error('❌ Error generating multiple BatchSigner signatures:', error.message);
      throw error;
    }
  }

  /**
   * Complete workflow with multiple signers
   */
  async generateAndSubmitMultiSignerBatch(batchTx, signerSeeds, parentSeed, options = {}) {
    try {
      console.log('🚀 Starting multi-signer complete batch workflow...\n');

      // Step 1: Connect to devnet
      console.log('🌐 Step 1: Connecting to XRPL Devnet...');
      const client = new xrpl.Client("wss://s.devnet.rippletest.net:51233");
      await client.connect();
      console.log('✅ Connected to XRPL Devnet');

      // Step 2: Validate parent seed and create wallet
      console.log('\n👤 Step 2: Preparing parent account...');
      this.validateSeed(parentSeed);
      const parentWallet = xrpl.Wallet.fromSeed(parentSeed);
      console.log(`🔑 Parent Address: ${parentWallet.address}`);

      // Verify parent matches batch submitter
      if (batchTx.Account !== parentWallet.address) {
        throw new Error(`Parent wallet address (${parentWallet.address}) doesn't match batch Account (${batchTx.Account})`);
      }

      // Step 3: Autofill the original batch transaction
      console.log('\n⚙️  Step 3: Auto-filling batch transaction...');
      const autofilledTx = await client.autofill(batchTx);
      console.log(`📊 Autofilled: Sequence: ${autofilledTx.Sequence}, Fee: ${autofilledTx.Fee}, LastLedgerSequence: ${autofilledTx.LastLedgerSequence}`);

      // Step 4: Generate all BatchSigner signatures
      console.log('\n📝 Step 4: Generating BatchSigner signatures...');
      const signedTransactions = [];
      
      for (let i = 0; i < signerSeeds.length; i++) {
        const signerSeed = signerSeeds[i];
        console.log(`   Signer ${i + 1}/${signerSeeds.length}:`);
        
        this.validateSeed(signerSeed);
        const signerWallet = xrpl.Wallet.fromSeed(signerSeed);
        console.log(`   🔑 ${signerWallet.address}`);
        
        this.checkSignerInvolvement(autofilledTx, signerWallet.address);
        
        const txForSigning = { ...autofilledTx };
        signMultiBatch(signerWallet, txForSigning, options);
        signedTransactions.push(txForSigning);
        
        console.log(`   ✅ Signature generated\n`);
      }

      // Step 5: Combine all BatchSigners
      console.log('🔧 Step 5: Combining all BatchSigners...');
      const combinedTx = combineBatchSigners(signedTransactions);
      console.log(`✅ Combined ${signedTransactions.length} BatchSigner signatures`);

      // Step 6: Decode and re-autofill
      console.log('\n🔄 Step 6: Re-autofilling for submission...');
      const decodedTx = xrpl.decode(combinedTx);
      const reAutofilledTx = await client.autofill(decodedTx);
      reAutofilledTx.Fee = '1000';
      console.log(`📊 Final: Sequence: ${reAutofilledTx.Sequence}, Fee: ${reAutofilledTx.Fee}, LastLedgerSequence: ${reAutofilledTx.LastLedgerSequence}`);

      // Step 7: Parent signs
      console.log('\n✍️  Step 7: Parent signing complete batch...');
      const signed = parentWallet.sign(reAutofilledTx);
      console.log('✅ Batch transaction signed by parent');

      // Step 8: Submit
      console.log('\n📡 Step 8: Submitting to XRPL Devnet...');
      const result = await client.submitAndWait(signed.tx_blob);
      
      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log('\n🎉 MULTI-SIGNER BATCH TRANSACTION SUCCESSFUL! 🎉');
        console.log(`📋 Transaction Hash: ${result.result.hash}`);
        console.log(`🏦 Ledger Index: ${result.result.ledger_index}`);
        console.log(`🕐 Close Time: ${result.result.close_time_iso}`);
        
        console.log('\n📊 Transaction Summary:');
        console.log(`   • BatchSigners: ${signerSeeds.length} accounts`);
        console.log(`   • Batch Submitter: ${parentWallet.address}`);
        console.log(`   • Inner Transactions: ${batchTx.RawTransactions.length}`);
      } else {
        console.log(`❌ Transaction failed: ${result.result.meta.TransactionResult}`);
      }

      await client.disconnect();
      console.log('\n🔌 Disconnected from XRPL Devnet');

      return result;

    } catch (error) {
      console.error('\n❌ Error in multi-signer workflow:', error.message);
      throw error;
    }
  }
  async generateAndSubmitBatch(batchTx, signerSeed, parentSeed, options = {}) {
    try {
      console.log('🚀 Starting complete batch signing and submission workflow...\n');

      // Step 1: Connect to devnet first
      console.log('🌐 Step 1: Connecting to XRPL Devnet...');
      const client = new xrpl.Client("wss://s.devnet.rippletest.net:51233");
      await client.connect();
      console.log('✅ Connected to XRPL Devnet');

      // Step 2: Create wallets
      console.log('\n👤 Step 2: Preparing accounts...');
      this.validateSeed(signerSeed);
      this.validateSeed(parentSeed);
      
      const signerWallet = xrpl.Wallet.fromSeed(signerSeed);
      const parentWallet = xrpl.Wallet.fromSeed(parentSeed);
      
      console.log(`🔑 Signer Address: ${signerWallet.address}`);
      console.log(`🔑 Parent Address: ${parentWallet.address}`);

      // Verify parent matches batch submitter
      if (batchTx.Account !== parentWallet.address) {
        throw new Error(`Parent wallet address (${parentWallet.address}) doesn't match batch Account (${batchTx.Account})`);
      }

      // Step 3: Autofill the original batch transaction
      console.log('\n⚙️  Step 3: Auto-filling batch transaction...');
      const autofilledTx = await client.autofill(batchTx);
      console.log(`📊 Autofilled: Sequence: ${autofilledTx.Sequence}, Fee: ${autofilledTx.Fee}, LastLedgerSequence: ${autofilledTx.LastLedgerSequence}`);

      // Step 4: Sign with BatchSigner
      console.log('\n📝 Step 4: Generating BatchSigner signature...');
      this.checkSignerInvolvement(autofilledTx, signerWallet.address);
      
      const txForSigning = { ...autofilledTx };
      signMultiBatch(signerWallet, txForSigning, options);
      
      console.log('✅ BatchSigner signature generated');
      console.log(`   Account: ${txForSigning.BatchSigners[0].BatchSigner.Account}`);

      // Step 5: Combine BatchSigners (using the working pattern)
      console.log('\n� Step 5: Combining BatchSigners...');
      const combinedTx = combineBatchSigners([txForSigning]);
      console.log('✅ BatchSigners combined');

      // Step 6: Decode and re-autofill (following working pattern)
      console.log('\n🔄 Step 6: Re-autofilling for submission...');
      const decodedTx = xrpl.decode(combinedTx);
      const reAutofilledTx = await client.autofill(decodedTx);
      reAutofilledTx.Fee = '1000'; // Set higher fee
      console.log(`📊 Final: Sequence: ${reAutofilledTx.Sequence}, Fee: ${reAutofilledTx.Fee}, LastLedgerSequence: ${reAutofilledTx.LastLedgerSequence}`);

      // Step 7: Parent signs the complete batch
      console.log('\n✍️  Step 7: Parent signing complete batch...');
      const signed = parentWallet.sign(reAutofilledTx);
      console.log('✅ Batch transaction signed by parent');

      // Step 8: Submit to network
      console.log('\n📡 Step 8: Submitting to XRPL Devnet...');
      const result = await client.submitAndWait(signed.tx_blob);
      
      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log('\n🎉 BATCH TRANSACTION SUCCESSFUL! 🎉');
        console.log(`📋 Transaction Hash: ${result.result.hash}`);
        console.log(`🏦 Ledger Index: ${result.result.ledger_index}`);
        console.log(`🕐 Close Time: ${result.result.close_time_iso}`);
        
        // Show affected accounts
        console.log('\n📊 Transaction Summary:');
        console.log(`   • BatchSigner: ${signerWallet.address}`);
        console.log(`   • Batch Submitter: ${parentWallet.address}`);
        console.log(`   • Inner Transactions: ${batchTx.RawTransactions.length}`);
      } else {
        console.log(`❌ Transaction failed: ${result.result.meta.TransactionResult}`);
      }

      await client.disconnect();
      console.log('\n🔌 Disconnected from XRPL Devnet');

      return result;

    } catch (error) {
      console.error('\n❌ Error in complete workflow:', error.message);
      throw error;
    }
  }
  async generateBatchSignature(batchTx, signerSeed, options = {}) {
    try {
      // Validate inputs
      this.validateBatchTransaction(batchTx);
      this.validateSeed(signerSeed);

      // Create wallet from seed
      const signerWallet = xrpl.Wallet.fromSeed(signerSeed);
      console.log(`🔑 Signer Address: ${signerWallet.address}`);

      // Check if signer is involved in the batch
      this.checkSignerInvolvement(batchTx, signerWallet.address);

      // Create a copy of the batch transaction for signing
      const txToSign = { ...batchTx };

      // Sign the batch with the provided wallet
      signMultiBatch(signerWallet, txToSign, options);

      // Extract the BatchSigner object
      const batchSigner = txToSign.BatchSigners[0];

      console.log('\n🎉 BatchSigner signature generated successfully!');
      console.log('📋 Copy the following BatchSigner object:\n');

      // Format the output for easy copying
      const formattedOutput = {
        BatchSigner: batchSigner.BatchSigner
      };

      console.log(JSON.stringify(formattedOutput, null, 2));

      console.log('\n📝 Instructions:');
      console.log('1. Copy the BatchSigner object above');
      console.log('2. Add it to the BatchSigners array in your batch transaction');
      console.log('3. The parent can then sign and submit the complete batch');

      return formattedOutput;

    } catch (error) {
      // For validation errors (like parent account check), show clean message and exit
      if (error.message.includes('batch submitter (parent account)')) {
        console.error('❌', error.message);
        process.exit(1);
      }
      // For other errors, show full error and re-throw
      console.error(' Error generating BatchSigner signature:', error.message);
      throw error;
    }
  }

  /**
   * Manual input mode - paste batch JSON directly
   */
  async runManualMode() {
    console.log('\n📝 Manual Input Mode');
    console.log('==================\n');

    try {
      console.log('📄 Paste your batch transaction JSON (press Enter on empty line when done):');
      let batchJsonInput = '';
      
      // Read multiple lines until empty line
      while (true) {
        const line = await this.question('');
        if (line.trim() === '') break;
        batchJsonInput += line + '\n';
      }

      // Parse the JSON
      let batchTx;
      try {
        batchTx = JSON.parse(batchJsonInput);
        console.log('✅ Batch transaction parsed successfully');
      } catch (error) {
        throw new Error('Failed to parse batch transaction JSON: ' + error.message);
      }

      // Get seeds
      const signerSeed = await this.question('🔐 Enter BatchSigner seed phrase: ');
      const parentSeed = await this.question('🔑 Enter parent account seed phrase: ');
      
      // Optional: batch account
      const batchAccount = await this.question('👤 Enter batch account (optional, press enter to use signer address): ');

      const options = {};
      if (batchAccount.trim()) {
        options.batchAccount = batchAccount.trim();
      }

      // Execute complete workflow
      await this.generateAndSubmitBatch(batchTx, signerSeed, parentSeed, options);

    } catch (error) {
      console.error('❌ Error in manual mode:', error.message);
    }
  }

  /**
   * Interactive mode - prompt user for inputs
   */
  async runInteractive() {
    console.log('🔧 BatchSigner Tool - Interactive Mode');
    console.log('=====================================\n');

    try {
      // Ask user what they want to do
      console.log('Choose an option:');
      console.log('1. Generate BatchSigner signature only');
      console.log('2. Complete workflow (sign + submit to devnet)');
      console.log('3. Manual input mode (paste batch JSON directly)');
      const choice = await this.question('Enter choice (1, 2, or 3): ');

      // Get batch transaction
      const batchTxInput = await this.question('📄 Enter batch transaction JSON (or file path): ');
      let batchTx;

      // Try to read as file first, then as JSON
      try {
        if (fs.existsSync(batchTxInput)) {
          const fileContent = fs.readFileSync(batchTxInput, 'utf8');
          batchTx = JSON.parse(fileContent);
          console.log('✅ Loaded batch transaction from file');
        } else {
          batchTx = JSON.parse(batchTxInput);
          console.log('✅ Parsed batch transaction from input');
        }
      } catch (error) {
        throw new Error('Failed to parse batch transaction JSON');
      }

      // Get signer seed
      const signerSeed = await this.question('🔐 Enter BatchSigner seed phrase: ');

      // Optional: batch account (for multi-sig scenarios)
      const batchAccount = await this.question('👤 Enter batch account (optional, press enter to use signer address): ');

      const options = {};
      if (batchAccount.trim()) {
        options.batchAccount = batchAccount.trim();
      }

      if (choice.trim() === '1') {
        // Generate signature only
        await this.generateBatchSignature(batchTx, signerSeed, options);
      } else if (choice.trim() === '2') {
        // Complete workflow
        const parentSeed = await this.question('🔑 Enter parent account seed phrase (for submission): ');
        await this.generateAndSubmitBatch(batchTx, signerSeed, parentSeed, options);
      } else if (choice.trim() === '3') {
        // Manual input mode
        await this.runManualMode();
      } else {
        console.log('❌ Invalid choice. Please run again and choose 1, 2, or 3.');
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Command line mode - use provided arguments
   */
  async runCommandLine(args) {
    if (args.length < 2) {
      console.log('❌ Usage:');
      console.log('   Signature only: node batchSignerTool.js <batchTransaction.json> <signerSeed> [batchAccount]');
      console.log('   Complete workflow: node batchSignerTool.js <batchTransaction.json> <signerSeed> <parentSeed> --submit');
      console.log('   Or run without arguments for interactive mode');
      return;
    }

    try {
      const submitMode = args.includes('--submit');
      const filteredArgs = args.filter(arg => arg !== '--submit');
      const [batchTxPath, signerSeed, parentSeedOrBatchAccount, batchAccount] = filteredArgs;

      // Load batch transaction
      let batchTx;
      if (fs.existsSync(batchTxPath)) {
        const fileContent = fs.readFileSync(batchTxPath, 'utf8');
        batchTx = JSON.parse(fileContent);
      } else {
        batchTx = JSON.parse(batchTxPath);
      }

      const options = {};

      if (submitMode) {
        // Complete workflow mode: signerSeed, parentSeed, [batchAccount]
        const parentSeed = parentSeedOrBatchAccount;
        if (batchAccount) {
          options.batchAccount = batchAccount;
        }
        await this.generateAndSubmitBatch(batchTx, signerSeed, parentSeed, options);
      } else {
        // Signature only mode: signerSeed, [batchAccount]
        if (parentSeedOrBatchAccount) {
          options.batchAccount = parentSeedOrBatchAccount;
        }
        await this.generateBatchSignature(batchTx, signerSeed, options);
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Interactive Production Mode - Manual seed input for real usage
   */
  async runInteractiveProduction(batchTxPath) {
    console.log('🎯 Individual Signer Mode');
    console.log('========================\n');

    try {
      // Load batch transaction
      let batchTx;
      if (fs.existsSync(batchTxPath)) {
        const fileContent = fs.readFileSync(batchTxPath, 'utf8');
        batchTx = JSON.parse(fileContent);
        console.log(`✅ Loaded batch transaction from: ${batchTxPath}`);
      } else {
        throw new Error(`Batch transaction file not found: ${batchTxPath}`);
      }

      console.log('🔒 This is production mode - your seed stays secure and private.');
      console.log('📋 You will receive a BatchSigner object to share with the parent.\n');

      // Get signer seed
      const signerSeed = await this.question('🔐 Enter your account seed phrase: ');

      console.log('\n🔄 Generating your BatchSigner signature...');
      
      // Generate signature only (production mode)
      await this.generateBatchSignature(batchTx, signerSeed);

    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Test Mode - Uses devnet accounts for demonstration
   */
  async runTestMode(batchTxPath) {
    console.log('🧪 Test Mode - Educational Demonstration');
    console.log('=======================================\n');

    try {
      // Load devnet accounts
      const devnetAccounts = this.loadDevnetAccounts();
      if (!devnetAccounts) {
        console.log('❌ No devnet accounts found. Please run accountSetup.js first:');
        console.log('   node accountSetup.js');
        return;
      }

      console.log('✅ Loaded devnet accounts for testing');
      console.log(`🏦 Available accounts: ${devnetAccounts.accounts.length}`);
      console.log(`🪙 Token: ${devnetAccounts.tokenInfo.currency} (Issuer: ${devnetAccounts.tokenInfo.issuer})\n`);

      // Load batch transaction
      let batchTx;
      if (fs.existsSync(batchTxPath)) {
        const fileContent = fs.readFileSync(batchTxPath, 'utf8');
        batchTx = JSON.parse(fileContent);
        console.log(`✅ Loaded batch transaction from: ${batchTxPath}\n`);
      } else {
        throw new Error(`Batch transaction file not found: ${batchTxPath}`);
      }

      // Assign accounts based on batch transaction structure
      const { signerAccounts, parentAccount, isMultiSigner } = this.assignAccountRoles(batchTx, devnetAccounts);

      console.log('🎭 Account Role Assignment:');
      if (isMultiSigner) {
        console.log(`🔑 Multi-Signers: ${signerAccounts.length} accounts need to sign`);
        signerAccounts.forEach((signer, index) => {
          console.log(`   ${index + 1}. ${signer.role}: ${signer.address}`);
        });
      } else {
        console.log(`🔑 Signer (${signerAccounts[0].role}): ${signerAccounts[0].address}`);
      }
      console.log(`👤 Parent (batch submitter): ${parentAccount.address}\n`);

      // Ask user what they want to do in test mode
      console.log('Choose test mode action:');
      if (isMultiSigner) {
        console.log('1. Generate multiple BatchSigner signatures (multi-signer demo)');
        console.log('2. Complete workflow (full multi-signer batch submission demo)');
      } else {
        console.log('1. Generate BatchSigner signature only (individual signer demo)');
        console.log('2. Complete workflow (full batch submission demo)');
      }
      const choice = await this.question('Enter choice (1 or 2): ');

      if (choice.trim() === '1') {
        if (isMultiSigner) {
          // Demo multi-signer workflow
          console.log('\n🎯 Demonstrating Multi-Signer Workflow:\n');
          const signerSeeds = signerAccounts.map(account => account.seed);
          await this.generateMultipleBatchSignatures(batchTx, signerSeeds);
        } else {
          // Demo individual signing (the primary use case)
          console.log('\n🎯 Demonstrating Individual Signer Workflow:\n');
          await this.generateBatchSignature(batchTx, signerAccounts[0].seed);
        }
      } else if (choice.trim() === '2') {
        if (isMultiSigner) {
          // Demo complete multi-signer workflow
          console.log('\n🚀 Demonstrating Complete Multi-Signer Workflow:\n');
          const signerSeeds = signerAccounts.map(account => account.seed);
          await this.generateAndSubmitMultiSignerBatch(batchTx, signerSeeds, parentAccount.seed);
        } else {
          // Demo complete workflow for educational purposes
          console.log('\n🚀 Demonstrating Complete Workflow:\n');
          await this.generateAndSubmitBatch(batchTx, signerAccounts[0].seed, parentAccount.seed);
        }
      } else {
        console.log('❌ Invalid choice. Please run again and choose 1 or 2.');
      }

    } catch (error) {
      console.error('❌ Error in test mode:', error.message);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Load devnet accounts from JSON file
   */
  loadDevnetAccounts() {
    try {
      if (!fs.existsSync('devnetAccounts.json')) {
        return null;
      }
      const fileContent = fs.readFileSync('devnetAccounts.json', 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.warn('⚠️  Warning: Could not load devnetAccounts.json:', error.message);
      return null;
    }
  }

  /**
   * Assign account roles based on batch transaction structure
   */
  assignAccountRoles(batchTx, devnetAccounts) {
    // Get the parent account (batch submitter)
    const parentAddress = batchTx.Account;
    let parentAccount = null;

    // Find accounts that submit inner transactions (potential signers)
    const innerAccountAddresses = batchTx.RawTransactions
      .map(rawTx => rawTx.RawTransaction.Account)
      .filter((address, index, arr) => arr.indexOf(address) === index); // Remove duplicates

    // Filter out parent account from signers (parent doesn't need BatchSigner signature)
    const signerAddresses = innerAccountAddresses.filter(address => address !== parentAddress);

    // Determine if this is a multi-signer scenario
    const isMultiSigner = signerAddresses.length > 1;

    // Smart assignment based on transaction structure and available accounts
    let signerAccounts = [];

    // Try to find exact matches from devnet accounts
    for (const account of devnetAccounts.accounts) {
      // Check if this devnet account matches the parent
      if (account.address === parentAddress) {
        parentAccount = account;
      }
      
      // Check if this devnet account is a signer
      if (signerAddresses.includes(account.address)) {
        signerAccounts.push(account);
      }
    }

    // If we can't find exact matches, assign based on roles and transaction type
    if (signerAccounts.length === 0 || !parentAccount) {
      console.log('📝 Auto-assigning accounts based on transaction structure...');
      
      // Determine transaction type
      const hasTokens = batchTx.RawTransactions.some(rawTx => 
        rawTx.RawTransaction.TransactionType === 'TrustSet' ||
        (rawTx.RawTransaction.Amount && typeof rawTx.RawTransaction.Amount === 'object')
      );

      if (hasTokens) {
        // Token-related batch - use issuer as parent
        parentAccount = parentAccount || devnetAccounts.accounts.find(acc => acc.role === 'issuer');
        if (signerAccounts.length === 0) {
          signerAccounts = [devnetAccounts.accounts.find(acc => acc.role === 'new_holder')];
        }
      } else {
        // Simple payments - assign accounts based on whether it's multi-signer
        parentAccount = parentAccount || devnetAccounts.accounts[0];
        if (signerAccounts.length === 0) {
          if (isMultiSigner) {
            // Multi-signer: use accounts 1 and 2 as signers
            signerAccounts = [
              devnetAccounts.accounts[1], // existing_holder
              devnetAccounts.accounts[2]  // new_holder  
            ];
          } else {
            // Single signer: use account 1
            signerAccounts = [devnetAccounts.accounts[1]];
          }
        }
      }
    }

    if (signerAccounts.length === 0 || !parentAccount) {
      throw new Error('Could not assign appropriate accounts for this batch transaction');
    }

    return { signerAccounts, parentAccount, isMultiSigner };
  }

  /**
   * Utility method for readline questions
   */
  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }
}

// Auto-detection mode based on placeholders
async function autoDetectMode(tool, batchTxPath) {
  const signerSeedValid = Array.isArray(SIGNER_SEED) ? 
    SIGNER_SEED.length > 0 && SIGNER_SEED.every(seed => seed && seed !== "REPLACE_WITH_BATCHSIGNER_SEED") :
    SIGNER_SEED && SIGNER_SEED !== "REPLACE_WITH_BATCHSIGNER_SEED";
    
  const parentSeedValid = PARENT_SEED && PARENT_SEED !== "REPLACE_WITH_PARENT_SEED";

  if (!signerSeedValid) {
    console.log('❌ Error: SIGNER_SEED placeholder not replaced');
    console.log('Please replace with actual seed phrase(s)');
    return;
  }

  // Load batch transaction
  let batchTx;
  try {
    if (fs.existsSync(batchTxPath)) {
      const fileContent = fs.readFileSync(batchTxPath, 'utf8');
      batchTx = JSON.parse(fileContent);
    } else {
      batchTx = JSON.parse(batchTxPath);
    }
  } catch (error) {
    console.log('❌ Error loading batch transaction:', error.message);
    return;
  }

  const isMultiSigner = Array.isArray(SIGNER_SEED);

  if (parentSeedValid) {
    // Complete workflow mode
    if (isMultiSigner) {
      console.log('🚀 Auto-detected: Multi-Signer Complete workflow mode');
      console.log(`📝 SIGNER_SEEDS: ✅ ${SIGNER_SEED.length} valid seeds`);
      console.log('📝 PARENT_SEED: ✅ Valid');
      console.log('');
      await tool.generateAndSubmitMultiSignerBatch(batchTx, SIGNER_SEED, PARENT_SEED);
    } else {
      console.log('🚀 Auto-detected: Single-Signer Complete workflow mode');
      console.log('📝 SIGNER_SEED: ✅ Valid');
      console.log('📝 PARENT_SEED: ✅ Valid');
      console.log('');
      await tool.generateAndSubmitBatch(batchTx, SIGNER_SEED, PARENT_SEED);
    }
  } else {
    // Signature-only mode
    if (isMultiSigner) {
      console.log('🔐 Auto-detected: Multi-Signer Signature-only mode');
      console.log(`📝 SIGNER_SEEDS: ✅ ${SIGNER_SEED.length} valid seeds`);
      console.log('📝 PARENT_SEED: ❌ Placeholder (signature-only mode)');
      console.log('');
      await tool.generateMultipleBatchSignatures(batchTx, SIGNER_SEED);
    } else {
      console.log('🔐 Auto-detected: Single-Signer Signature-only mode');
      console.log('📝 SIGNER_SEED: ✅ Valid');
      console.log('📝 PARENT_SEED: ❌ Placeholder (signature-only mode)');
      console.log('');
      await tool.generateBatchSignature(batchTx, SIGNER_SEED);
    }
  }
}

// Main execution
async function main() {
  const tool = new BatchSignerTool();
  const args = process.argv.slice(2);

  // Check for --test flag
  const testFlag = args.includes('--test');
  const filteredArgs = args.filter(arg => arg !== '--test');
  
  // PRIMARY USE CASE: Manual signer mode (default)
  // node batchSignerTool.js batchCustom.json [seed]
  if (filteredArgs.length >= 1 && !testFlag) {
    console.log('🔐 BatchSigner Tool - Individual Signer Mode');
    console.log('=============================================\n');
    console.log('🎯 Production Mode: Secure individual signing');
    
    if (filteredArgs.length === 1) {
      // Interactive mode: prompt for seed
      await tool.runInteractiveProduction(filteredArgs[0]);
    } else {
      // Command line mode with seed provided
      await tool.runCommandLine(filteredArgs);
    }
    return;
  }

  // SECONDARY USE CASE: Testing with auto-accounts  
  // node batchSignerTool.js examplePayment.json --test
  if (filteredArgs.length === 1 && testFlag) {
    console.log('🧪 BatchSigner Tool - Test Mode');
    console.log('===============================\n');
    console.log('🎓 Educational Mode: Using devnet accounts for learning');
    
    await tool.runTestMode(filteredArgs[0]);
    return;
  }

  // Legacy auto-detection mode removed - use --test flag for automated testing

  // Interactive mode (no arguments)
  if (filteredArgs.length === 0 && !testFlag) {
    await tool.runInteractive();
    return;
  }

  // Show usage help
  console.log('📖 BatchSigner Tool Usage:');
  console.log('==========================\n');
  console.log('🔐 PRIMARY - Individual Signer (Production):');
  console.log('   node batchSignerTool.js batchCustom.json [seed]');
  console.log('   node batchSignerTool.js myBatch.json');
  console.log('');
  console.log('🧪 SECONDARY - Testing/Demo (Learning):');
  console.log('   node batchSignerTool.js examplePayment.json --test');
  console.log('   node batchSignerTool.js exampleTrustline.json --test');
  console.log('');
  console.log('🎮 Interactive Mode:');
  console.log('   node batchSignerTool.js');
}

// Export for use as module
export { BatchSignerTool };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
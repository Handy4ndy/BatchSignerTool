/**
 * Account Setup - One-Command BatchSigner Test Environment
 * 
 * This script creates a complete test environment for BatchSigner demonstrations:
 * 1. Generates 3 funded XRPL devnet accounts with different roles
 * 2. Sets up token infrastructure (XPN token with trustlines and balances)
 * 3. Automatically updates all example files with current account addresses
 * 4. Saves structured account data for BatchSigner tool auto-discovery
 * 
 * After running this once, all BatchSigner examples work immediately with --test flag.
 * 
 * Usage: node accountSetup.js
 */

import { Client, Wallet, AccountSetAsfFlags } from 'xrpl';
import fs from 'fs';

const DEVNET_URL = 'wss://s.devnet.rippletest.net:51233';
const OUTPUT_FILE = 'devnetAccounts.json';
const TOKEN_CURRENCY = 'XPN';

/**
 * Enable Default Ripple flag for an account
 */
async function enableRippling(client, wallet) {
  console.log(`🔄 Enabling rippling for ${wallet.address}...`);
  
  const accountSet = {
    TransactionType: "AccountSet",
    Account: wallet.address,
    SetFlag: AccountSetAsfFlags.asfDefaultRipple,
  };

  const prepared = await client.autofill(accountSet);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  
  if (result.result.meta.TransactionResult === "tesSUCCESS") {
    console.log(`✅ Rippling enabled for ${wallet.address}`);
    return result.result.hash;
  } else {
    throw new Error(`Failed to enable rippling: ${result.result.meta.TransactionResult}`);
  }
}

/**
 * Create a trustline for a token
 */
async function createTrustline(client, holderWallet, issuerAddress, currency, limit = "1000000") {
  console.log(`🤝 Creating trustline for ${currency} from ${holderWallet.address} to ${issuerAddress}...`);
  
  const trustSet = {
    TransactionType: "TrustSet",
    Account: holderWallet.address,
    LimitAmount: {
      currency: currency,
      issuer: issuerAddress,
      value: limit
    }
  };

  const prepared = await client.autofill(trustSet);
  const signed = holderWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  
  if (result.result.meta.TransactionResult === "tesSUCCESS") {
    console.log(`✅ Trustline created for ${currency}`);
    return result.result.hash;
  } else {
    throw new Error(`Failed to create trustline: ${result.result.meta.TransactionResult}`);
  }
}

/**
 * Send tokens from issuer to holder
 */
async function sendTokens(client, issuerWallet, holderAddress, currency, amount) {
  console.log(`💸 Sending ${amount} ${currency} from issuer to ${holderAddress}...`);
  
  const payment = {
    TransactionType: "Payment",
    Account: issuerWallet.address,
    Destination: holderAddress,
    Amount: {
      currency: currency,
      issuer: issuerWallet.address,
      value: amount
    }
  };

  const prepared = await client.autofill(payment);
  const signed = issuerWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  
  if (result.result.meta.TransactionResult === "tesSUCCESS") {
    console.log(`✅ Sent ${amount} ${currency} tokens`);
    return result.result.hash;
  } else {
    throw new Error(`Failed to send tokens: ${result.result.meta.TransactionResult}`);
  }
}

/**
 * Update example files with new account addresses
 */
async function updateExampleFiles(accountsData) {
  const issuer = accountsData.accounts.find(acc => acc.role === 'issuer');
  const existingHolder = accountsData.accounts.find(acc => acc.role === 'existing_holder');
  const newHolder = accountsData.accounts.find(acc => acc.role === 'new_holder');
  const tokenCurrency = accountsData.tokenInfo.currency;

  // Update examplePayment.json - Single BatchSigner scenario
  const examplePayment = {
    "TransactionType": "Batch",
    "Account": existingHolder.address, 
    "Flags": 262144,
    "RawTransactions": [
      {
        "RawTransaction": {
          "TransactionType": "Payment",
          "Amount": "1000000",
          "Account": newHolder.address,
          "Destination": issuer.address, 
          "Flags": 1073741824,
          "Fee": "0",
          "SigningPubKey": ""
        }
      },
       {
        "RawTransaction": {
          "TransactionType": "Payment",
          "Amount": "1000000",
          "Account": existingHolder.address,  
          "Destination": issuer.address, 
          "Flags": 1073741824,
          "Fee": "0",
          "SigningPubKey": ""
        }
      }
    ]
  };
  
  // Update exampleMultiPayment.json - Multiple BatchSigners scenario  
  const exampleMultiPayment = {
    "TransactionType": "Batch",
    "Account": issuer.address, 
    "Flags": 262144,
    "RawTransactions": [
      {
        "RawTransaction": {
          "TransactionType": "Payment",
          "Amount": "1000000",
          "Account": existingHolder.address, 
          "Destination": newHolder.address,
          "Flags": 1073741824,
          "Fee": "0",
          "SigningPubKey": ""
        }
      },
      {
        "RawTransaction": {
          "TransactionType": "Payment",
          "Amount": "1000000",
          "Account": newHolder.address, 
          "Destination": existingHolder.address,
          "Flags": 1073741824,
          "Fee": "0",
          "SigningPubKey": ""
        }
      }
    ]
  };

  // Update exampleTrustline.json - Token operations
  const exampleTrustline = {
    "TransactionType": "Batch",
    "Account": issuer.address, 
    "Flags": 262144,
    "RawTransactions": [
      {
        "RawTransaction": {
          "TransactionType": "TrustSet",
          "Account": newHolder.address,  
          "LimitAmount": {
            "currency": tokenCurrency,
            "value": "1000000",
            "issuer": issuer.address
          },
          "Flags": 1073741824,
          "Fee": "0",
          "SigningPubKey": ""
        }
      },
      {
        "RawTransaction": {
          "TransactionType": "Payment",
          "Amount": {
            "currency": tokenCurrency,
            "value": "100",
            "issuer": issuer.address
          },
          "Account": issuer.address,  
          "Destination": existingHolder.address,  
          "Flags": 1073741824,
          "Fee": "0",
          "SigningPubKey": ""
        }
      },
      {
        "RawTransaction": {
          "TransactionType": "Payment",
          "Amount": {
            "currency": tokenCurrency,
            "value": "100",
            "issuer": issuer.address
          },
          "Account": issuer.address, 
          "Destination": newHolder.address, 
          "Flags": 1073741824,
          "Fee": "0",
          "SigningPubKey": ""
        }
      }
    ]
  };


  // Update myCustomBatch.json - Production template with current accounts
  const myCustomBatch = {
    "TransactionType": "Batch",
    "Account": existingHolder.address,  
    "Flags": 262144,
    "RawTransactions": [
      {
        "RawTransaction": {
          "TransactionType": "Payment",
          "Amount": "2000000",
          "Account": newHolder.address,
          "Destination": issuer.address, 
          "Flags": 1073741824,
          "Fee": "0",
          "SigningPubKey": ""
        }
      },
      {
        "RawTransaction": {
          "TransactionType": "Payment",
          "Amount": "2000000",
          "Account": existingHolder.address, 
          "Destination": issuer.address,  
          "Flags": 1073741824,
          "Fee": "0",
          "SigningPubKey": ""
        }
      }
    ]
  };

  // Write updated example files
  const examples = [
    { file: 'examplePayment.json', data: examplePayment },
    { file: 'exampleTrustline.json', data: exampleTrustline },
    { file: 'exampleMultiPayment.json', data: exampleMultiPayment },
    { file: 'myCustomBatch.json', data: myCustomBatch }
  ];

  for (const example of examples) {
    try {
      fs.writeFileSync(example.file, JSON.stringify(example.data, null, 2));
      console.log(`   ✅ Updated ${example.file}`);
    } catch (error) {
      console.warn(`   ⚠️  Could not update ${example.file}:`, error.message);
    }
  }
}

async function generateAndFundAccounts() {
  const client = new Client(DEVNET_URL);
  
  try {
    console.log('🔗 Connecting to XRPL Devnet...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const accounts = [];

    // Generate and fund first 2 accounts (issuer and existing holder)
    for (let i = 1; i <= 2; i++) {
      console.log(`📋 Creating Account ${i}...`);
      
      // Generate new wallet
      const wallet = Wallet.generate();
      
      console.log(`🔑 Address: ${wallet.address}`);
      console.log(`🌱 Seed: ${wallet.seed}`);
      
      // Fund the account
      console.log('💰 Funding with 1000 XRP...');
      const fundResult = await client.fundWallet(wallet, {
        amount: "1000"
      });
      
      console.log(`✅ Funded! Balance: ${fundResult.balance} XRP`);
      
      // Enable rippling for all accounts
      const ripplingTxHash = await enableRippling(client, wallet);
      
      // Determine account role
      const isIssuer = i === 1; // Make account1 the issuer
      const isExistingHolder = i === 2; // Make account2 an existing holder with tokens
      let role = isIssuer ? 'issuer' : 'existing_holder';
      
      console.log(`🏷️  Role: ${role.toUpperCase()}`);
      if (isIssuer) {
        console.log(`🪙 Token Issuer for: ${TOKEN_CURRENCY}`);
      }
      console.log('');
      
      // Store account details
      const accountData = {
        id: i,
        name: `account${i}`,
        role: role,
        address: wallet.address,
        seed: wallet.seed,
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
        balance: fundResult.balance,
        fundedAt: new Date().toISOString(),
        ripplingEnabled: true,
        ripplingTxHash: ripplingTxHash
      };
      
      // Add issuer-specific data
      if (isIssuer) {
        accountData.issuedTokens = [{
          currency: TOKEN_CURRENCY,
          description: `${TOKEN_CURRENCY} token issued by ${wallet.address}`,
          maxSupply: "unlimited"
        }];
      }
      
      accounts.push(accountData);
    }

    // Now set up the existing holder with trustline and tokens
    console.log('🚀 Setting up existing holder with trustline and tokens...\n');
    
    const issuerWallet = Wallet.fromSeed(accounts[0].seed);
    const existingHolderWallet = Wallet.fromSeed(accounts[1].seed);
    
    // Create trustline for account2 (existing holder)
    const trustlineTxHash = await createTrustline(
      client, 
      existingHolderWallet, 
      issuerWallet.address, 
      TOKEN_CURRENCY
    );
    
    // Send 1000 XPN tokens to existing holder
    const tokenSendTxHash = await sendTokens(
      client,
      issuerWallet,
      existingHolderWallet.address,
      TOKEN_CURRENCY,
      "1000"
    );
    
    // Update existing holder account data
    accounts[1].trustlines = [{
      currency: TOKEN_CURRENCY,
      issuer: issuerWallet.address,
      limit: "1000000",
      balance: "1000",
      trustlineTxHash: trustlineTxHash
    }];
    accounts[1].tokenBalance = {
      currency: TOKEN_CURRENCY,
      value: "1000",
      receivedTxHash: tokenSendTxHash
    };

    console.log('\n');

    // Now create account 3 (new holder ready for trustline)
    console.log(`📋 Creating Account 3...`);
    
    // Generate new wallet
    const wallet3 = Wallet.generate();
    
    console.log(`🔑 Address: ${wallet3.address}`);
    console.log(`🌱 Seed: ${wallet3.seed}`);
    
    // Fund the account
    console.log('💰 Funding with 1000 XRP...');
    const fundResult3 = await client.fundWallet(wallet3, {
      amount: "1000"
    });
    
    console.log(`✅ Funded! Balance: ${fundResult3.balance} XRP`);
    
    // Enable rippling
    const ripplingTxHash3 = await enableRippling(client, wallet3);
    
    console.log(`🏷️  Role: NEW_HOLDER`);
    console.log('');
    
    // Store account 3 details
    const account3Data = {
      id: 3,
      name: 'account3',
      role: 'new_holder',
      address: wallet3.address,
      seed: wallet3.seed,
      publicKey: wallet3.publicKey,
      privateKey: wallet3.privateKey,
      balance: fundResult3.balance,
      fundedAt: new Date().toISOString(),
      ripplingEnabled: true,
      ripplingTxHash: ripplingTxHash3
    };
    
    accounts.push(account3Data);

    // Save to JSON file
    console.log(`💾 Saving account details to ${OUTPUT_FILE}...`);
    const accountsData = {
      generated: new Date().toISOString(),
      network: "devnet",
      tokenInfo: {
        currency: TOKEN_CURRENCY,
        issuer: accounts[0].address, // account1 is the issuer
        issuerSeed: accounts[0].seed,
        totalSupply: "1000" // Currently issued
      },
      accounts: accounts,
      summary: {
        total: accounts.length,
        totalBalance: accounts.reduce((sum, acc) => sum + parseInt(acc.balance), 0) + " XRP",
        issuerAccount: accounts[0].address,
        existingHolderAccount: accounts[1].address,
        existingHolderTokenBalance: "1000 " + TOKEN_CURRENCY,
        newHolderAccount: accounts[2].address
      }
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(accountsData, null, 2));
    console.log('✅ Account details saved successfully!');

    // Update example files with new account addresses
    console.log('\n🔄 Updating example files with new accounts...');
    await updateExampleFiles(accountsData);
    console.log('✅ Example files updated successfully!');

    // Display summary
    console.log('\n📊 Summary:');
    console.log('===========');
    console.log(`🪙 Token: ${TOKEN_CURRENCY}`);
    console.log(`🏦 Issuer: ${accounts[0].address} (${accounts[0].balance} XRP)`);
    console.log(`� Existing Holder: ${accounts[1].address} (${accounts[1].balance} XRP + 1000 ${TOKEN_CURRENCY})`);
    console.log(`👤 New Holder: ${accounts[2].address} (${accounts[2].balance} XRP, ready for trustline)`);

    console.log(`\n📄 All details saved to: ${OUTPUT_FILE}`);
    console.log('🎉 Setup complete! Perfect for comprehensive token batch examples.');
    console.log(`\n💡 Ready scenarios:`);
    console.log(`   1. ✅ Issuer can create and distribute ${TOKEN_CURRENCY} tokens`);
    console.log(`   2. ✅ Existing holder has trustline and 1000 ${TOKEN_CURRENCY} tokens`);
    console.log(`   3. 🔄 New holder can create trustline and receive tokens`);
    console.log(`   4. 🚀 Perfect for multi-party batch transactions`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

// Run the script
generateAndFundAccounts();

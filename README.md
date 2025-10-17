# BatchSigner Tool

A secure, production-ready tool for multi-party signing of XRPL batch transactions. Enables individual accounts to generate BatchSigner signatures that cryptographically commit to the entire batch structure without exposing their private keys.

## 🎯 Primary Use Case: Production Signing

The BatchSigner Tool is designed for **secure batch authorization** where each account generates a cryptographic signature over the batch flags and hash of all inner transactions, proving their consent to the entire batch structure.

### Quick Start (Production)

```bash
# Individual signer generates their signature
node batchSignerTool.js myCustomBatch.json
# Tool prompts for your seed phrase securely
# Returns a BatchSigner object to share with parent
```

### Quick Start (Testing)

```bash
# One-time setup (auto-updates all examples)
node accountSetup.js

# Test
node batchSignerTool.js examplePayment.json --test
node batchSignerTool.js exampleMultiPayment.json --test
node batchSignerTool.js exampleTrustline.json --test
```

## 🧪 Testing & Learning

**One-time setup** - Generate accounts and auto-update all examples:
```bash
node accountSetup.js  # Creates accounts + updates all example files automatically
```

**Then test immediately** with pre-configured devnet accounts:
```bash
# Test with auto-updated example transactions  
node batchSignerTool.js examplePayment.json --test
node batchSignerTool.js exampleMultiPayment.json --test
node batchSignerTool.js exampleTrustline.json --test
```

## Installation

```bash
npm install 
```

> 🚀 **Zero Configuration Testing**: Run `node accountSetup.js` once and all example files are automatically updated with fresh devnet accounts. No manual address copying or configuration needed - everything just works!

## Usage Examples

### 1. Individual Signer (Primary Use Case)

**Scenario**: Alice has a transaction included in a batch and needs to generate a BatchSigner signature that proves her consent to the entire batch structure

```bash
# Alice runs this on her machine
node batchSignerTool.js companyPayroll.json

# Tool prompts: Enter your account seed phrase: 
# Tool outputs: BatchSigner signature (signs batch flags + hash of all inner transactions)
```

### 2. Command Line with Seed

```bash
# Provide seed directly (less secure)
node batchSignerTool.js batch.json sEd7xxx...
```

### 3. Testing Mode

```bash
# Use pre-configured devnet accounts for learning
node batchSignerTool.js examplePayment.json --test
```

### 4. Interactive Mode

```bash
# Full interactive experience
node batchSignerTool.js
```

## Batch Transaction Examples

### Simple Payment Batch

```json
{
  "TransactionType": "Batch",
  "Account": "rParentAccountAddress",
  "RawTransactions": [
    {
      "RawTransaction": {
        "TransactionType": "Payment",
        "Account": "rSignerAccountAddress",
        "Destination": "rRecipientAddress",
        "Amount": "1000000"
      }
    }
  ]
}
```

### Token Trustline Batch

```json
{
  "TransactionType": "Batch", 
  "Account": "rIssuerAddress",
  "RawTransactions": [
    {
      "RawTransaction": {
        "TransactionType": "TrustSet",
        "Account": "rHolderAddress",
        "LimitAmount": {
          "currency": "XPN",
          "issuer": "rIssuerAddress",
          "value": "1000000"
        }
      }
    }
  ]
}
```

## Security Model

### 🔒 What Stays Private
- **Your seed phrase** - Never shared with anyone
- **Your private keys** - Remain on your device only
- **Signing process** - Happens locally on your machine

### 📤 What Gets Shared
- **BatchSigner signature** - Cryptographic proof of consent to entire batch structure
- **Account address** - Already public on blockchain  
- **Your authorization** - Signature over batch flags + hash of all inner transactions

### 🛡️ Protection Features
- **Cryptographic commitment** - Your signature covers the entire batch, preventing modification
- **Parent account validation** - Prevents signing as batch submitter
- **Batch structure verification** - Confirms the complete transaction set you're authorizing
- **Seed validation** - Checks seed phrase format
- **Input sanitization** - Validates all inputs

## Tool Modes

### Production Mode (Default)
- Manual seed phrase entry
- Secure individual signing
- BatchSigner output only
- No automatic submission

### Test Mode (`--test`)
- Uses devnet accounts from `devnetAccounts.json`
- Educational demonstrations
- Optional complete workflows
- Safe for learning

## Files Structure

```
BatchSignerTool/
├── batchSignerTool.js          # Main tool
├── accountSetup.js             # Generate accounts + auto-update examples  
├── devnetAccounts.json         # Test account data (auto-generated)
├── examplePayment.json     # Simple payment batch (auto-updated)
├── exampleTrustline.json   # Token trustline batch (auto-updated)
├── exampleMultiPayment.json # Multiple payments (auto-updated)
├── myCustomBatch.json      # Template for production
├── README.md                   # This file
└── Examples/
    ├── batchSignersPay.js # BatchSigner Payment example
    └── batchSignerTrustline.js   # BatchSigner Trustline example
   
```

## Workflow Overview

### Individual Signer Workflow
1. **Receive batch transaction template** from organizer (contains all inner transactions)
2. **Run BatchSigner Tool** with the batch file  
3. **Enter your seed phrase** when prompted (signs hash of entire batch structure)
4. **Copy BatchSigner signature** from output (cryptographic commitment to full batch)
5. **Send signature** to batch organizer
6. **Organizer combines all signatures** and submits the complete batch
### Complete Process (Multi-Party)
1. **Organizer creates** batch transaction template (includes all inner transactions)
2. **Each account holder** runs BatchSigner Tool individually (signs entire batch structure)
3. **Organizer collects** all BatchSigner signatures (each proves consent to full batch)
4. **Organizer combines** all signatures into the batch transaction
5. **Organizer submits** complete batch to XRPL

## Error Handling

### Common Errors

**Parent Account Error**
```
Error: Account rXXX is the batch submitter (parent account)
```
*Solution*: Use a different account that submits inner transactions

**Invalid Seed**
```
Error: Invalid seed: must start with "s"
```
*Solution*: Check seed phrase format (should start with 's')

**Not Involved**
```
Warning: Signer account rXXX is not submitting any transactions
```
*Note*: Your signature may not be required for this batch

## Development & Testing

### Setup Test Environment

```bash
# One command setup - generates accounts AND updates all examples automatically!
node accountSetup.js

# Everything now works immediately - no manual configuration needed
node batchSignerTool.js examplePayment.json --test      # ✅ Works instantly
node batchSignerTool.js exampleTrustline.json --test    # ✅ Works instantly  
node batchSignerTool.js exampleMultiPayment.json --test # ✅ Works instantly
```

**What `accountSetup.js` does:**
- 🏦 Creates 3 funded devnet accounts (Issuer, Existing Holder, New Holder)
- 🪙 Sets up XPN token infrastructure with trustlines and balances
- 🔄 **Automatically updates all example files** with the new account addresses
- ✅ Zero manual configuration - everything "just works" after setup

### Devnet Account Structure

The `accountSetup.js` script generates a `devnetAccounts.json` file with this structure:

```json
{
  "generated": "2025-10-17T13:37:47.527Z",
  "network": "devnet",
  "tokenInfo": {
    "currency": "XPN",
    "issuer": "rLjYu8zvMNTiV5woC8FpS9dEuvbiVeQKX2",
    "issuerSeed": "sEdTuUbHdH6cimdCDDVrn8LtRQm4gjz",
    "totalSupply": "1000"
  },
  "accounts": [
    {
      "id": 1,
      "role": "issuer",
      "address": "rLjYu8zvMNTiV5woC8FpS9dEuvbiVeQKX2",
      "seed": "sEdTuUbHdH6cimdCDDVrn8LtRQm4gjz",
      "balance": 1000,
      "ripplingEnabled": true,
      "issuedTokens": [
        {
          "currency": "XPN",
          "description": "XPN token issued by account",
          "maxSupply": "unlimited"
        }
      ]
    },
    {
      "id": 2,
      "role": "existing_holder",
      "address": "rKkg4z2chg26DjQL4DBuDK93SbFRABtFu",
      "seed": "sEd7M7331coPG9EEp1jcuQfV7qt1kZp",
      "balance": 1000,
      "trustlines": [
        {
          "currency": "XPN",
          "issuer": "rLjYu8zvMNTiV5woC8FpS9dEuvbiVeQKX2",
          "limit": "1000000",
          "balance": "1000"
        }
      ],
      "tokenBalance": {
        "currency": "XPN",
        "value": "1000"
      }
    },
    {
      "id": 3,
      "role": "new_holder",
      "address": "rhNRkAQtEF5vX5NHmfm3oYDqTvteqp16Ev",
      "seed": "sEdSJSFKQzw6dBkFys6fM5D3DQpmDX3",
      "balance": 1000,
      "ripplingEnabled": true
    }
  ]
}
```

> **Note**: Each time you run `accountSetup.js`, new accounts are generated with different addresses and seeds. The above shows the actual structure with real devnet account data.

## Technical Details

### XLS-0056 Batch Specification
- Implements XRPL batch transaction standard
- Uses `signMultiBatch()` for individual signatures
- Uses `combineBatchSigners()` for signature aggregation

### Cryptographic Security Model
Per XLS-0056, BatchSigner signatures are **NOT** signatures of individual transactions. Instead:
- **What gets signed**: Batch flags + hash of ALL inner transactions in RawTransactions array
- **Security guarantee**: No one can modify ANY transaction in the batch without invalidating ALL signatures
- **Trust requirement**: All parties must review and consent to the ENTIRE batch structure
- **Attack prevention**: Prevents malicious modification of any transaction by any party

### Dependencies
- **xrpl**: Core XRPL JavaScript library
- **fs**: File system operations  
- **readline**: Interactive input handling

### Network Support
- **Devnet**: Testing and development (default)
- **Testnet**: Extended testing
- **Mainnet**: Production usage

## FAQ

**Q: Is my seed phrase safe?**
A: Yes, your seed phrase never leaves your device. Only the BatchSigner signature is shared.

**Q: Can I use this on mainnet?**
A: Yes, just change the network connection in the tool from devnet to mainnet.

**Q: What if I'm not in the batch?**
A: The tool will warn you if your account isn't submitting any transactions in the batch.

**Q: Can multiple people use the same batch file?**
A: Yes, each person generates a BatchSigner signature that cryptographically commits to the entire batch structure. The batch organizer combines all signatures.

**Q: How do I create a batch transaction?**
A: Use the example templates provided, or create your own following the XLS-0056 specification.

## Support & Contributing

For issues, feature requests, or contributions, please refer to the XRPL community resources and documentation.

## License

This tool is provided as-is for educational and development purposes. Use at your own risk in production environments.
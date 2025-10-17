/**
 * Batch Token Distribution Example - Trustline Setup & Distribution
 * 
 * This example demonstrates atomic token distribution where a new recipient
 * must establish a trustline before receiving tokens - all in one batch:
 * 1. Child2 creates trustline for XPN token (requires BatchSigner signature)
 * 2. Issuer sends XPN tokens to Child1 (who already has trustline)
 * 3. Issuer sends XPN tokens to Child2 (using newly created trustline)
 * 
 * Scenario: Token issuer distributes XPN tokens to recipients, with one
 * recipient needing to establish trustline atomically during distribution
 * 
 * Usage:
 *   1. Replace SEED_PHRASE placeholders with actual devnet account seeds
 *   2. Ensure parent is token issuer and Child1 has existing trustline
 *   3. Run: node batchSignersTrustline.js
 */

import * as xrpl from "xrpl";
import { combineBatchSigners, signMultiBatch } from 'xrpl/dist/npm/Wallet/batchSigner.js';

async function submitBatchOnDevnet() {
  const client = new xrpl.Client("wss://s.devnet.rippletest.net:51233");

  try {
    await client.connect();
    console.log("Connected to XRPL Devnet");

    // Use test seeds (replace with your own funded accounts)
    const parentSeed = "SEED_PHRASE"; // Parent account  ISSUER
    const child1Seed = "SEED_PHRASE"; // Child account 1 Recipient (has trusline)
    const child2Seed = "SEED_PHRASE"; // Child account 2 Recipient (requires trustline)

    const parentAccount = xrpl.Wallet.fromSeed(parentSeed);
    const childAccount1 = xrpl.Wallet.fromSeed(child1Seed);
    const childAccount2 = xrpl.Wallet.fromSeed(child2Seed);

    console.log("Parent account:", parentAccount.address);
    console.log("Child 1 account:", childAccount1.address);
    console.log("Child 2 account:", childAccount2.address);

    // XPN token details
    const currency = "XPN"; // XPN token
    const tokenAmount = {
      currency: currency,
      value: "100",
      issuer: parentAccount.address
    };

    // 1. Child2 sets up trustline for XPN token (Child2 must sign this)
    // 2. Parent sends XPN tokens to Child1 (who already has trustline)
    // 3. Parent sends XPN tokens to Child2 (using newly created trustline)
    const Tx = {
      TransactionType: "Batch",
      Account: parentAccount.address,
      Flags: 262144,
      RawTransactions: [
        {
          RawTransaction: {
            TransactionType: "TrustSet",
            Account: childAccount2.address,
            LimitAmount: {
              currency: currency,
              value: "1000000", 
              issuer: parentAccount.address
            },
            Flags: 1073741824,
            Fee: "0",
            SigningPubKey: "",
          },
        },
        {
          RawTransaction: {
            TransactionType: "Payment",
            Amount: tokenAmount,
            Account: parentAccount.address,
            Destination: childAccount1.address,
            Flags: 1073741824,
            Fee: "0",
            SigningPubKey: "",
          },
        },
        {
          RawTransaction: {
            TransactionType: "Payment",
            Amount: tokenAmount,
            Account: parentAccount.address,
            Destination: childAccount2.address,
            Flags: 1073741824,
            Fee: "0",
            SigningPubKey: "",
          },
        },
      ],
    };

    // Autofill to get sequences and fees
    const autofilledTx = await client.autofill(Tx);
    console.log("Autofilled batch transaction:", autofilledTx);

    // Only Child2 needs to sign as BatchSigner (for the TrustSet transaction)
    // Child1 doesn't need to sign because they're not submitting any transactions
    const Tx2 = { ...autofilledTx };
    signMultiBatch(childAccount2, Tx2);

    console.log("Child2 BatchSigner:", Tx2.BatchSigners[0].BatchSigner);

    // Since only one child is signing, we can use Tx2 directly or combine with empty array
    const Tx3 = combineBatchSigners([Tx2]);
    console.log("Combined transaction:", Tx3);

    const decodedTx = xrpl.decode(Tx3);
    const reAutofilledTx = await client.autofill(decodedTx);
    console.log("Re-autofilled transaction:", reAutofilledTx);

    // Increase fee for batch transaction (complex transactions need higher fees)
    reAutofilledTx.Fee = '1000';

    const signed = parentAccount.sign(reAutofilledTx);
    console.log("Signed transaction blob:", signed.tx_blob);

    // Submit the signed transaction
    const result = await client.submitAndWait(signed.tx_blob);
    console.log("Batch transaction result:", result);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.disconnect();
    console.log("Disconnected from XRPL Devnet");
  }
}

submitBatchOnDevnet();

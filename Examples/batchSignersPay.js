/**
 * Batch Payment Example - Complete Multi-Signer Workflow
 * 
 * This example demonstrates the full batch transaction process where:
 * 1. Two child accounts each sign their own transactions (BatchSigners)
 * 2. Parent account combines all signatures and submits the batch
 * 3. Both payments execute atomically in a single batch transaction
 * 
 * Scenario: Child1 sends 1 XRP to Child2, Child2 sends 1 XRP back to Child1
 * 
 * Usage:
 *   1. Replace SEED_PHRASE placeholders with actual devnet account seeds
 *   2. Ensure accounts are funded with XRP
 *   3. Run: node batchSignersPay.js
 */

import * as xrpl from "xrpl";
import { combineBatchSigners, signMultiBatch } from 'xrpl/dist/npm/Wallet/batchSigner.js';

async function submitBatchOnDevnet() {
  const client = new xrpl.Client("wss://s.devnet.rippletest.net:51233");

  try {
    await client.connect();
    console.log("Connected to XRPL Devnet");

    // Use test seeds (replace with your own funded accounts)
    const parentSeed = "SEED_PHRASE"; // Parent account
    const child1Seed = "SEED_PHRASE"; // Child account 1
    const child2Seed = "SEED_PHRASE"; // Child account 2

    const parentAccount = xrpl.Wallet.fromSeed(parentSeed);
    const childAccount1 = xrpl.Wallet.fromSeed(child1Seed);
    const childAccount2 = xrpl.Wallet.fromSeed(child2Seed);

    console.log("Parent account:", parentAccount.address);
    console.log("Child 1 account:", childAccount1.address);
    console.log("Child 2 account:", childAccount2.address);

    const Tx = {
      TransactionType: "Batch",
      Account: parentAccount.address,
      Flags: 262144,
      RawTransactions: [
        {
          RawTransaction: {
            TransactionType: "Payment",
            Amount: "1000000", // 1 XRP in drops
            Account: childAccount1.address,
            Destination: childAccount2.address,
            Flags: 1073741824, // Inner batch
            Fee: "0",
            SigningPubKey: "",
          },
        },
        {
          RawTransaction: {
            TransactionType: "Payment",
            Amount: "1000000", // 1 XRP in drops
            Account: childAccount2.address,
            Destination: childAccount1.address,
            Flags: 1073741824, // Inner batch
            Fee: "0",
            SigningPubKey: "",
          },
        },
      ],
    };

    // Autofill to get sequences and fees
    const autofilledTx = await client.autofill(Tx);
    console.log("Autofilled batch transaction:", autofilledTx);

    const Tx1 = { ...autofilledTx };
    signMultiBatch(childAccount1, Tx1);

    const Tx2 = { ...autofilledTx };
    signMultiBatch(childAccount2, Tx2);

    console.log("Tx1 BatchSigner:", Tx1.BatchSigners[0].BatchSigner);
    console.log("Tx2 BatchSigner:", Tx2.BatchSigners[0].BatchSigner);

    const Tx3 = combineBatchSigners([Tx1, Tx2]);
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

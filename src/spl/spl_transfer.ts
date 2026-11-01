import {
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  explorer,
  explorerAddr,
  receiverWallet,
  RPC_URL,
  wallet,
  WS_URL,
} from "../wallet";
import { need, saveState } from "../state";

const rpc = createSolanaRpc(RPC_URL);
const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);

const mint = address(need("mint"));
const decimals = Number(need("decimals"));

// 100 whole tokens in base units.
const amount = 100n * 10n ** BigInt(decimals);

(async () => {
  try {
    const signer = await createKeyPairSignerFromBytes(wallet);
    // Recipient wallet: by default my second devnet wallet, or pass TO=<address>.
    const to = process.env.TO
      ? address(process.env.TO)
      : (await createKeyPairSignerFromBytes(receiverWallet())).address;
    console.log(`recipient wallet: ${to}`);

    const sendAndConfirm = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions,
    });

    const [fromAta] = await findAssociatedTokenPda({
      mint,
      owner: signer.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    console.log(`Your fromAta is : ${fromAta}`);

    const [toAta] = await findAssociatedTokenPda({
      mint,
      owner: to,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    console.log(`Your toAta is : ${toAta}`);

    // Tokens move between token accounts, not between wallets.
    // The recipient may not have an ATA for this mint yet, so we (the sender)
    // pay its rent and create it in the same transaction.
    const createAtaIx = await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: signer,
      owner: to,
      mint,
    });

    // transferChecked also passes the mint and decimals; the program rejects
    // the transfer if they do not match, which catches "wrong decimals" bugs.
    const transferIx = getTransferCheckedInstruction({
      source: fromAta,
      mint,
      destination: toAta,
      authority: signer, // owner of fromAta must sign
      amount,
      decimals,
    });

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
    const msg = createTransactionMessage({ version: 0 });
    const msgWithPayer = setTransactionMessageFeePayerSigner(signer, msg);
    const msgWithLifetime = setTransactionMessageLifetimeUsingBlockhash(
      latestBlockhash,
      msgWithPayer,
    );
    const txMessage = appendTransactionMessageInstructions(
      [createAtaIx, transferIx],
      msgWithLifetime,
    );

    const signedTx = await signTransactionMessageWithSigners(txMessage);
    assertIsTransactionWithBlockhashLifetime(signedTx);
    const signature = getSignatureFromTransaction(signedTx);
    await sendAndConfirm(signedTx, { commitment: "confirmed" });

    const { value: fromBal } = await rpc.getTokenAccountBalance(fromAta).send();
    const { value: toBal } = await rpc.getTokenAccountBalance(toAta).send();
    console.log(`balances after: me ${fromBal.uiAmountString}, recipient ${toBal.uiAmountString}`);
    console.log(`transfer txid: ${signature}`);
    console.log(explorer(signature));
    console.log(explorerAddr(toAta));

    saveState({
      receiver: to,
      receiver_ata: toAta,
      spl_transfer_tx: signature,
    });
  } catch (error) {
    console.log(error);
  }
})();

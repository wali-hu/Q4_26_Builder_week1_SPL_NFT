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
  getMintToInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { explorer, explorerAddr, RPC_URL, wallet, WS_URL } from "../wallet";
import { need, saveState } from "../state";

const rpc = createSolanaRpc(RPC_URL);
const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);

const mint = address(need("mint"));
const decimals = Number(need("decimals"));

// The program only knows base units. 1_000 whole tokens with 6 decimals
// = 1_000 * 10^6 = 1_000_000_000 base units.
const WHOLE_TOKENS = 1_000n;
const amount = WHOLE_TOKENS * 10n ** BigInt(decimals);

(async () => {
  try {
    const signer = await createKeyPairSignerFromBytes(wallet);

    // ATA = PDA of the Associated Token program with
    // seeds [owner, token_program, mint]. Same inputs always give the same address,
    // so anyone can find my token account for this mint without asking me.
    const [ata] = await findAssociatedTokenPda({
      mint,
      owner: signer.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    console.log(`Your ata is : ${ata}`);

    // Idempotent: creates the ATA if missing, does nothing if it exists,
    // so running this script twice does not fail.
    const createAtaIx = await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: signer,
      owner: signer.address,
      mint,
    });

    // New supply: only the mint authority can sign this.
    const mintToIx = getMintToInstruction({
      mint,
      token: ata,
      mintAuthority: signer,
      amount,
    });

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
    const msg = createTransactionMessage({ version: 0 });
    const msgWithPayer = setTransactionMessageFeePayerSigner(signer, msg);
    const msgWithLifetime = setTransactionMessageLifetimeUsingBlockhash(
      latestBlockhash,
      msgWithPayer,
    );
    const txMessage = appendTransactionMessageInstructions(
      [createAtaIx, mintToIx],
      msgWithLifetime,
    );

    const signedTx = await signTransactionMessageWithSigners(txMessage);
    assertIsTransactionWithBlockhashLifetime(signedTx);
    const signature = getSignatureFromTransaction(signedTx);

    const sendAndConfirm = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions,
    });
    await sendAndConfirm(signedTx, { commitment: "confirmed" });

    const { value: balance } = await rpc.getTokenAccountBalance(ata).send();
    console.log(`ata balance: ${balance.uiAmountString} (${balance.amount} base units)`);
    console.log(`mint txid: ${signature}`);
    console.log(explorer(signature));
    console.log(explorerAddr(ata));

    saveState({ my_ata: ata, spl_mint_tx: signature });
  } catch (error) {
    console.log(error);
  }
})();

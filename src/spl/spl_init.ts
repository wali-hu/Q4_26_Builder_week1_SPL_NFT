import {
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  getInitializeMintInstruction,
  getMintSize,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { getCreateAccountInstruction } from "@solana-program/system";
import { explorer, explorerAddr, RPC_URL, wallet, WS_URL } from "../wallet";
import { saveState } from "../state";

const rpc = createSolanaRpc(RPC_URL);
const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);

// 6 decimals: 1 whole token = 1_000_000 base units (like USDC).
const DECIMALS = 6;

(async () => {
  try {
    const signer = await createKeyPairSignerFromBytes(wallet);

    // The mint is a brand new account, so it needs its own keypair.
    // It signs once (to prove we own that address) and is never needed again.
    const mint = await generateKeyPairSigner();

    // A mint account is always 82 bytes. Ask the cluster for the rent deposit
    // instead of hardcoding it, because the rent price can change.
    const space = BigInt(getMintSize());
    const rent = await rpc.getMinimumBalanceForRentExemption(space).send();
    console.log(`mint size: ${space} bytes, rent: ${rent} lamports`);

    // Instruction 1 (System Program): create the account, fund it with rent,
    // and set its owner to the Token Program so only that program can write it.
    const createAccountIx = getCreateAccountInstruction({
      payer: signer,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    });

    // Instruction 2 (Token Program): write the mint fields into those 82 bytes.
    // The mint authority is the only key that can create new supply.
    const initMintIx = getInitializeMintInstruction({
      mint: mint.address,
      decimals: DECIMALS,
      mintAuthority: signer.address,
      freezeAuthority: signer.address,
    });

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const msg = createTransactionMessage({ version: 0 });
    const msgWithPayer = setTransactionMessageFeePayerSigner(signer, msg);
    const msgWithLifetime = setTransactionMessageLifetimeUsingBlockhash(
      latestBlockhash,
      msgWithPayer,
    );
    // Both instructions in one transaction: if init fails, the create is
    // rolled back too, so we never leave an empty unowned account behind.
    const txMessage = appendTransactionMessageInstructions(
      [createAccountIx, initMintIx],
      msgWithLifetime,
    );

    // Signers found inside the instructions sign here: our wallet and the mint keypair.
    const signedTx = await signTransactionMessageWithSigners(txMessage);
    assertIsTransactionWithBlockhashLifetime(signedTx);
    const signature = getSignatureFromTransaction(signedTx);

    const sendAndConfirm = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions,
    });
    await sendAndConfirm(signedTx, { commitment: "confirmed" });

    console.log(`mint address: ${mint.address}`);
    console.log(`init txid: ${signature}`);
    console.log(explorer(signature));
    console.log(explorerAddr(mint.address));

    saveState({
      mint: mint.address,
      decimals: String(DECIMALS),
      spl_init_tx: signature,
    });
  } catch (error) {
    console.log(error);
  }
})();

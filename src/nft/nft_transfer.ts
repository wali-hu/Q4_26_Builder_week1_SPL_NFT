import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { fetchAsset, mplCore, transfer } from "@metaplex-foundation/mpl-core";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { explorer, receiverWallet, RPC_URL, wallet } from "../wallet";
import { need, saveState } from "../state";

const umi = createUmi(RPC_URL);
const keypair = umi.eddsa.createKeypairFromSecretKey(wallet);
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(signer));
umi.use(mplCore());

(async () => {
  try {
    const assetAddress = need("asset");
    const newOwner = process.env.TO
      ? publicKey(process.env.TO)
      : umi.eddsa.createKeypairFromSecretKey(receiverWallet()).publicKey;

    const asset = await fetchAsset(umi, assetAddress);
    console.log(`owner before: ${asset.owner}`);

    // Only the current owner (or a transfer delegate) can sign this.
    // In Core the owner is just a field inside the asset account, so a
    // transfer rewrites 32 bytes: no token accounts are created or closed.
    const tx = await transfer(umi, {
      asset,
      newOwner,
    }).sendAndConfirm(umi);

    const signature = base58.deserialize(tx.signature)[0];
    const after = await fetchAsset(umi, assetAddress);
    console.log(`owner after:  ${after.owner}`);
    console.log(`update authority (unchanged): ${after.updateAuthority.address}`);
    console.log(`transfer txid: ${signature}`);
    console.log(explorer(signature));

    saveState({ nft_new_owner: newOwner, nft_transfer_tx: signature });
  } catch (e) {
    console.log(`error ${e}`);
  }
})();

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { fetchAsset, mplCore, update } from "@metaplex-foundation/mpl-core";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { explorer, RPC_URL, wallet } from "../wallet";
import { need, saveState } from "../state";

const umi = createUmi(RPC_URL);
const keypair = umi.eddsa.createKeypairFromSecretKey(wallet);
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(signer));
umi.use(mplCore());

(async () => {
  try {
    const assetAddress = need("asset");
    // New JSON uploaded by: VERSION=2 npm run nft:metadata
    const newUri = need("metadata_uri_v2");
    const newName = need("nft_name_v2");

    // update() needs the current asset (owner, plugins) to build the instruction.
    const asset = await fetchAsset(umi, assetAddress);
    console.log(`before: name="${asset.name}" uri=${asset.uri}`);

    // Only the update authority may change name/uri. authority defaults to the
    // identity (my wallet), which is the update authority set at create time.
    const tx = await update(umi, {
      asset,
      name: newName,
      uri: newUri,
    }).sendAndConfirm(umi);

    const signature = base58.deserialize(tx.signature)[0];
    const after = await fetchAsset(umi, assetAddress);
    console.log(`after:  name="${after.name}" uri=${after.uri}`);
    console.log(`update txid: ${signature}`);
    console.log(explorer(signature));

    saveState({ nft_update_tx: signature });
  } catch (e) {
    console.log(`error ${e}`);
  }
})();

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  generateSigner,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { create, fetchAsset, mplCore } from "@metaplex-foundation/mpl-core";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { explorer, explorerAddr, RPC_URL, wallet } from "../wallet";
import { need, saveState } from "../state";

const umi = createUmi(RPC_URL);
const keypair = umi.eddsa.createKeypairFromSecretKey(wallet);
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(signer));
umi.use(mplCore());

(async () => {
  try {
    const metadataUri = need("metadata_uri");
    const name = need("nft_name");

    // In Core one NFT = one account (the asset). No mint, no token account,
    // no metadata PDA. The asset address is a fresh keypair that signs once.
    const asset = generateSigner(umi);

    // owner and updateAuthority default to the identity (my wallet).
    const tx = await create(umi, {
      asset,
      name,
      uri: metadataUri,
    }).sendAndConfirm(umi);

    const signature = base58.deserialize(tx.signature)[0];
    console.log(`signature ${signature} , asset : ${asset.publicKey}`);
    console.log(explorer(signature));
    console.log(explorerAddr(asset.publicKey));

    const onChain = await fetchAsset(umi, asset.publicKey);
    console.log(
      `on-chain: name="${onChain.name}" owner=${onChain.owner} updateAuthority=${onChain.updateAuthority.address}`,
    );

    saveState({ asset: asset.publicKey, nft_mint_tx: signature });
  } catch (e) {
    console.log(`error ${e}`);
  }
})();

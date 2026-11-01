import {
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { RPC_URL, wallet } from "../wallet";
import { need, saveState } from "../state";

const umi = createUmi(RPC_URL);
const keypair = umi.eddsa.createKeypairFromSecretKey(wallet);
const signer = createSignerFromKeypair(umi, keypair);
umi.use(irysUploader({ address: "https://devnet.irys.xyz/" }));
umi.use(signerIdentity(signer));

// VERSION=2 builds the updated JSON used by nft_update.ts.
const version = process.env.VERSION ?? "1";

(async () => {
  try {
    // Image URI saved by nft_image.ts.
    const image = need("image_uri");

    // JSON schema: https://www.metaplex.com/docs/smart-contracts/core/json-schema
    // On-chain the asset stores only name + uri; everything else lives here.
    const metadata = {
      name: version === "2" ? "The Detective #1 (Case Closed)" : "The Detective #1",
      description:
        version === "2"
          ? "Updated by the update authority: the case is closed. Turbin3 Q4 2026."
          : "A Metaplex Core NFT minted in the Turbin3 Q4 2026 Builders Cohort.",
      image,
      attributes: [
        { trait_type: "Hat", value: "Fedora" },
        { trait_type: "Coat", value: "Leather" },
        { trait_type: "Status", value: version === "2" ? "Case Closed" : "On the Case" },
      ],
      properties: {
        files: [{ uri: image, type: "image/jpeg" }],
        category: "image",
      },
    };

    const myUri = await umi.uploader.uploadJson(metadata);
    console.log(`metadata uri: ${myUri}`);

    saveState(
      version === "2"
        ? { nft_name_v2: metadata.name, metadata_uri_v2: myUri }
        : { nft_name: metadata.name, metadata_uri: myUri },
    );
  } catch (error) {
    console.log("error", error);
  }
})();

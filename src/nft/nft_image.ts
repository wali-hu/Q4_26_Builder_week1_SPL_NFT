import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createGenericFile,
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { RPC_URL, wallet } from "../wallet";
import { saveState } from "../state";

const umi = createUmi(RPC_URL);
const keypair = umi.eddsa.createKeypairFromSecretKey(wallet);
const signer = createSignerFromKeypair(umi, keypair);

// Irys devnet: storage paid with devnet SOL from our wallet.
// The returned URI is a gateway link to the stored bytes.
umi.use(irysUploader({ address: "https://devnet.irys.xyz/" }));
umi.use(signerIdentity(signer));

const IMAGE_PATH = process.env.IMAGE_PATH ?? resolve(__dirname, "../../detective.jpg");

(async () => {
  try {
    const image = await readFile(IMAGE_PATH);

    // contentType makes the gateway serve it as an image, so wallets can render it.
    const file = createGenericFile(image, "detective.jpg", {
      contentType: "image/jpeg",
    });

    const price = await umi.uploader.getUploadPrice([file]);
    console.log(`upload price: ${price.basisPoints} lamports`);

    const [myUri] = await umi.uploader.upload([file]);
    console.log("Your image URI: ", myUri);

    saveState({ image_uri: myUri });
  } catch (error) {
    console.log(error);
  }
})();

import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  createMetadataAccountV3,
  CreateMetadataAccountV3InstructionAccounts,
  CreateMetadataAccountV3InstructionArgs,
  DataV2Args,
  findMetadataPda,
} from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";
import { explorer, explorerAddr, RPC_URL, wallet } from "../wallet";
import { loadState, need, saveState } from "../state";

// The mint created by spl_init.ts (read from devnet-results.json).
const mint = publicKey(need("mint"));

const umi = createUmi(RPC_URL);
const keypair = umi.eddsa.createKeypairFromSecretKey(wallet);
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(signer));
umi.use(irysUploader({ address: "https://devnet.irys.xyz/" }));

(async () => {
  try {
    // Off-chain JSON that wallets read to show the token's description and logo.
    // Only the short fields (name, symbol, uri) are stored on-chain.
    const tokenJson = {
      name: "Wali Coin",
      symbol: "WALI",
      description: "My first SPL token, made in the Turbin3 Q4 2026 Builders Cohort.",
      image: loadState().image_uri ?? "",
    };
    const uri = await umi.uploader.uploadJson(tokenJson);
    console.log(`token json uri: ${uri}`);

    // The metadata account is a PDA of the Token Metadata program:
    // seeds = ["metadata", metadata_program_id, mint]. One per mint.
    const metadataPda = findMetadataPda(umi, { mint });
    console.log(`metadata PDA: ${metadataPda[0]}`);

    const accounts: CreateMetadataAccountV3InstructionAccounts = {
      mint,
      // The program checks that the mint authority signed, so only the
      // token's creator can attach metadata to it.
      mintAuthority: signer,
    };

    const data: DataV2Args = {
      name: tokenJson.name,
      symbol: tokenJson.symbol,
      uri,
      sellerFeeBasisPoints: 0, // royalties, only used by NFTs
      creators: null,
      collection: null,
      uses: null,
    };

    const args: CreateMetadataAccountV3InstructionArgs = {
      data,
      isMutable: true, // keep true so the update authority can change it later
      collectionDetails: null,
    };

    const tx = createMetadataAccountV3(umi, { ...accounts, ...args });
    const result = await tx.sendAndConfirm(umi);
    const signature = bs58.encode(Buffer.from(result.signature));

    console.log(`signature: ${signature}`);
    console.log(explorer(signature));
    console.log(explorerAddr(metadataPda[0]));

    saveState({
      token_json_uri: uri,
      metadata_pda: metadataPda[0],
      spl_metadata_tx: signature,
    });
  } catch (error) {
    console.log("error", error);
  }
})();

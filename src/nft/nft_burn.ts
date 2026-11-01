import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { burn, fetchAsset, mplCore } from "@metaplex-foundation/mpl-core";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { explorer, receiverWallet, RPC_URL, wallet } from "../wallet";
import { need, saveState } from "../state";

const umi = createUmi(RPC_URL);
// My main wallet pays the transaction fee (the receiver wallet has no SOL).
const payer = createSignerFromKeypair(
  umi,
  umi.eddsa.createKeypairFromSecretKey(wallet),
);
umi.use(signerIdentity(payer));
umi.use(mplCore());

async function lamports(address: string): Promise<bigint> {
  const account = await umi.rpc.getAccount(publicKey(address));
  return account.exists ? account.lamports.basisPoints : 0n;
}

async function accountSize(address: string): Promise<number> {
  const account = await umi.rpc.getAccount(publicKey(address));
  return account.exists ? account.data.length : 0;
}

(async () => {
  try {
    const assetAddress = need("asset");
    const asset = await fetchAsset(umi, assetAddress);

    // Burning needs the OWNER's signature. After nft_transfer.ts the owner is
    // the receiver wallet, so it signs as authority while my wallet pays fees.
    const ownerKeypair = umi.eddsa.createKeypairFromSecretKey(receiverWallet());
    const owner =
      ownerKeypair.publicKey === asset.owner
        ? createSignerFromKeypair(umi, ownerKeypair)
        : payer;
    console.log(`asset owner: ${asset.owner}, signing as: ${owner.publicKey}`);

    const watch = [assetAddress, payer.publicKey, owner.publicKey];
    const before = await Promise.all(watch.map(lamports));
    const sizeBefore = await accountSize(assetAddress);

    const tx = await burn(umi, {
      asset,
      authority: owner,
    }).sendAndConfirm(umi);
    const signature = base58.deserialize(tx.signature)[0];

    const after = await Promise.all(watch.map(lamports));
    const sizeAfter = await accountSize(assetAddress);

    console.log(`asset size: ${sizeBefore} -> ${sizeAfter} bytes`);
    ["asset", "payer (my wallet)", "owner"].forEach((label, i) => {
      if (i === 2 && owner.publicKey === payer.publicKey) return;
      console.log(
        `${label.padEnd(18)} ${before[i]} -> ${after[i]} lamports (${after[i] - before[i]})`,
      );
    });
    console.log(`burn txid: ${signature}`);
    console.log(explorer(signature));

    saveState({
      nft_burn_tx: signature,
      burn_asset_lamports_before: String(before[0]),
      burn_asset_lamports_after: String(after[0]),
      burn_asset_size_after: String(sizeAfter),
    });
  } catch (e) {
    console.log(`error ${e}`);
  }
})();

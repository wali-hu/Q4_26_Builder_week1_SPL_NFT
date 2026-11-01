import { readFileSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";

// Read a keypair JSON (array of 64 numbers) from disk.
// The secret key never lives inside this repo: the main wallet is read
// from ~/.config/solana by default, override with WALLET_PATH.
function loadKeypairBytes(path: string): Uint8Array {
  return new Uint8Array(JSON.parse(readFileSync(path, "utf8")));
}

export const WALLET_PATH =
  process.env.WALLET_PATH ?? resolve(homedir(), ".config/solana/turbin3.json");

// Second devnet wallet, used as the receiver in the transfer scripts (gitignored).
export const RECEIVER_PATH =
  process.env.RECEIVER_PATH ?? resolve(__dirname, "../receiver-wallet.json");

export const wallet = loadKeypairBytes(WALLET_PATH);
export const receiverWallet = () => loadKeypairBytes(RECEIVER_PATH);

export const RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const WS_URL =
  process.env.SOLANA_WS_URL ?? "wss://api.devnet.solana.com";

export const explorer = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=devnet`;

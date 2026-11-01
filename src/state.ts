import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// Each script saves what it created (mint, asset, URIs, signatures) here,
// so the next script reads it instead of you pasting addresses by hand.
// Only public data goes in this file, never a secret key.
const STATE_PATH = resolve(__dirname, "../devnet-results.json");

export type State = Record<string, string>;

export function loadState(): State {
  return existsSync(STATE_PATH)
    ? JSON.parse(readFileSync(STATE_PATH, "utf8"))
    : {};
}

export function saveState(patch: State): void {
  const next = { ...loadState(), ...patch };
  writeFileSync(STATE_PATH, JSON.stringify(next, null, 2) + "\n");
}

export function need(key: string): string {
  const value = process.env[key.toUpperCase()] ?? loadState()[key];
  if (!value) throw new Error(`Missing "${key}": run the earlier script first`);
  return value;
}

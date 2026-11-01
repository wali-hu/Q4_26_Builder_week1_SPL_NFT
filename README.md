# Turbin3 Week 1: SPL Token + Metaplex Core NFT (devnet)

TypeScript scripts that run the whole life of a fungible SPL token and of a Metaplex Core NFT on Solana devnet:

1. Create an SPL token, attach metadata, mint it and transfer it.
2. Mint an NFT with Metaplex Core.
3. Update the NFT's name and metadata as the update authority.
4. Transfer the NFT to another wallet.
5. Burn the NFT and get the rent back.

Built on the class starter [ShrinathNR/spl-nft-q326](https://github.com/ShrinathNR/spl-nft-q326) for the Turbin3 Q4 2026 Builders Cohort. Every run below happened on devnet, and the signatures link to Solana Explorer.

## Stack

| Package | Version | Used for |
|---|---|---|
| `@solana/kit` | 6.8.0 | building, signing and sending the SPL transactions |
| `@solana-program/token` | 0.13.0 | Token Program and Associated Token Program instructions |
| `@solana-program/system` | 0.12.0 | `createAccount` for the mint |
| `@metaplex-foundation/umi` | 1.5.1 | Metaplex client (signer, uploader, tx builder) |
| `@metaplex-foundation/mpl-token-metadata` | 3.4.0 | metadata for the SPL token |
| `@metaplex-foundation/mpl-core` | 1.10.0 | the Core NFT: create, update, transfer, burn |
| `@metaplex-foundation/umi-uploader-irys` | 1.5.0 | uploading the image and JSON to Irys (devnet) |

## Setup

```bash
npm install
# Second wallet, used as the receiver for both transfers (gitignored)
solana-keygen new --no-bip39-passphrase -o receiver-wallet.json
```

The scripts never copy a secret key into the repo. `src/wallet.ts` reads the main wallet from `~/.config/solana/turbin3.json`. You can point it elsewhere:

```bash
export WALLET_PATH=~/.config/solana/id.json       # main wallet (payer, authority)
export RECEIVER_PATH=./receiver-wallet.json       # receiver wallet
export SOLANA_RPC_URL=https://api.devnet.solana.com
```

Each script saves what it created (mint, ATA, asset, URIs, signatures) to `devnet-results.json`, and the next script reads it from there. Nothing needs to be pasted by hand. The file holds only public data.

## Run order

```bash
# SPL token (task 1)
npm run spl:init         # create the mint (82 bytes, 6 decimals)
npm run nft:image        # upload detective.jpg (also used as the token logo)
npm run spl:metadata     # token JSON + Token Metadata PDA (name, symbol, uri)
npm run spl:mint         # create my ATA, mint 1,000 WALI
npm run spl:transfer     # create receiver ATA, transferChecked 100 WALI

# Core NFT (tasks 2 to 5)
npm run nft:metadata             # upload NFT JSON v1
npm run nft:mint                 # create the Core asset
VERSION=2 npm run nft:metadata   # upload NFT JSON v2
npm run nft:update               # new name + uri (update authority signs)
npm run nft:transfer             # owner -> receiver wallet
npm run nft:burn                 # owner burns it, rent goes back to the payer
```

## Scripts and the accounts they touch

### SPL token (`@solana/kit`)

| Script | Instructions | Accounts |
|---|---|---|
| `spl_init.ts` | System `createAccount` + Token `initializeMint` in **one** tx | **Mint** (82 bytes, owner = Token Program). Fresh keypair, signs once. Mint and freeze authority = my wallet. |
| `spl_metadata.ts` | Token Metadata `createMetadataAccountV3` | **Metadata PDA**, seeds `["metadata", metadata_program, mint]`. The mint authority must sign. |
| `spl_mint.ts` | ATA `createIdempotent` + Token `mintTo` | **My ATA**, seeds `[owner, token_program, mint]` (165 bytes). Only the mint authority can mint. |
| `spl_transfer.ts` | ATA `createIdempotent` (receiver) + Token `transferChecked` | Moves tokens from my ATA to the receiver's ATA. I pay for the receiver's ATA. `transferChecked` also checks the mint and decimals. |

Amounts are in base units: with 6 decimals, 1 WALI = 1,000,000. `spl_mint` mints `1000n * 10n ** 6n`.

### Core NFT (`umi` + `mpl-core`)

| Script | Call | Who signs | What changes |
|---|---|---|---|
| `nft_image.ts` | `umi.uploader.upload` | wallet pays Irys | image stored on Irys |
| `nft_metadata.ts` | `umi.uploader.uploadJson` | wallet pays Irys | JSON (name, description, image, attributes, properties) |
| `nft_mint.ts` | `create` | wallet + new asset keypair | **one Core asset account** holds owner, update authority, name, uri |
| `nft_update.ts` | `update` | update authority | name and uri rewritten, account resized to fit |
| `nft_transfer.ts` | `transfer` | current owner | the `owner` field becomes the receiver. Update authority stays. |
| `nft_burn.ts` | `burn` | owner (receiver) signs, my wallet pays | the asset shrinks to 1 byte, freed rent goes to the payer |

In Core, one NFT is one account. A Token Metadata NFT needs a mint, a token account, a metadata PDA and a master edition. A Core asset is a single account owned by `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`.

## Devnet results (1 Nov 2026)

Main wallet `C9bL9g4ktPxankL33SBP5viLFNgdDVSJMAM1G7dMb64y`, receiver `8jtQ37FHW4EiYdT8CJxuZUvCukRuXVGkurzMpFXWxoas`.

### Task 1: SPL token "Wali Coin" (WALI)

| What | Address | Size / rent |
|---|---|---|
| Mint | [`2rGvr32r6bSMk8uc5K9qm8J32416A2gSZcGuy9ziPJtu`](https://explorer.solana.com/address/2rGvr32r6bSMk8uc5K9qm8J32416A2gSZcGuy9ziPJtu?cluster=devnet) | 82 B, 1,066,800 lamports |
| Metadata PDA | [`GR3hd8gQdz8DZhxQR5UodvYomGLKFqsvgaqELmzbcMnx`](https://explorer.solana.com/address/GR3hd8gQdz8DZhxQR5UodvYomGLKFqsvgaqELmzbcMnx?cluster=devnet) | 607 B, 13,733,800 lamports |
| My ATA (900 WALI) | [`GMcaFg7eXwuwi8dAgVP1rAp3bczepC5SSpRGZGwsSnnt`](https://explorer.solana.com/address/GMcaFg7eXwuwi8dAgVP1rAp3bczepC5SSpRGZGwsSnnt?cluster=devnet) | 165 B, 1,488,440 lamports |
| Receiver ATA (100 WALI) | [`DqjsoSY8BfsvACDfQuXZGEzTgiDfqDVTKfxENatZxWbK`](https://explorer.solana.com/address/DqjsoSY8BfsvACDfQuXZGEzTgiDfqDVTKfxENatZxWbK?cluster=devnet) | 165 B, 1,488,440 lamports |

| Step | Transaction |
|---|---|
| init mint | [`5M2fjAjD...ENPyzv4`](https://explorer.solana.com/tx/5M2fjAjDXPgh2zQ63pqiZaT4NexMFWwQSVpDT2kSdQjgaCX1c1EJwKFyLUUvWt2w2rzdFhz8rrFQ47dEAENPyzv4?cluster=devnet) |
| metadata | [`4PLHF8pW...c7Fr6BC`](https://explorer.solana.com/tx/4PLHF8pWMh41xRXpcAK2UPsLhnx3SmSgRVnU398uxMhVfctJmG1ezqgdTNQYWGmXXk8385zdLHk4EJ1rbc7Fr6BC?cluster=devnet) |
| mint 1,000 WALI | [`3Cs5wZKh...aFZ1yKHg`](https://explorer.solana.com/tx/3Cs5wZKhYYtABz28pHDkKbFMd2LeZWvTjwjMMBWkeRjqTKThhRK2nQJFG8qAnKv6fdif8DQuZFkuuqT1aFZ1yKHg?cluster=devnet) |
| transfer 100 WALI | [`dsXcSiAE...82LS11Q`](https://explorer.solana.com/tx/dsXcSiAEBvVtyWG2MZxTyVfvmTz5A8vfvnbWZVYncGCBQyhdz65GYU3JG5Bu2oSdVfMmo8LPuBz7nc7A82LS11Q?cluster=devnet) |

### Tasks 2 to 5: Core NFT "The Detective #1"

Asset [`CutAT5yRLiXe6kYeR1PfKC2farJxM47R4j7abBbaFjA4`](https://explorer.solana.com/address/CutAT5yRLiXe6kYeR1PfKC2farJxM47R4j7abBbaFjA4?cluster=devnet). Image: [Irys](https://gateway.irys.xyz/J6nj2gcqn5HhcACYD7zJ8TEg5Z3XX5s9nt5n64rgaFeU), JSON [v1](https://gateway.irys.xyz/GZ1hvaU8MenWaV2mS1QuVPG6qt1pVJeQYE4iE7KjTe9k) and [v2](https://gateway.irys.xyz/87L9Gt12TDQFasDQd6qC9RDHV9dNvvuFsbQc6D8TTHQz).

| Task | Result | Transaction |
|---|---|---|
| 2. mint | 160 B, owner + update authority = my wallet | [`4QP2dL76...MV1ZCVV3`](https://explorer.solana.com/tx/4QP2dL76XRwYPFhjfnmsUShFeAEBoj5vvZmbU6zytqKyBzWNjf1HvozpnK92WFUWmSd9zj442Langzy4MV1ZCVV3?cluster=devnet) |
| 3. update | name "The Detective #1 (Case Closed)", uri v2. Account 160 to 174 B | [`5zdYbg5C...6mJwJDF1`](https://explorer.solana.com/tx/5zdYbg5CFg2Ba4pjyDVqQXHag2Wai7Xf6i4SWEMN98Rrn2STEkQBJ9XV9hfYkXZLhuNDAvF37JKG8wZX6mJwJDF1?cluster=devnet) |
| 4. transfer | owner C9bL...b64y to 8jtQ...xoas. Update authority unchanged | [`4Hpfh2RF...oebCwVZq`](https://explorer.solana.com/tx/4Hpfh2RFzH9u1LB11LGN5CQHtfuK19bVheP34abr2yezmDHdycDotdLwhnpUvF5QAZpxSzxrX5gnAHBNoebCwVZq?cluster=devnet) |
| 5. burn | 174 to 1 B. **878,840 lamports** back to the payer | [`AJ8zpXvQ...mposDj1W`](https://explorer.solana.com/tx/AJ8zpXvQiFZJXrPpDkRGF9yXzqU9XrPK9nWUmdSfDzLcrvg6PsLuKRBaXSjyFXXXNxjxgfDAihaK11mAposDj1W?cluster=devnet) |

## The lamport accounting (rent = (128 + bytes) x 5080 on devnet today)

| Account | Bytes | Pure rent | On-chain | Extra |
|---|---|---|---|---|
| Mint | 82 | 1,066,800 | 1,066,800 | none |
| ATA | 165 | 1,488,440 | 1,488,440 | none |
| Token Metadata PDA | 607 | 3,733,800 | 13,733,800 | 0.01 SOL Token Metadata create fee |
| Core asset (mint) | 160 | 1,463,040 | 2,963,040 | 0.0015 SOL Core create fee |
| Core asset (after update) | 174 | 1,534,160 | 3,034,160 | same 0.0015 SOL |
| Core asset (after burn) | 1 | 655,320 | 2,155,320 | the fee stays in the burned account |

Burn: the asset went from 3,034,160 to 2,155,320 lamports (-878,840 = 173 bytes x 5080). The payer wallet went up by 868,840: the 878,840 rent minus a 10,000 lamport fee (2 signatures x 5,000). The owner wallet got nothing. The account keeps 1 byte, `0x00` = `Key::Uninitialized`, so the burned asset is still owned by Core.

## What I learned

- A token is not stored in your wallet. A **mint** (82 bytes) defines it, and a **token account** (165 bytes) holds a balance for one owner and one mint. The ATA is just the token account address everyone can derive.
- `createAccount` + `initializeMint` go in one transaction. If init fails, the create rolls back too.
- Use the idempotent ATA instruction so scripts can be re-run, and `transferChecked` so a wrong mint or decimals fails loudly.
- Metaplex Core collapses an NFT into one account. Transfer changes the `owner` field inside it (no token accounts to create or close), and update resizes the account to fit the new name and uri.
- Owner and update authority are different roles. After the transfer my wallet stayed the update authority, but the burn had to be signed by the new owner (the receiver), while my wallet only paid the fee.
- "Reclaim rent" is precise accounting: the freed rent goes to the **payer** account of the burn instruction, and the protocol fees are not refunded.

## Security

- No keypair is committed. `.gitignore` covers `*wallet*.json`, `*keypair*.json` and `id.json`, and `src/wallet.ts` reads keys from outside the repo.
- Devnet only.

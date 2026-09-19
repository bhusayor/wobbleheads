# Wobbleheads

An interactive Wobbleheads site built around the 3,333 SVGs in `../images`.

## Local development

1. `npm install`
2. `python3 scripts/prepare_art.py` to copy the original artwork and extract seven-layer studio assets.
3. `npm run dev`
4. Generate the SQLite migration with `npm run db:generate` after changing `db/schema.ts`. Apply migrations to the local D1 database before testing API routes. Sites applies saved Drizzle migrations when publishing.

The local Sites sign-in uses a test account. `.dev.vars` is intentionally ignored by Git. Add `ADMIN_USER_IDS=local_seedy` there if you need to test admin controls.

## Hosted configuration

Set these runtime values in Sites before opening quests to the public:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USER_IDS` | Comma-separated authenticated user IDs allowed into `/admin` and its API. Required for admin access. |
| `X_URL` | Official X profile URL. Enables the follow task. |
| `DISCORD_URL` | Official Discord URL. Enables the join task. |
| `BLOCKCHAIN` | `evm` or `solana`; controls wallet validation. Defaults to `evm`. |
| `WL_THRESHOLD` | XP required to apply for WL. Defaults to `150`. |
| `MINT_DATE`, `MINT_PRICE`, `CONTRACT_ADDRESS` | Optional announcement details. Leave blank until confirmed. |

Admins can edit public links, task availability, XP rewards, WL threshold, blockchain, and announcement details in `/admin`. Results stay unpublished until an admin publishes them. The leaderboard shows only opt-in names and can be locked to a snapshot.

Social actions, fan art, referrals, and WL approvals require manual admin review. The site does not claim to verify X or Discord accounts automatically. Fan art is submitted as an HTTPS link, so no upload storage is required.

## Checks

`npx tsc --noEmit` and `npm run build` validate source. `node scripts/smoke-test.mjs` exercises the local test account, D1 XP records, rarity limit, symbol badge, task review, WL approval, result privacy, and CSV export. It writes disposable records to the local D1 database and expects the `local_seedy` test admin ID.

# Last Changes

## Latest Repository-Level Actions

### 1. DeepSeek report rollover automation added

- added `server/reporting/roll-deepseek-reports.mjs` as the repo-native CLI for archiving the previous `docs/lastchanges.md` snapshot into `docs/fordeepseek.md`;
- added npm command `npm run report:deepseek -- --source <snapshot.md> --title <entry title>` for the rollover flow.

### 2. Docs auto-sync automation added for GitHub

- added `npm run docs:sync` to normalize all markdown files under `docs/`;
- added GitHub workflow `Docs Sync` to run on `main` and commit refreshed `docs/` content back to the repository when markdown normalization changes the docs tree.

### 3. DeepSeek approval gate added for non-doc changes

- added GitHub workflow `DeepSeek Approval Gate` for pull requests;
- non-doc changes now require the `deepseek-approved` label before the gate passes;
- docs-only changes remain allowed without that approval label.

### 4. Release announcement and governance docs added

- added `docs/release-announcement-pantheon-1.0.md` with short, standard, and Telegram-ready announcement text;
- added `docs/deepseek-approval-policy.md` describing the merge policy and docs update workflow.

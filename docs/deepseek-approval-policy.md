# DeepSeek Approval Policy

## Rule

Changes that modify the project outside `docs/`, `README.md`, or the pull request template must be treated as project changes and require explicit DeepSeek approval before merge.

## GitHub Enforcement

- pull requests with docs-only changes can proceed without the approval label;
- pull requests with non-doc changes must carry the `deepseek-approved` label;
- the workflow `DeepSeek Approval Gate` fails when non-doc changes are present and the label is missing.

## Docs Automation

The workflow `Docs Sync` runs on GitHub for `main` and normalizes markdown files under `docs/`.
If formatting or generated markdown content changes during that workflow, GitHub commits the refreshed `docs/` tree back to the repository automatically.

## Local Update Flow

1. Prepare a new markdown snapshot for `lastchanges.md`.
2. Run `npm run report:deepseek -- --source <snapshot.md> --title <entry title>`.
3. Commit and push the result.
4. GitHub normalizes the `docs/` tree automatically through `Docs Sync`.

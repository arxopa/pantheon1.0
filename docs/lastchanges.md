# Last Changes

## Latest Repository-Level Actions

### 1. Branch-protection-compatible docs sync finalized

- changed `Docs Sync` so it now runs on pull requests and writes normalized `docs/` updates back to the PR source branch instead of pushing directly to `main`;
- this makes automatic GitHub-side docs normalization compatible with strict protected-branch rules.

### 2. DeepSeek approval gate made branch-protection-ready

- updated `DeepSeek Approval Gate` so it also runs on pushes to `main` as a no-op context publisher and keeps real enforcement on pull requests;
- this makes the approval gate visible as a stable GitHub status check that can be required by branch protection.

### 3. Strict DeepSeek-governed merge policy prepared for enforcement

- updated the DeepSeek approval policy so non-doc changes must go through a pull request branch, pass required checks, and carry DeepSeek approval before merge;
- this is the documented merge path for project changes once direct bypass of branch protection is disabled.

### 4. Repository path document added for DeepSeek

- added `docs/gitpath.md` with the full local repository path, Git remote URL, and public GitHub repository URL;
- updated `docs/pantheon.md` so the report set explicitly includes `gitpath.md`.

### 5. Docs-wide formatting contract completed

- expanded `format` and `format:check` to cover `.github/workflows/*.yml` and `docs/**/*.md` instead of a partial hand-picked file list;
- normalized existing markdown files in `docs/` that were previously outside the standard formatting gate, so the whole docs tree now participates in automated GitHub updates cleanly.

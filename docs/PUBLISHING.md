# Publishing to npm from GitHub Actions

Every push to `main` runs [`.github/workflows/publish.yml`](../.github/workflows/publish.yml). It publishes
`algorand-authentication-component-vue` to <https://www.npmjs.com/package/algorand-authentication-component-vue>
**when the version in `algorand-authentication-component-vue/package.json` is not on npm yet**. Pushes that do not
change the version (docs, demo, tests) finish green with a notice "already on npm – nothing to publish", so you never
get failed runs for normal work.

```
push to main ─► version already on npm? ── yes ─► stop (green)
                         │ no
                         ▼
        install · build · lint · type-check · unit tests
                         ▼
        npm publish --provenance  (uses the NPM_TOKEN secret)
                         ▼
        git tag vX.Y.Z + GitHub release with generated notes
```

## One-time setup (about 5 minutes)

### 1. Make sure the npm account can publish the package

Use an npm account that is a maintainer of the package (check with `npm owner ls algorand-authentication-component-vue`;
add maintainers with `npm owner add <user> algorand-authentication-component-vue`). If you publish under an organization,
the account needs the **write** role for the package.

### 2. Create an npm access token

1. Sign in at <https://www.npmjs.com> → click your avatar → **Access Tokens** → **Generate New Token** → **Granular Access Token**.
2. Fill in:
   - **Token name**: `github-actions-algorand-authentication-component-vue`
   - **Expiration**: npm limits how long a token that can publish may live (the form shows the maximum). Put the renewal date in your calendar – or use [trusted publishing](#alternative-without-a-stored-secret-npm-trusted-publishing), which has nothing to rotate.
   - **Packages and scopes**: **Read and write**, restricted to **Only select packages and scopes** → `algorand-authentication-component-vue`.
   - **Bypass two-factor authentication (2FA)**: tick it (CI cannot type a one-time code). If your npm account enforces 2FA for
     writes, this box is what lets the token publish; the token itself stays limited to this one package.
3. **Generate token** and **copy it now** – npm shows it only once. It starts with `npm_`.

> Never commit the token, paste it into an issue, or put it in a workflow file. It belongs only in GitHub secrets.

### 3. Add the token as a GitHub secret

1. Open the repository <https://github.com/ludovit-scholtz/algorand-authentication-component-vue>.
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
3. **Name**: `NPM_TOKEN` (exactly – the workflow reads `secrets.NPM_TOKEN`). **Secret**: paste the token. **Add secret**.

Command-line alternative (needs the GitHub CLI and admin access to the repo):

```bash
gh secret set NPM_TOKEN --repo ludovit-scholtz/algorand-authentication-component-vue
# paste the token when prompted and press Enter (finish with Ctrl+D, or Ctrl+Z then Enter on Windows)
```

### 4. Check the repository permissions

The workflow requests the permissions it needs itself (`contents: write` for the tag and release, `id-token: write` for
provenance), so the defaults normally just work. If you restricted Actions: **Settings → Actions → General** must allow
GitHub-owned actions plus `pnpm/action-setup`, and *Workflow permissions* must not be locked below what the workflow requests
(choose **Read and write permissions** if the tag step fails with `403`).

If you protect `main` with a ruleset, nothing needs to bypass it: the workflow never commits to `main` (it only pushes a tag).

### 5. Publish your first release

1. Bump the version in a pull request (see [Releasing](#releasing)). For this rewrite that is `3.0.0`.
2. Merge it into `main`.
3. Open **Actions** → **Publish to npm** and watch the run. On success the package appears on npm with a green
   **Provenance** badge and a `v3.0.0` GitHub release is created.

## Releasing

1. Create a branch and change `"version"` in `algorand-authentication-component-vue/package.json` following
   [semver](https://semver.org): patch for fixes, minor for backwards-compatible features, major for breaking changes.
   (Optionally keep `algorand-authentication-demo/package.json` and the root `package.json` in step.)
2. Add an entry to [`algorand-authentication-component-vue/CHANGELOG.md`](../algorand-authentication-component-vue/CHANGELOG.md).
3. Open a PR; CI (`ci.yml`) must be green. Merge it.
4. The merge to `main` triggers the publish. You can also re-run it from **Actions → Publish to npm → Run workflow**.

npm versions are immutable: you cannot overwrite or reuse a version, even after unpublishing. If a release is broken,
publish a new patch version (and optionally `npm deprecate algorand-authentication-component-vue@<bad> "use <good>"`).

## Optional: approval before every publish

Create a GitHub **environment** so a human must approve the publish step:

1. **Settings** → **Environments** → **New environment** → name it `npm-publish`.
2. Tick **Required reviewers** and add yourself (and/or teammates).
3. Optionally move the secret there: add `NPM_TOKEN` as an **environment secret** instead of a repository secret, so only
   this job can read it.
4. In `publish.yml` uncomment the line `environment: npm-publish`.

## Alternative without a stored secret: npm trusted publishing

npm can trust the workflow directly via OpenID Connect – no token to create, store or rotate.

1. On <https://www.npmjs.com/package/algorand-authentication-component-vue> → **Settings** → **Trusted Publisher** →
   **GitHub Actions**: *Organization or user* `ludovit-scholtz`, *Repository* `algorand-authentication-component-vue`,
   *Workflow filename* `publish.yml`, *Environment* (leave empty, or `npm-publish` if you use one).
2. In `publish.yml` delete the `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` lines of the *Publish* step. The workflow
   already has `id-token: write`, and Node 24 ships an npm CLI that supports trusted publishing.
3. Remove the `NPM_TOKEN` secret and revoke the token on npm.

Use this once the package exists on npm (trusted publishers are configured per existing package).

## Troubleshooting

| Symptom (in the *Publish* step)                          | Cause and fix                                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm error code ENEEDAUTH` / `need auth`                 | Secret missing or misspelled. It must be called `NPM_TOKEN` in *Settings → Secrets and variables → Actions*. |
| `E401 Unauthorized`                                      | Token expired or revoked. Generate a new one and update the secret.                                        |
| `E403 … you do not have permission` / `2FA required`     | The token is not **Read and write** for this package, the npm account is not a maintainer, or **Bypass 2FA** was not ticked. Recreate the token (step 2). |
| `E403 … cannot publish over the previously published versions` | That version already exists on npm. Bump the version (the workflow normally skips this case before publishing). |
| `E422 … Error verifying sigstore provenance bundle` / repository URL mismatch | `repository.url` in `package.json` must be `git+https://github.com/ludovit-scholtz/algorand-authentication-component-vue.git` and the repo must be public. |
| `Unable to get ACTIONS_ID_TOKEN_REQUEST_URL`             | The workflow lost `permissions: id-token: write`, or the repo restricts workflow permissions.              |
| `ERR_PNPM_OUTDATED_LOCKFILE`                             | Run `pnpm install` locally and commit `pnpm-lock.yaml`.                                                    |
| Run is green but nothing was published                   | Expected: the version was already on npm. Check the notice at the top of the run, bump the version, merge. |
| Tag step fails with `403`                                | Allow *Read and write permissions* for workflows (Settings → Actions → General) or remove the tag step.   |

To see exactly what will be published without releasing, run from `algorand-authentication-component-vue/`:

```bash
pnpm build
npm pack --dry-run
```

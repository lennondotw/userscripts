# userscripts

Personal collection of Tampermonkey / Violentmonkey user scripts, organized by product.

## Scripts

| Product                   | Script                                                                            | Install                                                                                                                           | Greasy Fork         |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Feishu Minutes (飞书妙记) | [Copy TXT to Clipboard](userscripts/feishu-minutes/copy-txt-to-clipboard.user.js) | [Install](https://raw.githubusercontent.com/lennondotw/userscripts/main/userscripts/feishu-minutes/copy-txt-to-clipboard.user.js) | _not yet published_ |

Each script's metadata (`@updateURL` / `@downloadURL`) points at the raw file
on `main`, so Tampermonkey will auto-update directly from GitHub — Greasy
Fork is optional.

## Install (direct from GitHub)

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey).
2. Click an **Install** link in the table above. The userscript manager picks
   up the `.user.js` extension and opens the install dialog.
3. Save. From then on, the manager checks `@updateURL` every ~24h.

## Publishing to Greasy Fork (one-time per script)

The CI workflow auto-bumps `@version` on each push to `main`; once a script
is configured on Greasy Fork with a sync URL, GF polls the raw GitHub URL
and republishes when the timestamp advances.

1. Go to <https://greasyfork.org/scripts/new> and paste the script source.
2. After submission, open the script's **Sync** tab.
3. Set **Sync URL** to the same URL as `@downloadURL`, e.g.
   `https://raw.githubusercontent.com/lennondotw/userscripts/main/userscripts/feishu-minutes/copy-txt-to-clipboard.user.js`.
4. Save. GF will sync within a few hours of each version bump.
5. Update the **Greasy Fork** column in this README with the new script's URL.

## How auto-publish works

`.github/workflows/release.yml` runs on every push to `main`:

1. Mints a short-lived installation token for the `Code Pip` GitHub App
   (slug `code-pip`) via [`actions/create-github-app-token`][app-token-action].
2. Looks at the diff between `before` and `after` SHAs.
3. For each `*.user.js` that changed, rewrites the `@version` line to
   `YYYY.MM.DD.HHmm` (UTC).
4. Commits & pushes back as `<app-slug>[bot]` using the App token.

The App is in the `main` ruleset's bypass list — that's why the push goes
through despite "PR required" being enforced. Personal repos **cannot** put
the built-in `github-actions[bot]` integration in the bypass list, so a
user-owned App is the only way to keep strict branch protection while still
auto-stamping. See [First-time setup](#first-time-setup) for how to create
and install the App.

An `if:` guard on the job skips the workflow run triggered by the bot's
own stamping commit. (Unlike `GITHUB_TOKEN`, App-token pushes do retrigger
workflows, so the guard is load-bearing here.)

[app-token-action]: https://github.com/actions/create-github-app-token

Greasy Fork polls the raw `@downloadURL`; when it sees a new `@version`, it
republishes. Tampermonkey/Violentmonkey clients check `@updateURL` on their
own schedule and prompt the user to update.

## Layout

```
userscripts/                        # repo root
├── userscripts/                    # all userscripts live here, one folder per product
│   └── feishu-minutes/
│       └── copy-txt-to-clipboard.user.js
├── scripts/                        # repo tooling (not Tampermonkey scripts)
│   └── stamp-versions.mjs          # used by Release workflow
├── .github/workflows/
│   ├── ci.yml                      # format + typecheck on PR/push
│   └── release.yml                 # stamp + commit @version
├── oxfmt.config.ts                 # mirrors the parent platform repo's style
├── package.json                    # pnpm, no runtime deps
└── tsconfig.json                   # allowJs + checkJs for JSDoc-typed scripts
```

A new script is just a new file under the right product folder in
`userscripts/`. The CI doesn't need to know about it — `tsc` picks up
`**/*.user.js`, oxfmt formats everything, and the release workflow stamps
whatever changed.

## Development

```bash
pnpm install   # also runs husky install via `prepare`

# Lint / typecheck (uses //@ts-check + JSDoc in each .user.js)
pnpm typecheck

# Format
pnpm format         # write
pnpm format:check   # check

# Everything CI runs
pnpm check
```

### Commit hygiene

- **commitlint** enforces [Conventional Commits](https://www.conventionalcommits.org/)
  on `commit-msg` (free-form scope, standard type list).
- **lint-staged** runs `oxfmt --write` on staged JS / TS / JSON / MD / YAML
  files on `pre-commit`.
- Hooks live in `.husky/`; `pnpm install` wires them up via the `prepare`
  script.

Examples that pass:

```
feat: copy txt to clipboard
fix(feishu-minutes): handle empty transcript response
chore: stamp userscript versions
```

### Adding a new script

1. `mkdir userscripts/<product>/` if it doesn't exist yet.
2. Create `userscripts/<product>/<short-name>.user.js`.
3. Top of the file:

   ```js
   // ==UserScript==
   // @name         <Product>: <Short description>
   // @namespace    https://github.com/lennondotw/userscripts
   // @version      0.0.0
   // @match        https://<host>/<path>/*
   // @grant        none
   // @updateURL    https://raw.githubusercontent.com/lennondotw/userscripts/main/userscripts/<product>/<short-name>.user.js
   // @downloadURL  https://raw.githubusercontent.com/lennondotw/userscripts/main/userscripts/<product>/<short-name>.user.js
   // @license      MIT
   // ==/UserScript==

   // @ts-check
   ;(function () {
     'use strict'
     // ...
   })()
   ```

4. Add a row to the **Scripts** table above.
5. Open a PR. CI runs format + typecheck. After merge, the release workflow
   stamps `@version`.
6. (Optional) Publish to Greasy Fork following the section above.

## First-time setup

The release workflow needs to push back to a branch-protected `main`. The
only actor type a personal-account repo can bypass-list for that purpose
is a user-owned GitHub App. Create one shared App and reuse it across every
personal repo that needs the same automation.

### 1. Create the GitHub App (one time, ever)

1. Open <https://github.com/settings/apps/new>.
2. Fill the form:

   | Field                             | Value                                                                                     |
   | --------------------------------- | ----------------------------------------------------------------------------------------- |
   | GitHub App name                   | `Code Pip`                                                                                |
   | Description                       | `Personal automation bot — version stamping, format fixes, and similar repo maintenance.` |
   | Homepage URL                      | `https://github.com/lennondotw`                                                           |
   | Identifying and authorizing users | (leave empty)                                                                             |
   | Post installation                 | (leave empty)                                                                             |
   | Webhook → Active                  | **unchecked**                                                                             |
   | Repository permissions → Contents | **Read and write**                                                                        |
   | Repository permissions → Metadata | Read-only (default)                                                                       |
   | Organization permissions          | all No access                                                                             |
   | Account permissions               | all No access                                                                             |
   | Subscribe to events               | none                                                                                      |
   | Where can this be installed?      | **Only on this account**                                                                  |

3. **Create GitHub App**. Slug becomes `code-pip`; commit author will be
   `code-pip[bot]`.
4. On the App's settings page, copy the **App ID** (numeric).
5. Scroll to **Private keys** → **Generate a private key** → a `.pem` file
   downloads to your `~/Downloads`. Keep this file — you'll reuse it for
   every repo.
6. Left sidebar → **Install App** → **Install** → **Only select
   repositories** → tick `userscripts` (and any other repo you want to
   automate) → **Install**.

### 2. Put the credentials into the repo

```bash
# Client ID is what the workflow uses to mint installation tokens
# (GitHub recommends `client-id` over `app-id` for new setups).
gh variable set BOT_CLIENT_ID -R lennondotw/userscripts -b 'Iv23...'

# Private key is sensitive — paste the entire .pem including
# -----BEGIN/END----- markers.
gh secret   set BOT_PRIVATE_KEY -R lennondotw/userscripts \
  < ~/Downloads/code-pip.*.private-key.pem
```

The values are the **same across every repo** that uses Code Pip.

The numeric App ID is only needed for the ruleset bypass call, and is
hardcoded as `CODE_PIP_APP_ID` in `scripts/setup-github.sh` (it's a public
identifier, not a secret).

### 3. Apply branch protection + merge policy

`scripts/setup-github.sh` is idempotent — safe to re-run if a setting drifts.

```bash
bash scripts/setup-github.sh
```

It:

- Sets the repo's merge strategy to merge-commits only.
- Creates the `main-protection` ruleset (PR required, CI required, no
  force-push, no deletion).
- Adds Code Pip as an `Integration` bypass actor on that ruleset (using
  the numeric App ID embedded in the script).

### Reusing Code Pip on another repo

For each new repo where you want the same `@version` stamping (or other
Code Pip automation):

1. **Install** the existing App on the new repo (App settings →
   Install App → Configure → tick the new repo).
2. **Copy** `BOT_CLIENT_ID` (variable) and `BOT_PRIVATE_KEY` (secret) into
   the new repo, same values as in `userscripts`.
3. **Run** an equivalent of `setup-github.sh` for that repo — typically
   you'll fork this one and bump the `OWNER` / `REPO` / `CI_CHECK_CONTEXT`
   constants. `CODE_PIP_APP_ID` stays the same. The Integration bypass
   works the same.

## License

[MIT](./LICENSE)

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

1. Looks at the diff between `before` and `after` SHAs.
2. For each `*.user.js` that changed, rewrites the `@version` line to
   `YYYY.MM.DD.HHmm` (UTC).
3. Commits & pushes back as `github-actions[bot]`.

The bot's push uses `GITHUB_TOKEN`, which by design **does not retrigger
workflows**, so there's no loop. The `if:` guard on the job also skips runs
authored by the bot as a belt-and-suspenders safety.

Branch protection on `main` requires the bot to be in the **bypass list**
(see the [setup section](#repo-bootstrap-once-the-repo-exists-on-github)).
Without it, the stamp push is rejected.

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

## Repo bootstrap (once the repo exists on GitHub)

After `gh repo create lennondotw/userscripts --public --source=. --push`, run
`scripts/setup-github.sh` once. It enforces the per-user policy
(merge commits only, branch protection, `github-actions[bot]` bypass for
the release stamping workflow).

```bash
bash scripts/setup-github.sh
```

Idempotent — safe to re-run if a setting drifted.

## License

[MIT](./LICENSE)

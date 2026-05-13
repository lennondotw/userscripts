#!/usr/bin/env node
// @ts-check

/**
 * Stamp `@version` on every `*.user.js` file that changed since the previous
 * push. Runs in GitHub Actions on push to main.
 *
 * Version format: `YYYY.MM.DD.HHmm` (UTC). Greasy Fork treats anything
 * lexicographically greater than the last sync as a new release, so the
 * timestamp scheme is monotonic and free of manual bookkeeping.
 *
 * Re-trigger safety: when this workflow pushes back with `GITHUB_TOKEN`,
 * GitHub deliberately suppresses workflow re-runs, so we won't loop.
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

/** @returns {string[]} list of `*.user.js` paths changed in this push */
function listChangedUserScripts() {
  const before = process.env.GITHUB_EVENT_BEFORE || process.env.BEFORE || ''
  const after = process.env.GITHUB_SHA || process.env.AFTER || 'HEAD'

  // GH sets BEFORE to all-zeros on first push of a branch — fall back to all files.
  const isInitial = !before || /^0+$/.test(before)
  const range = isInitial ? null : `${before}..${after}`

  try {
    const cmd = range ? `git diff --name-only --diff-filter=ACMR ${range}` : `git ls-files`
    const out = execSync(cmd, { encoding: 'utf8' })
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter((f) => f.endsWith('.user.js'))
  } catch (err) {
    console.error('Failed to list changed files:', err)
    return []
  }
}

/**
 * @param {Date} d
 * @returns {string}
 */
function fmtVersion(d) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}.` +
    `${pad(d.getUTCMonth() + 1)}.` +
    `${pad(d.getUTCDate())}.` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`
  )
}

function main() {
  const changed = listChangedUserScripts()
  if (changed.length === 0) {
    console.log('No userscripts changed; nothing to stamp.')
    return
  }

  const version = fmtVersion(new Date())
  let touched = 0

  for (const file of changed) {
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      console.warn(`Skipping ${file}: not readable (deleted?).`)
      continue
    }

    if (!/^\/\/\s*@version\s+/m.test(text)) {
      console.warn(`Skipping ${file}: no @version line in metadata block.`)
      continue
    }

    const next = text.replace(/^(\/\/\s*@version\s+).*$/m, `$1${version}`)
    if (next === text) continue

    writeFileSync(file, next)
    touched += 1
    console.log(`stamped ${file} -> ${version}`)
  }

  console.log(`Done. ${touched} file(s) updated.`)
}

main()

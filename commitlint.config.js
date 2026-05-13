/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  // Free-form scope: no scope-enum rule. Conventional Commits types still
  // enforced (feat, fix, chore, docs, refactor, test, ci, build, perf, style, revert).
}

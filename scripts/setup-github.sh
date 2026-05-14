#!/usr/bin/env bash
#
# One-time GitHub bootstrap for this repo.
#
# Enforces:
#   - Merge commits only (no squash, no rebase) on PRs.
#   - Auto-merge available, branch deleted on merge.
#   - Ruleset on `main`: PR required, CI required, no force pushes, no deletion.
#   - A personal GitHub App (Code Pip, slug `code-pip`) bypasses the ruleset
#     so `.github/workflows/release.yml` can stamp @version back to main.
#     The same App is reused across every personal repo with this automation.
#
# The numeric App ID is required by the ruleset bypass API (actor_type
# `Integration` takes a numeric actor_id, not the App's client-id). It's
# hardcoded below because (a) it's a public identifier, not a secret, and
# (b) Code Pip is account-wide and won't change. Override with
# `CODE_PIP_BOT_APP_ID=<n> bash scripts/setup-github.sh` if you ever fork
# to a different App.
#
# Idempotent: PATCH always overwrites; the ruleset is recreated if a
# matching one already exists.

set -euo pipefail

OWNER='lennondotw'
REPO='userscripts'
DEFAULT_BRANCH='main'
RULESET_NAME='main-protection'
# Required status check context — must match the job name in ci.yml.
CI_CHECK_CONTEXT='check'
# Code Pip's numeric App ID. Override via env if needed.
CODE_PIP_APP_ID=3708908

APP_ID="${CODE_PIP_BOT_APP_ID:-${CODE_PIP_APP_ID}}"
if ! [[ "${APP_ID}" =~ ^[0-9]+$ ]]; then
  echo "error: CODE_PIP_BOT_APP_ID '${APP_ID}' is not numeric." >&2
  exit 1
fi
echo "==> Using App ID ${APP_ID}"

echo "==> Configuring repo merge strategy"
gh api -X PATCH "/repos/${OWNER}/${REPO}" \
  -F allow_merge_commit=true \
  -F allow_squash_merge=false \
  -F allow_rebase_merge=false \
  -F allow_auto_merge=true \
  -F delete_branch_on_merge=true \
  --silent
echo "    merge commits only, auto-merge on, branch deleted on merge"

echo "==> Reconciling ruleset '${RULESET_NAME}' on ${DEFAULT_BRANCH}"
existing_id="$(
  gh api "/repos/${OWNER}/${REPO}/rulesets" \
    --jq ".[] | select(.name == \"${RULESET_NAME}\") | .id" \
    2>/dev/null | head -n1 || true
)"
if [[ -n "${existing_id}" ]]; then
  echo "    deleting existing ruleset id=${existing_id}"
  gh api -X DELETE "/repos/${OWNER}/${REPO}/rulesets/${existing_id}" --silent
fi

tmpfile="$(mktemp)"
trap 'rm -f "${tmpfile}"' EXIT
cat >"${tmpfile}" <<JSON
{
  "name": "${RULESET_NAME}",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [
    {
      "actor_id": ${APP_ID},
      "actor_type": "Integration",
      "bypass_mode": "always"
    }
  ],
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/${DEFAULT_BRANCH}"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "${CI_CHECK_CONTEXT}" }
        ]
      }
    }
  ]
}
JSON

gh api -X POST "/repos/${OWNER}/${REPO}/rulesets" --input "${tmpfile}" --silent
echo "    ruleset active: PR required, CI must pass, no force-push, no deletion"
echo "    App ID ${APP_ID} is in bypass list (Integration actor)"

echo ""
echo "Done. Verify:"
echo "  gh api /repos/${OWNER}/${REPO} --jq '{merge_commit: .allow_merge_commit, squash: .allow_squash_merge, rebase: .allow_rebase_merge}'"
echo "  gh api /repos/${OWNER}/${REPO}/rulesets"

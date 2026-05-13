#!/usr/bin/env bash
#
# One-time GitHub bootstrap for this repo.
#
# Enforces:
#   - Merge commits only (no squash, no rebase) on PRs.
#   - Auto-merge available, branch deleted on merge.
#   - Ruleset on `main`: PR required, CI required, no force pushes, no deletion.
#   - `github-actions[bot]` (App ID 15368) bypasses the ruleset so
#     `.github/workflows/release.yml` can stamp @version back to main.
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
# GitHub Actions GitHub App ID. Same value across all repos.
GITHUB_ACTIONS_APP_ID=15368

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
existing_id=$(
  gh api "/repos/${OWNER}/${REPO}/rulesets" \
    --jq ".[] | select(.name == \"${RULESET_NAME}\") | .id" \
    2>/dev/null | head -n1 || true
)
if [[ -n "${existing_id}" ]]; then
  echo "    deleting existing ruleset id=${existing_id}"
  gh api -X DELETE "/repos/${OWNER}/${REPO}/rulesets/${existing_id}" --silent
fi

payload=$(cat <<JSON
{
  "name": "${RULESET_NAME}",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [
    {
      "actor_id": ${GITHUB_ACTIONS_APP_ID},
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
)

echo "${payload}" | gh api -X POST "/repos/${OWNER}/${REPO}/rulesets" \
  --input - --silent
echo "    ruleset active: PR required, CI must pass, no force-push, no deletion"
echo "    github-actions[bot] (App ID ${GITHUB_ACTIONS_APP_ID}) is in bypass list"

echo ""
echo "Done. Verify:"
echo "  gh api /repos/${OWNER}/${REPO} --jq '{merge_commit: .allow_merge_commit, squash: .allow_squash_merge, rebase: .allow_rebase_merge}'"
echo "  gh api /repos/${OWNER}/${REPO}/rulesets"

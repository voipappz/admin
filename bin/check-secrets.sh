#!/usr/bin/env bash
# Scan every file git would publish for anything shaped like a live credential.
#
# A public repo makes a leaked credential permanent: GitHub's fork and cache
# network keeps a blob reachable after a force-push, and scrapers index new
# public repos within minutes. This is the cheap check before a push, not the
# audit after someone else finds it.
set -e -o pipefail

# Patterns are shape-based, so a NEW token of a known kind is caught without
# anyone adding it here.
PATTERNS='(CCIPAT_[A-Za-z0-9_]{10,}'          # CircleCI personal API token
PATTERNS+='|gh[pousr]_[A-Za-z0-9]{20,}'       # GitHub token
PATTERNS+='|github_pat_[A-Za-z0-9_]{20,}'     # GitHub fine-grained PAT
PATTERNS+='|AKIA[0-9A-Z]{16}'                 # AWS access key id
PATTERNS+='|xox[baprs]-[A-Za-z0-9-]{10,}'     # Slack token
PATTERNS+='|sk-[A-Za-z0-9]{32,}'              # OpenAI-style secret key
PATTERNS+='|-----BEGIN [A-Z ]*PRIVATE KEY-----)'

# Files that legitimately contain the SHAPE of a secret and never a value:
# the example env file, this scanner, and the lockfile's integrity hashes.
skip_file='(\.example$|^bin/check-secrets\.sh$|^Makefile$|^package-lock\.json$)'

# A UI placeholder is not a key. `placeholder="-----BEGIN PRIVATE KEY-----\n..."`
# in a form field is the app ASKING for one, which is the opposite of leaking.
skip_line='(placeholder=|example|EXAMPLE|dummy|DUMMY|<your|YOUR_|xxxxx|\\n\.\.\.)'

hits=$(git ls-files --cached --others --exclude-standard \
       | grep -vE "$skip_file" \
       | xargs -r grep -nIE "$PATTERNS" 2>/dev/null \
       | grep -vE "$skip_line" || true)

if [ -n "$hits" ]; then
  echo "$hits"
  echo
  echo "^^ possible credential in a file git WOULD publish."
  echo "   Move the value to .env (gitignored) and reference it by name."
  exit 1
fi

if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo ".env is TRACKED. Untrack it before pushing:  git rm --cached .env"
  exit 1
fi

echo "secrets: nothing credential-shaped in anything git would publish"

---
applyTo: "scripts/**"
---

# Shell Script Rules

## Always validate before committing

Run both checks on every `scripts/*.sh` change — they catch different classes of bugs:

```bash
bash -n scripts/myscript.sh      # syntax check — bad substitutions, mismatched braces
shellcheck scripts/myscript.sh   # semantic check — unquoted vars, bad redirects, etc.
```

Install shellcheck with `brew install shellcheck`.

## Required flags

Every script must start with:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `set -e` — exit immediately on any non-zero exit code
- `set -u` — treat unset variables as errors
- `set -o pipefail` — a pipeline fails if any command in it fails

## Section divider style

Use this exact style for section headers inside scripts:

```bash
# ── Section Name ──────────────────────────────────────────────────────────────
```

## Variable safety

- Always quote variables: `"$var"` not `$var` — handles spaces and empty strings
- Use `${var:-default}` for variables that may be unset
- Use `$()` for command substitution, not backticks
- Use `[[ ]]` for conditionals, not `[ ]`
- Never use `status` as a variable name — it is read-only in zsh

## Logging convention

Scripts that write to a logfile should tee output:

```bash
exec > >(tee -a "$LOG_FILE") 2>&1
```

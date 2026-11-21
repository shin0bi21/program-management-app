# shellcheck shell=bash disable=SC2034
# Define help and argument validation for the deployment entrypoint.

# Print deployment modes without contacting Docker, Git remotes, or the database.
# Example: bash scripts/deploy/main.sh --help
usage() {
  cat <<'USAGE'
Usage: bash scripts/deploy/main.sh
       bash scripts/deploy/main.sh --preview

Deploy the latest main revision using recorded component revisions.
  --preview  Fetch and classify main in temporary Git storage without deploying.
  -h, --help Show this help without acquiring deployment resources.
USAGE
}

# Validate CLI tokens before acquiring the deployment lock.
# Example: parse_arguments --preview sets PREVIEW_ONLY=true.
parse_arguments() {
  local argument
  for argument in "$@"; do
    case "$argument" in
      -h|--help) usage; exit 0 ;;
      --preview) PREVIEW_ONLY=true ;;
      *) printf "ERROR: Unknown deploy argument '%s'\n" "$argument" >&2; exit 2 ;;
    esac
  done
}

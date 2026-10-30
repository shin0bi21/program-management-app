# shellcheck shell=bash disable=SC2034

parse_arguments() {
  local argument
  for argument in "$@"; do
    case "$argument" in
      --preview) PREVIEW_ONLY=true ;;
      *) echo "ERROR: Unknown deploy argument '$argument'"; exit 2 ;;
    esac
  done
}

# shellcheck shell=bash
# Fetch and classify remote main inside temporary Git storage without deploying.

# The subshell confines the temporary Git context and cleanup trap to this preview.
preview_deployment() (
  # 1. Retain transport configuration while resolving the source repository.
  local preview_root origin_url repository_config
  origin_url="$(git remote get-url origin)"
  repository_config="$(git rev-parse --git-path config)"
  case "$repository_config" in
    /*) ;;
    *) repository_config="$REPO_ROOT/$repository_config" ;;
  esac

  if [ -n "$(git --no-optional-locks -c core.fsmonitor=false status --porcelain)" ]; then
    echo "Note: local edits are excluded from preview; deployment will reject a dirty checkout."
  fi

  # 2. Isolate Git writes and cleanup in a temporary bare repository.
  preview_root="$(mktemp -d "${TMPDIR:-/tmp}/myapp-deploy-preview.XXXXXX")"
  trap 'rm -rf -- "$preview_root"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  git -c core.hooksPath=/dev/null -c gc.auto=0 -c maintenance.auto=false \
    clone --quiet --bare --shared "$REPO_ROOT" "$preview_root/repository"

  # Keep server transport settings, but confine Git writes to the temporary repository.
  # No source hooks or automatic maintenance may run during the inspection.
  # shellcheck disable=SC2317,SC2329 # Called by the sourced classifier and revision reader.
  git() {
    command git --git-dir="$preview_root/repository" \
      -c "include.path=$repository_config" -c core.bare=true \
      -c core.hooksPath=/dev/null -c gc.auto=0 -c maintenance.auto=false "$@"
  }

  # 3. Fetch the latest remote target and classify it against recorded component revisions.
  git fetch --quiet --no-tags "$origin_url" refs/heads/main
  # shellcheck disable=SC2034 # Consumed by the sourced revision classifier.
  TARGET_SHA="$(git rev-parse 'FETCH_HEAD^{commit}')"
  load_revision_state
  classify_changes

  # 4. Print the selected work and disclose the preview target boundary.
  echo "Deployment preview using current checkout tooling and the latest remote main:"
  print_deployment_summary
  echo "Checkout, deployment logs/lock, revision markers, services, and database are unchanged."
  echo "A deployment fetches main again; its target or recorded revisions may have advanced."
)

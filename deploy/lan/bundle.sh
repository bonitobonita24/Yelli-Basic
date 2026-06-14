#!/usr/bin/env bash
# deploy/lan/bundle.sh — build an offline installer tarball for the Yelli LAN edition.
#
# Run this on a machine WITH internet access (and Docker).
# The output is: dist/yelli-lan-images.tar.gz  +  dist/yelli-lan-images.manifest.txt
#
# Prerequisites:
#   - Docker (with internet)
#   - The three Yelli images must already be built and tagged locally:
#       yelli:lan           (Next.js app)
#       yelli-signaling:lan (signaling server)
#       yelli-worker:lan    (BullMQ worker)
#
# Usage:
#   bash deploy/lan/bundle.sh [--skip-pull] [--out-dir <dir>]
#
#   --skip-pull   Skip pulling third-party images (use local cache only).
#   --out-dir     Output directory (default: dist/).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

# ─── Defaults ────────────────────────────────────────────────────────────────

SKIP_PULL=false
OUT_DIR="$REPO_ROOT/dist"

# ─── Arg parsing ─────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pull) SKIP_PULL=true; shift ;;
    --out-dir)   OUT_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--skip-pull] [--out-dir <dir>]"
      echo ""
      echo "  --skip-pull   Do not pull third-party images (use local cache)."
      echo "  --out-dir     Output directory (default: dist/)."
      exit 0
      ;;
    *) err "Unknown flag: $1"; exit 1 ;;
  esac
done

mkdir -p "$OUT_DIR"

# ─── Third-party images to bundle ────────────────────────────────────────────
# NOTE: These tags use floating tags (:alpine, :latest) for consistency with the
# rest of the compose targets. For maximum reproducibility in air-gapped production
# deployments, re-pin each to a @sha256:<digest> before bundling — the manifest
# records the resolved digests so you can do this after bundle.sh runs.

THIRD_PARTY_IMAGES=(
  "postgres:16-alpine"
  "valkey/valkey:7-alpine"
  "minio/minio:latest"
  "caddy:2-alpine"
)

# ─── Yelli images (must be pre-built and tagged) ─────────────────────────────

YELLI_IMAGES=(
  "yelli:lan"
  "yelli-signaling:lan"
  "yelli-worker:lan"
)

ALL_IMAGES=("${THIRD_PARTY_IMAGES[@]}" "${YELLI_IMAGES[@]}")

# ─── Check Yelli images exist ────────────────────────────────────────────────

info "Checking Yelli images..."
MISSING_IMAGES=()
for img in "${YELLI_IMAGES[@]}"; do
  if ! docker image inspect "$img" >/dev/null 2>&1; then
    MISSING_IMAGES+=("$img")
  fi
done

if [ ${#MISSING_IMAGES[@]} -gt 0 ]; then
  err "The following Yelli images are not built/tagged locally:"
  for img in "${MISSING_IMAGES[@]}"; do
    printf '    %s\n' "$img"
  done
  echo ""
  warn "Build and tag them first, then re-run bundle.sh."
  echo ""
  echo "  How to build each image:"
  echo ""
  echo "  # Next.js app:"
  echo "  docker build -f apps/yelli/Dockerfile -t yelli:lan ."
  echo ""
  echo "  # Signaling server:"
  echo "  docker build -f apps/signaling/Dockerfile -t yelli-signaling:lan ."
  echo ""
  echo "  # BullMQ worker:"
  echo "  docker build -f packages/jobs/Dockerfile.workers -t yelli-worker:lan ."
  echo ""
  echo "  Run these from the repo root, then re-run bundle.sh."
  exit 1
fi
ok "All Yelli images present."

# ─── Pull third-party images ─────────────────────────────────────────────────

if [ "$SKIP_PULL" = false ]; then
  info "Pulling third-party images..."
  for img in "${THIRD_PARTY_IMAGES[@]}"; do
    info "  Pulling $img ..."
    docker pull "$img"
  done
  ok "Third-party images pulled."
else
  warn "Skipping image pull (--skip-pull). Using local cache."
fi

# ─── Save all images to tarball ──────────────────────────────────────────────

TAR_PATH="$OUT_DIR/yelli-lan-images.tar"
GZ_PATH="${TAR_PATH}.gz"
MANIFEST_PATH="$OUT_DIR/yelli-lan-images.manifest.txt"

info "Saving ${#ALL_IMAGES[@]} images to $TAR_PATH ..."
docker save "${ALL_IMAGES[@]}" -o "$TAR_PATH"

info "Compressing → $GZ_PATH ..."
gzip -f "$TAR_PATH"
ok "Saved: $GZ_PATH"

# ─── Compute SHA256 ──────────────────────────────────────────────────────────

info "Computing SHA256 ..."
if command -v sha256sum >/dev/null 2>&1; then
  SHA256=$(sha256sum "$GZ_PATH" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
  SHA256=$(shasum -a 256 "$GZ_PATH" | awk '{print $1}')
else
  SHA256="(sha256sum not available)"
fi
ok "SHA256: $SHA256"

# ─── Write manifest ──────────────────────────────────────────────────────────

{
  echo "# Yelli LAN Image Bundle Manifest"
  echo "# Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo ""
  echo "bundle: yelli-lan-images.tar.gz"
  echo "sha256: $SHA256"
  echo ""
  echo "# Images included:"
  echo "# ─────────────────────────────────────────────────────────────────────"
  echo "#"
  echo "# TAG                         REPO DIGEST"
  echo "# ────────────────────────    ────────────────────────────────────────"

  for img in "${ALL_IMAGES[@]}"; do
    # Resolve the repo digest (content-addressable, reproducible).
    DIGEST=$(docker inspect --format '{{index .RepoDigests 0}}' "$img" 2>/dev/null || echo "(no digest — local image)")
    printf '%-30s  %s\n' "$img" "$DIGEST"
  done

  echo ""
  echo "# NOTE: Third-party images use floating tags (:alpine, :latest)."
  echo "# For air-gapped production use, re-pin each to its digest above:"
  echo "#   image: postgres@sha256:<digest>"
  echo "# then rebuild this bundle. The digest is content-addressable and will"
  echo "# not change unless the upstream image is republished."
  echo ""
  echo "# To verify the bundle on the target machine:"
  echo "#   sha256sum dist/yelli-lan-images.tar.gz"
  echo "#   # Compare with the sha256 line above."
} > "$MANIFEST_PATH"

ok "Manifest: $MANIFEST_PATH"

echo ""
printf '══════════════════════════════════════════════════════\n'
ok " Bundle complete."
printf '\n'
printf '  Bundle:   %s\n' "$GZ_PATH"
printf '  Manifest: %s\n' "$MANIFEST_PATH"
printf '  SHA256:   %s\n' "$SHA256"
printf '\n'
printf '  Transfer dist/yelli-lan-images.tar.gz and this repo to the\n'
printf '  target (offline) PC, then run:\n'
printf '    bash deploy/lan/install.sh\n'
printf '══════════════════════════════════════════════════════\n\n'

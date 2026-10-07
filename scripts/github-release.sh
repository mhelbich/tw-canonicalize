#!/usr/bin/env bash
# Create the GitHub release for a version once it is live on npm.
# Usage: scripts/github-release.sh [vX.Y.Z]   (defaults to the tag at HEAD)
set -euo pipefail

tag="${1:-$(git describe --tags --exact-match HEAD)}"
version="${tag#v}"
name="$(node -p "require('./package.json').name")"

if [ "$(npm view "$name@$version" version 2>/dev/null)" != "$version" ]; then
  echo "$name@$version is not live on npm yet (run: npm stage approve <stage-id>)" >&2
  exit 1
fi

gh release create "$tag" --verify-tag --generate-notes --title "$tag"

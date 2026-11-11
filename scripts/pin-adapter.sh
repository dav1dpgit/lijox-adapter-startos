#!/bin/sh
# Pin the adapter release this package builds: fetch the PUBLIC adapter repo at one commit and write
# adapter-release.sha256 (the files the image runs, sha256sum -c format). The Dockerfile refuses to build when the
# commit's files differ from this list. Run from the repository root:
#   scripts/pin-adapter.sh v0.119.0 d7a520565e54b85688a42a2742b0e6867e7a1ca3
# The commit, not the tag, is what is fetched: a tag can be moved (the public v0.119.0 tag was first made on the
# 0.118.0 commit). The version must equal the commit's package.json. Then set ADAPTER_VERSION and ADAPTER_COMMIT in
# the Dockerfile to the same two values, and check the hashes against that version's row in the adapter's RELEASES.md
# (lij-adapter.js, package.json and the other files listed there must agree).
set -eu
VERSION="${1:?usage: scripts/pin-adapter.sh vX.Y.Z <commit>}"
COMMIT="${2:?usage: scripts/pin-adapter.sh vX.Y.Z <commit>}"
ROOT="$(pwd)"
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT
git init -q "$DIR/a"
git -C "$DIR/a" fetch -q --depth 1 https://github.com/dav1dpgit/lijox-lnd-adapter "$COMMIT"
git -C "$DIR/a" -c advice.detachedHead=false checkout -q FETCH_HEAD
cd "$DIR/a"
HAVE="v$(node -p 'require("./package.json").version')"
[ "$HAVE" = "$VERSION" ] || { echo "the commit's package.json says $HAVE, not $VERSION" >&2; exit 1; }
FILES=$(ls -1 | grep -E '\.(js|proto)$|^package(-lock)?\.json$|^bake-permissions.*\.json$' | grep -v '\.test\.js$' | sort)
{
  echo "# $VERSION $COMMIT"
  for f in $FILES; do sha256sum "$f"; done
  for f in $(find recover -type f 2>/dev/null | sort); do sha256sum "$f"; done
} > "$ROOT/adapter-release.sha256"
echo "pinned $VERSION ($COMMIT): $(grep -vc '^#' "$ROOT/adapter-release.sha256") files -> adapter-release.sha256"

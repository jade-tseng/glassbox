#!/bin/sh
# Vercel "Ignored Build Step" (web/vercel.json -> ignoreCommand). Runs from web/ (the project root dir).
# Exit 0 = skip this deploy, exit 1 = build. We deploy only when something under web/ changed.
# Compares against the last deployed commit when Vercel knows it (covers multi-commit pushes),
# otherwise against the previous commit.

base="$VERCEL_GIT_PREVIOUS_SHA"
if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  base="HEAD^"
fi

if git diff --quiet "$base" HEAD -- .; then
  echo "No changes under web/ since $base: skipping deploy."
  exit 0
fi
echo "web/ changed since $base: deploying."
exit 1

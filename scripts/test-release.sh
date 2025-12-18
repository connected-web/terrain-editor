#!/bin/bash
set -e

# Script to test the automated release workflow
# Usage: ./scripts/test-release.sh <version>
# Example: ./scripts/test-release.sh 0.1.3

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Error: Version required"
  echo "Usage: ./scripts/test-release.sh <version>"
  echo "Example: ./scripts/test-release.sh 0.1.3"
  exit 1
fi

TAG="v${VERSION}"

echo "🧹 Cleaning up existing release and tag for ${TAG}..."

# Delete GitHub release if it exists
if gh release view "${TAG}" &>/dev/null; then
  echo "  Deleting GitHub release ${TAG}..."
  gh release delete "${TAG}" --yes
fi

# Delete local tag if it exists
if git tag -l | grep -q "^${TAG}$"; then
  echo "  Deleting local tag ${TAG}..."
  git tag -d "${TAG}"
fi

# Delete remote tag if it exists
if git ls-remote --tags origin | grep -q "refs/tags/${TAG}$"; then
  echo "  Deleting remote tag ${TAG}..."
  git push origin ":refs/tags/${TAG}"
fi

echo ""
echo "📝 Creating new release ${TAG}..."

# Create and push tag
git tag "${TAG}" -m "Release ${TAG}"
git push origin "${TAG}"

echo ""
echo "🚀 Creating GitHub release..."

# Create GitHub release
gh release create "${TAG}" \
  --title "${TAG} - Test Release" \
  --notes "## Test Release ${VERSION}

Testing automated npm publishing with OIDC trusted publishing.

### Publishing

This release will automatically publish \`@connected-web/terrain-editor@${VERSION}\` to npm via the GitHub Actions workflow.

View package: https://www.npmjs.com/package/@connected-web/terrain-editor
View workflow: https://github.com/connected-web/terrain-editor/actions"

echo ""
echo "✅ Done! Monitor the workflow at:"
echo "   https://github.com/connected-web/terrain-editor/actions"

#!/bin/bash

# Simplified GitHub Issue Closer
REPO_OWNER="cedrickbyrd"
REPO_NAME="securebase-app"

echo "=== Closing Demo Validation Issues ==="
echo ""

# Get issues without label filter first
echo "Fetching all open issues..."
curl -s -H "Authorization: token $GITHUB_TOKEN" \
     "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/issues?state=open&per_page=100" \
     | jq -r '.[] | select(.title | contains("Demo Environment Validation Failed")) | .number' \
     | while read num; do
         echo "Closing issue #$num..."
         curl -s -X PATCH \
              -H "Authorization: token $GITHUB_TOKEN" \
              "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/issues/$num" \
              -d '{"state":"closed"}' > /dev/null
         echo "✅ Closed #$num"
         sleep 0.5
       done

echo ""
echo "✅ All done!"

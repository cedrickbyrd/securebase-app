#!/bin/bash
# Empty S3 bucket before Terraform can delete it

BUCKET_NAME="securebase-audit-logs-dev"

echo "Emptying bucket: $BUCKET_NAME"

# Delete all object versions
aws s3api list-object-versions \
  --bucket "$BUCKET_NAME" \
  --output json \
  --query 'Versions[].{Key:Key,VersionId:VersionId}' | \
jq -r '.[] | "--key \"\(.Key)\" --version-id \"\(.VersionId)\""' | \
xargs -I {} aws s3api delete-object --bucket "$BUCKET_NAME" {}

# Delete all delete markers
aws s3api list-object-versions \
  --bucket "$BUCKET_NAME" \
  --output json \
  --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' | \
jq -r '.[] | "--key \"\(.Key)\" --version-id \"\(.VersionId)\""' | \
xargs -I {} aws s3api delete-object --bucket "$BUCKET_NAME" {}

echo "Bucket emptied successfully!"

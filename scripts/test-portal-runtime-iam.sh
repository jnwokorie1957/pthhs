#!/usr/bin/env bash
# Run in Google Cloud Shell after the grants documented in docs/security/README.md.
set -euo pipefail
: "${TEST_PROJECT:?Set TEST_PROJECT to the dedicated synthetic Firebase project}"
[[ "$TEST_PROJECT" != primetimehomehealthservices ]] || { echo "Select the test project" >&2; exit 1; }
project=primetimehomehealthservices
api="portal-workforce-api@$project.iam.gserviceaccount.com"
decrypt="portal-document-decrypt@$project.iam.gserviceaccount.com"
key=(--project="$TEST_PROJECT" --location=us-central1 --keyring=portal-test --key=documents)
dir=$(mktemp -d)
trap 'rm -f "$dir/input" "$dir/cipher" "$dir/download" "$dir/output"; rmdir "$dir"' EXIT
uuid=$(cat /proc/sys/kernel/random/uuid)
object="gs://$TEST_PROJECT-portal-iam-test/portal-fixtures/$uuid.enc"
printf 'Synthetic portal IAM fixture %s\n' "$uuid" > "$dir/input"
gcloud kms encrypt "${key[@]}" --impersonate-service-account="$api" --plaintext-file="$dir/input" --ciphertext-file="$dir/cipher"
gcloud storage cp "$dir/cipher" "$object" --project="$TEST_PROJECT" --impersonate-service-account="$api" --if-generation-match=0
gcloud storage cp "$object" "$dir/download" --project="$TEST_PROJECT" --impersonate-service-account="$decrypt"
gcloud kms decrypt "${key[@]}" --impersonate-service-account="$decrypt" --ciphertext-file="$dir/download" --plaintext-file="$dir/output"
cmp "$dir/input" "$dir/output"
printf 'Synthetic KMS and object round trip passed. Fixture for administrator cleanup: %s\n' "$object"

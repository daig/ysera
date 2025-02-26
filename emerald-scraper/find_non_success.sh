#!/bin/bash

# Script to find all records in batch files that have:
# 1. A status other than "success"
# 2. No status field
# 3. No results field
# It will list the file, index in the batch, name, status, URL, and error

# Change to the emerald-scraper directory
cd "$(dirname "$0")"

# Check if objects directory exists
if [ ! -d "objects" ]; then
  echo "Error: objects directory not found"
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "Error: jq is not installed. Please install it first."
  echo "You can install it with: brew install jq (on macOS) or apt-get install jq (on Ubuntu)"
  exit 1
fi

echo "Analyzing batch files for problematic records..."
echo "----------------------------------------------"
echo "FILE | INDEX | NAME | STATUS | URL | ERROR | MISSING"
echo "----------------------------------------------"

# Process each batch file in the objects directory
for BATCH_FILE in objects/batch_results_*.json; do
  FILENAME=$(basename "$BATCH_FILE")
  
  # Use jq to find problematic records:
  # 1. Records with status other than "success"
  # 2. Records with no status field
  # 3. Records with no results field
  jq -r --arg filename "$FILENAME" '
    to_entries | 
    map(
      if .value.status != "success" and .value.status != null then
        # Case 1: Status is not success
        "\($filename) | \(.key) | \(.value.name) | \(.value.status) | \(.value.url) | \(.value.error) | "
      elif .value.status == null then
        # Case 2: No status field
        "\($filename) | \(.key) | \(.value.name) | NO_STATUS | \(.value.url) | \(.value.error) | Missing status"
      elif .value.result == null then
        # Case 3: No results field
        "\($filename) | \(.key) | \(.value.name) | \(.value.status) | \(.value.url) | \(.value.error) | Missing results"
      else
        empty
      end
    ) | 
    .[]
  ' "$BATCH_FILE"
done

echo "----------------------------------------------"
echo "Analysis complete."

# Create a CSV file with the problematic records
CSV_FILE="objects/problematic_records.csv"
echo "Creating CSV file with problematic records: $CSV_FILE"

echo "File,Index,Name,Status,URL,Error,Missing" > "$CSV_FILE"

for BATCH_FILE in objects/batch_results_*.json; do
  FILENAME=$(basename "$BATCH_FILE")
  
  # Use jq to extract problematic records to CSV format
  jq -r --arg filename "$FILENAME" '
    to_entries | 
    map(
      if .value.status != "success" and .value.status != null then
        # Case 1: Status is not success
        "\($filename),\(.key),\"\(.value.name | gsub("\"";"''"))\",\(.value.status),\"\(.value.url | gsub("\"";"''"))\",\"\(.value.error | gsub("\n";" ") | gsub("\"";"''"))\",\"\""
      elif .value.status == null then
        # Case 2: No status field
        "\($filename),\(.key),\"\(.value.name | gsub("\"";"''"))\",\"NO_STATUS\",\"\(.value.url | gsub("\"";"''"))\",\"\(.value.error | gsub("\n";" ") | gsub("\"";"''")),\"Missing status\""
      elif .value.result == null then
        # Case 3: No results field
        "\($filename),\(.key),\"\(.value.name | gsub("\"";"''"))\",\(.value.status),\"\(.value.url | gsub("\"";"''"))\",\"\(.value.error | gsub("\n";" ") | gsub("\"";"''")),\"Missing results\""
      else
        empty
      end
    ) | 
    .[]
  ' "$BATCH_FILE" >> "$CSV_FILE"
done

echo "CSV file created at $CSV_FILE" 
#!/bin/bash

# Script to generate a summary report of all batch processing results
# It will show statistics about success, error, and not_published statuses

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

echo "Generating summary report of batch processing results..."
echo "========================================================"

# Count total number of batch files
BATCH_COUNT=$(ls -1 objects/batch_results_*.json 2>/dev/null | wc -l)
echo "Total batch files: $BATCH_COUNT"

# Initialize counters
TOTAL_ITEMS=0
SUCCESS_COUNT=0
ERROR_COUNT=0
NOT_PUBLISHED_COUNT=0
NULL_STATUS_COUNT=0

# Process each batch file
for BATCH_FILE in objects/batch_results_*.json; do
  FILENAME=$(basename "$BATCH_FILE")
  
  # Get counts for this batch file
  BATCH_TOTAL=$(jq 'length' "$BATCH_FILE")
  BATCH_SUCCESS=$(jq '[.[] | select(.status == "success")] | length' "$BATCH_FILE")
  BATCH_ERROR=$(jq '[.[] | select(.status == "error")] | length' "$BATCH_FILE")
  BATCH_NOT_PUBLISHED=$(jq '[.[] | select(.status == "not_published")] | length' "$BATCH_FILE")
  BATCH_NULL_STATUS=$(jq '[.[] | select(.status == null)] | length' "$BATCH_FILE")
  
  # Update totals
  TOTAL_ITEMS=$((TOTAL_ITEMS + BATCH_TOTAL))
  SUCCESS_COUNT=$((SUCCESS_COUNT + BATCH_SUCCESS))
  ERROR_COUNT=$((ERROR_COUNT + BATCH_ERROR))
  NOT_PUBLISHED_COUNT=$((NOT_PUBLISHED_COUNT + BATCH_NOT_PUBLISHED))
  NULL_STATUS_COUNT=$((NULL_STATUS_COUNT + BATCH_NULL_STATUS))
  
  # Print batch summary
  echo "Batch file: $FILENAME"
  echo "  Total items: $BATCH_TOTAL"
  echo "  Success: $BATCH_SUCCESS"
  echo "  Error: $BATCH_ERROR"
  echo "  Not published: $BATCH_NOT_PUBLISHED"
  echo "  No status: $BATCH_NULL_STATUS"
  echo "----------------------------------------"
done

# Print overall summary
echo ""
echo "OVERALL SUMMARY"
echo "----------------------------------------"
echo "Total items processed: $TOTAL_ITEMS"
echo "Success: $SUCCESS_COUNT ($(awk "BEGIN {printf \"%.2f\", ($SUCCESS_COUNT/$TOTAL_ITEMS)*100}")%)"
echo "Error: $ERROR_COUNT ($(awk "BEGIN {printf \"%.2f\", ($ERROR_COUNT/$TOTAL_ITEMS)*100}")%)"
echo "Not published: $NOT_PUBLISHED_COUNT ($(awk "BEGIN {printf \"%.2f\", ($NOT_PUBLISHED_COUNT/$TOTAL_ITEMS)*100}")%)"
echo "No status: $NULL_STATUS_COUNT ($(awk "BEGIN {printf \"%.2f\", ($NULL_STATUS_COUNT/$TOTAL_ITEMS)*100}")%)"
echo "========================================================"

# Create a CSV summary file
SUMMARY_FILE="objects/processing_summary.csv"
echo "Creating CSV summary file: $SUMMARY_FILE"

echo "Filename,Total,Success,Error,NotPublished,NoStatus" > "$SUMMARY_FILE"

for BATCH_FILE in objects/batch_results_*.json; do
  FILENAME=$(basename "$BATCH_FILE")
  
  # Get counts for this batch file
  BATCH_TOTAL=$(jq 'length' "$BATCH_FILE")
  BATCH_SUCCESS=$(jq '[.[] | select(.status == "success")] | length' "$BATCH_FILE")
  BATCH_ERROR=$(jq '[.[] | select(.status == "error")] | length' "$BATCH_FILE")
  BATCH_NOT_PUBLISHED=$(jq '[.[] | select(.status == "not_published")] | length' "$BATCH_FILE")
  BATCH_NULL_STATUS=$(jq '[.[] | select(.status == null)] | length' "$BATCH_FILE")
  
  # Add to CSV
  echo "$FILENAME,$BATCH_TOTAL,$BATCH_SUCCESS,$BATCH_ERROR,$BATCH_NOT_PUBLISHED,$BATCH_NULL_STATUS" >> "$SUMMARY_FILE"
done

echo "Summary report complete. CSV file created at $SUMMARY_FILE" 
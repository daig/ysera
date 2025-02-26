#!/bin/bash

# Script to retry scraping tables for all objects that had an error
# It will skip over the not_published records

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

# Create a directory for retry results
RETRY_DIR="objects/retries"
mkdir -p "$RETRY_DIR"

echo "Finding error records to retry..."

# Create a temporary file with all error records to retry
TEMP_FILE="$RETRY_DIR/retry_items.json"
echo "[]" > "$TEMP_FILE"

# Process each batch file to collect error records
for BATCH_FILE in objects/batch_results_*.json; do
  FILENAME=$(basename "$BATCH_FILE")
  echo "Processing $FILENAME for error records..."
  
  # Extract records with error status (not not_published)
  # and append them to the temporary file
  jq -r '
    [.[] | select(.status == "error" or .status == null or .result == null) | 
     select(.status != "not_published")]
  ' "$BATCH_FILE" > "$RETRY_DIR/temp.json"
  
  # Merge with existing retry items
  jq -s '.[0] + .[1]' "$TEMP_FILE" "$RETRY_DIR/temp.json" > "$RETRY_DIR/merged.json"
  mv "$RETRY_DIR/merged.json" "$TEMP_FILE"
  rm "$RETRY_DIR/temp.json"
done

# Count the number of items to retry
RETRY_COUNT=$(jq 'length' "$TEMP_FILE")
echo "Found $RETRY_COUNT items to retry"

if [ "$RETRY_COUNT" -eq 0 ]; then
  echo "No error records to retry. Exiting."
  exit 0
fi

echo "Starting retry process..."
echo "----------------------------------------------"

# Process the retry items in batches
BATCH_SIZE=10
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETRY_RESULTS="$RETRY_DIR/retry_results_$TIMESTAMP.json"

# Initialize the results file
echo "[]" > "$RETRY_RESULTS"

# Create a TypeScript file for processing retries
cat > "$RETRY_DIR/retry_batch.ts" <<EOL
import * as fs from 'fs';
import * as path from 'path';
import { scrapeTableData, Result } from '../../table_scraper';

// Type definitions for the JSON structure
type UrlItem = {
  name: string;
  url: string;
  result?: Result;
  error?: string;
  status?: 'success' | 'error' | 'not_published';
  retry_timestamp?: string;
  previous_status?: string;
  previous_error?: string;
};

async function processRetryBatch(items: UrlItem[]): Promise<UrlItem[]> {
  const results: UrlItem[] = [];
  
  for (const item of items) {
    if (item.url) {
      console.log(\`Retrying \${item.name} at \${item.url}\`);
      try {
        // Construct the full URL
        const fullUrl = \`https://www.emeraldcloudlab.com\${item.url}\`;
        // Scrape the data
        const result = await scrapeTableData(fullUrl);
        
        // Check if the result indicates the object is not published
        if (result && result.objectName && result.objectName.includes("not been published")) {
          results.push({
            ...item,
            status: 'not_published',
            error: 'Object has not been published',
            retry_timestamp: new Date().toISOString(),
            previous_status: item.status,
            previous_error: item.error
          });
          console.log(\`Object not published: \${item.name}\`);
        } else {
          // Add the result to the item
          results.push({
            ...item,
            result,
            status: 'success',
            retry_timestamp: new Date().toISOString(),
            previous_status: item.status,
            previous_error: item.error
          });
          console.log(\`Successfully processed \${item.name}\`);
        }
      } catch (error) {
        console.error(\`Error processing \${item.name}:\`, error);
        // Add the item with error information
        results.push({
          ...item,
          error: error instanceof Error ? error.message : String(error),
          status: 'error',
          retry_timestamp: new Date().toISOString(),
          previous_status: item.status,
          previous_error: item.error
        });
      }
    } else {
      results.push(item);
    }
  }
  
  return results;
}

async function main() {
  try {
    // Read the batch file
    const batchPath = path.join(__dirname, 'current_batch.json');
    const jsonData = fs.readFileSync(batchPath, 'utf8');
    const items = JSON.parse(jsonData) as UrlItem[];
    
    console.log(\`Processing \${items.length} items for retry\`);
    
    // Process the batch
    const processedItems = await processRetryBatch(items);
    
    // Write the results to a JSON file
    const outputPath = path.join(__dirname, 'batch_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(processedItems, null, 2), 'utf8');
    console.log(\`Results written to \${outputPath}\`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);
EOL

# Process in batches
for ((i=0; i<RETRY_COUNT; i+=BATCH_SIZE)); do
  END=$((i + BATCH_SIZE))
  if [ $END -gt $RETRY_COUNT ]; then
    END=$RETRY_COUNT
  fi
  
  echo "Processing retry batch $i to $((END-1)) ($(($END-$i)) items)"
  
  # Extract the current batch
  jq -r ".[${i}:${END}]" "$TEMP_FILE" > "$RETRY_DIR/current_batch.json"
  
  # Run the TypeScript file using ts-node
  echo "Running retry batch with ts-node..."
  cd "$(dirname "$0")"
  npx ts-node "$RETRY_DIR/retry_batch.ts"
  
  # Merge the results
  if [ -f "$RETRY_DIR/batch_result.json" ]; then
    jq -s '.[0] + .[1]' "$RETRY_RESULTS" "$RETRY_DIR/batch_result.json" > "$RETRY_DIR/merged_results.json"
    mv "$RETRY_DIR/merged_results.json" "$RETRY_RESULTS"
    rm "$RETRY_DIR/batch_result.json"
  else
    echo "Warning: No results generated for this batch"
  fi
  
  echo "Completed retry batch $i to $((END-1))"
  echo "----------------------------------------------"
  
  # Optional: Add a small delay between batches
  sleep 2
done

# Clean up temporary files
rm "$RETRY_DIR/retry_batch.ts"
rm "$RETRY_DIR/current_batch.json"
rm "$TEMP_FILE"

# Generate a summary of the retry results
SUCCESS_COUNT=$(jq '[.[] | select(.status == "success")] | length' "$RETRY_RESULTS")
ERROR_COUNT=$(jq '[.[] | select(.status == "error")] | length' "$RETRY_RESULTS")
NOT_PUBLISHED_COUNT=$(jq '[.[] | select(.status == "not_published")] | length' "$RETRY_RESULTS")

echo ""
echo "RETRY SUMMARY"
echo "----------------------------------------------"
echo "Total items retried: $RETRY_COUNT"
echo "Success: $SUCCESS_COUNT ($(awk "BEGIN {printf \"%.2f\", ($SUCCESS_COUNT/$RETRY_COUNT)*100}")%)"
echo "Error: $ERROR_COUNT ($(awk "BEGIN {printf \"%.2f\", ($ERROR_COUNT/$RETRY_COUNT)*100}")%)"
echo "Not published: $NOT_PUBLISHED_COUNT ($(awk "BEGIN {printf \"%.2f\", ($NOT_PUBLISHED_COUNT/$RETRY_COUNT)*100}")%)"
echo "----------------------------------------------"
echo "Retry results saved to: $RETRY_RESULTS" 
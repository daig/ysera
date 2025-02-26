#!/bin/bash

# Directory containing the JSON batch files
JSON_DIR="emerald-scraper/objects"

# Output CSV file
OUTPUT_FILE="field_definitions.csv"

# Add CSV header
echo "\"field_name\",\"field_description\"" > "$OUTPUT_FILE"

# Process each JSON file
for json_file in "$JSON_DIR"/batch_results_*.json; do
    echo "Processing $json_file..."
    jq -f extract_fields.jq "$json_file" >> "$OUTPUT_FILE"
done

# Remove duplicate lines while preserving the header
echo "Removing duplicates..."
TEMP_FILE=$(mktemp)
head -1 "$OUTPUT_FILE" > "$TEMP_FILE"
tail -n +2 "$OUTPUT_FILE" | sort -u >> "$TEMP_FILE"
mv "$TEMP_FILE" "$OUTPUT_FILE"

echo "Completed! Results saved to $OUTPUT_FILE" 
#!/bin/bash

# Script to run process-batch in batches of 10, incrementing the offset by 10 each time
# Results will be saved to the objects directory

# Change to the emerald-scraper directory
cd "$(dirname "$0")"

# Create objects directory if it doesn't exist
mkdir -p objects

# Get the total number of items by running a small batch and checking the output
echo "Checking total number of items..."
npm run process-batch -- 0 1 | grep "Found" | awk '{print $2}' > temp_count.txt
TOTAL_ITEMS=$(cat temp_count.txt)
rm temp_count.txt

if [ -z "$TOTAL_ITEMS" ]; then
  echo "Could not determine total number of items. Exiting."
  exit 1
fi

echo "Total items to process: $TOTAL_ITEMS"

# Set batch size
BATCH_SIZE=10

# Process all batches
for ((i=0; i<TOTAL_ITEMS; i+=BATCH_SIZE)); do
  echo "Processing batch starting at offset $i with size $BATCH_SIZE"
  
  # Run the process-batch script
  npm run process-batch -- $i $BATCH_SIZE
  
  # Move the generated batch file to the objects directory
  # The batch file will be named batch_results_X_Y.json where X is the start index and Y is the end index
  BATCH_FILE="batch_results_${i}_$((i+BATCH_SIZE-1)).json"
  
  if [ -f "$BATCH_FILE" ]; then
    echo "Moving $BATCH_FILE to objects directory"
    mv "$BATCH_FILE" "objects/"
  else
    echo "Warning: Expected batch file $BATCH_FILE not found"
  fi
  
  echo "Completed batch $i to $((i+BATCH_SIZE-1))"
  echo "---------------------------------------------"
  
  # Optional: Add a small delay between batches to avoid overwhelming the server
  sleep 2
done

echo "All batches processed successfully!"
echo "Results are saved in the objects directory" 
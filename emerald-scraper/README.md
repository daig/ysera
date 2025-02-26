# Emerald Cloud Lab Scraper

This project scrapes data from Emerald Cloud Lab documentation pages and enriches a JSON file with the scraped data.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure you have the `objects.json` file in the project directory.

## Usage

### Process All Objects

To process all objects in the JSON file:

```bash
npm run process
```

This will:
1. Read the `objects.json` file
2. For each URL in the file, scrape the corresponding page
3. Add the scraped data to the JSON structure
4. Write the result to `objects_with_results.json`

### Process in Batches

To process objects in batches (useful for large datasets):

```bash
# Process the first 5 items (default batch size)
npm run process-batch

# Process 10 items starting from index 0
npm run process-batch -- 0 10

# Process 10 items starting from index 10
npm run process-batch -- 10 10
```

Each batch will be saved to a file named `batch_results_START_END.json`.

### Merge Batch Results

After processing in batches, you can merge all the batch results back into the original JSON structure:

```bash
npm run merge-results
```

This will:
1. Read all `batch_results_*.json` files
2. Merge the results into the original JSON structure
3. Write the result to `objects_with_results.json`

## File Structure

- `table_scraper.ts` - Core scraping functionality
- `process_objects.ts` - Processes all objects in the JSON file
- `process_objects_batch.ts` - Processes objects in batches
- `merge_batch_results.ts` - Merges batch results back into the original JSON structure
- `objects.json` - Input JSON file
- `objects_with_results.json` - Output JSON file with scraped data 
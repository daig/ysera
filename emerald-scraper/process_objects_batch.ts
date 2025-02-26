import * as fs from 'fs';
import * as path from 'path';
import { scrapeTableData, Result } from './table_scraper';

// Type definitions for the JSON structure
type UrlItem = {
  name: string;
  url: string;
  result?: Result;
  error?: string;
  status?: 'success' | 'error' | 'not_published';
};

type ItemsContainer = {
  items: UrlItem[];
};

type NestedObject = {
  [key: string]: NestedObject | ItemsContainer;
};

type RootObject = {
  [key: string]: NestedObject;
};

// Function to check if an object has an 'items' property
function hasItems(obj: any): obj is ItemsContainer {
  return obj && Array.isArray(obj.items);
}

// Function to collect all URL items from the JSON
function collectUrlItems(obj: NestedObject | ItemsContainer, items: UrlItem[] = []): UrlItem[] {
  if (hasItems(obj)) {
    // This is a leaf node with items
    items.push(...obj.items);
  } else {
    // This is a nested object, collect from each child
    for (const key in obj) {
      collectUrlItems(obj[key] as NestedObject | ItemsContainer, items);
    }
  }
  return items;
}

async function processBatch(items: UrlItem[], startIndex: number, batchSize: number): Promise<UrlItem[]> {
  const endIndex = Math.min(startIndex + batchSize, items.length);
  const batch = items.slice(startIndex, endIndex);
  const results: UrlItem[] = [];

  console.log(`Processing batch from index ${startIndex} to ${endIndex - 1} (${batch.length} items)`);

  for (const item of batch) {
    if (item.url) {
      console.log(`Processing ${item.name} at ${item.url}`);
      try {
        // Construct the full URL
        const fullUrl = `https://www.emeraldcloudlab.com${item.url}`;
        // Scrape the data
        const result = await scrapeTableData(fullUrl);
        
        // Check if the result indicates the object is not published
        if (result && result.objectName && result.objectName.includes("not been published")) {
          results.push({
            ...item,
            status: 'not_published',
            error: 'Object has not been published'
          });
          console.log(`Object not published: ${item.name}`);
        } else {
          // Add the result to the item
          results.push({
            ...item,
            result,
            status: 'success'
          });
          console.log(`Successfully processed ${item.name}`);
        }
      } catch (error) {
        console.error(`Error processing ${item.name}:`, error);
        // Add the item with error information
        results.push({
          ...item,
          error: error instanceof Error ? error.message : String(error),
          status: 'error'
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
    // Parse command line arguments
    const args = process.argv.slice(2);
    const startIndex = parseInt(args[0]) || 0;
    const batchSize = parseInt(args[1]) || 5; // Default to 5 items per batch

    // Read the JSON file
    const jsonPath = path.join(__dirname, 'objects.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(jsonData) as RootObject;

    // Collect all URL items
    const allItems: UrlItem[] = [];
    for (const key in data) {
      collectUrlItems(data[key], allItems);
    }

    console.log(`Found ${allItems.length} total items`);

    // Process the batch
    const processedItems = await processBatch(allItems, startIndex, batchSize);

    // Write the results to a JSON file
    const outputPath = path.join(__dirname, `batch_results_${startIndex}_${startIndex + processedItems.length - 1}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(processedItems, null, 2), 'utf8');
    console.log(`Results written to ${outputPath}`);

    // Output information for the next batch
    if (startIndex + batchSize < allItems.length) {
      console.log(`To process the next batch, run: node process_objects_batch.js ${startIndex + batchSize} ${batchSize}`);
    } else {
      console.log('All items have been processed!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main().catch(console.error); 
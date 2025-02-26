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

// Function to recursively process the JSON and find all URL items
async function processObject(obj: NestedObject | ItemsContainer): Promise<void> {
  if (hasItems(obj)) {
    // This is a leaf node with items
    for (let i = 0; i < obj.items.length; i++) {
      const item = obj.items[i];
      if (item.url) {
        console.log(`Processing ${item.name} at ${item.url}`);
        try {
          // Construct the full URL
          const fullUrl = `https://www.emeraldcloudlab.com${item.url}`;
          // Scrape the data
          const result = await scrapeTableData(fullUrl);
          
          // Check if the result indicates the object is not published
          if (result && result.objectName && result.objectName.includes("not been published")) {
            obj.items[i] = {
              ...item,
              status: 'not_published',
              error: 'Object has not been published'
            };
            console.log(`Object not published: ${item.name}`);
          } else {
            // Add the result to the item
            obj.items[i] = {
              ...item,
              result,
              status: 'success'
            };
            console.log(`Successfully processed ${item.name}`);
          }
        } catch (error) {
          console.error(`Error processing ${item.name}:`, error);
          obj.items[i] = {
            ...item,
            error: error instanceof Error ? error.message : String(error),
            status: 'error'
          };
        }
      }
    }
  } else {
    // This is a nested object, process each child
    for (const key in obj) {
      await processObject(obj[key] as NestedObject | ItemsContainer);
    }
  }
}

async function main() {
  try {
    // Read the JSON file
    const jsonPath = path.join(__dirname, 'objects.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(jsonData) as RootObject;

    // Process the JSON
    for (const key in data) {
      await processObject(data[key]);
    }

    // Write the updated JSON back to a new file
    const outputPath = path.join(__dirname, 'objects_with_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Results written to ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main().catch(console.error); 
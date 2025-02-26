import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Type definitions for the JSON structure
type UrlItem = {
  name: string;
  url: string;
  result?: any;
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

// Function to update items in the original structure with results from batch processing
function updateWithResults(obj: NestedObject | ItemsContainer, resultsMap: Map<string, UrlItem>): void {
  if (hasItems(obj)) {
    // This is a leaf node with items
    for (let i = 0; i < obj.items.length; i++) {
      const item = obj.items[i];
      if (item.url && resultsMap.has(item.url)) {
        const processedItem = resultsMap.get(item.url)!;
        obj.items[i] = {
          ...item,
          result: processedItem.result,
          error: processedItem.error,
          status: processedItem.status
        };
      }
    }
  } else {
    // This is a nested object, update each child
    for (const key in obj) {
      updateWithResults(obj[key] as NestedObject | ItemsContainer, resultsMap);
    }
  }
}

async function main() {
  try {
    // Read the original JSON file
    const jsonPath = path.join(__dirname, 'objects.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(jsonData) as RootObject;

    // Find all batch result files
    const batchFiles = glob.sync(path.join(__dirname, 'batch_results_*.json'));
    console.log(`Found ${batchFiles.length} batch result files`);

    // Create a map of URL to processed item
    const resultsMap = new Map<string, UrlItem>();

    // Process each batch file
    for (const batchFile of batchFiles) {
      console.log(`Processing batch file: ${batchFile}`);
      const batchData = JSON.parse(fs.readFileSync(batchFile, 'utf8')) as UrlItem[];
      
      // Add each processed item to the map
      for (const item of batchData) {
        if (item.url) {
          resultsMap.set(item.url, item);
        }
      }
    }

    console.log(`Collected results for ${resultsMap.size} items`);

    // Update the original structure with the results
    for (const key in data) {
      updateWithResults(data[key], resultsMap);
    }

    // Write the updated JSON back to a new file
    const outputPath = path.join(__dirname, 'objects_with_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Results merged and written to ${outputPath}`);
    
    // Generate a summary of processing results
    let successCount = 0;
    let errorCount = 0;
    let notPublishedCount = 0;
    
    resultsMap.forEach(item => {
      if (item.status === 'success') successCount++;
      else if (item.status === 'error') errorCount++;
      else if (item.status === 'not_published') notPublishedCount++;
    });
    
    console.log('\nProcessing Summary:');
    console.log(`Total items: ${resultsMap.size}`);
    console.log(`Successfully processed: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Not published: ${notPublishedCount}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main().catch(console.error); 
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const BATCH_SIZE = 10; // Number of types to process in each batch
const BATCH_DELAY = 5000; // Delay between batches in milliseconds (5 seconds)
const TYPES_FILE = path.join(__dirname, 'all_types_structured.json');
const SCRAPED_DIR = path.join(__dirname, 'scraped_types');
const OUTPUT_FILE = path.join(__dirname, 'all_types_merged.json');
const LOG_FILE = path.join(__dirname, 'merge_types_log.txt');

// Set up logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Load the types from the all_types_structured.json file
function loadTypes() {
  if (!fs.existsSync(TYPES_FILE)) {
    log('Error: all_types_structured.json not found');
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(TYPES_FILE, 'utf8'));
}

// Check if a type has already been scraped
function hasBeenScraped(typeName) {
  const fileName = `${typeName.replace(/[\[\]\/:*?"<>|]/g, '_')}.json`;
  const filePath = path.join(SCRAPED_DIR, fileName);
  return fs.existsSync(filePath);
}

// Get the list of types that need to be scraped
function getTypesToScrape(typesData) {
  const allTypes = [];
  if (typesData.models) allTypes.push(...typesData.models);
  if (typesData.objects) allTypes.push(...typesData.objects);
  if (typesData.allTypes) allTypes.push(...typesData.allTypes);
  
  // Add original index to each type
  allTypes.forEach((type, index) => {
    type.originalIndex = index;
  });
  
  // Filter types to only include those with an href and that haven't been scraped yet
  const typesToScrape = allTypes.filter(type => 
    type.href && !hasBeenScraped(type.name)
  );
  
  return { allTypes, typesToScrape };
}

// Run a batch of types
function runBatch(typesToScrape, startIndex, batchSize) {
  return new Promise((resolve, reject) => {
    // Find the actual indices in the all_types_structured.json file
    const actualIndices = typesToScrape.slice(startIndex, startIndex + batchSize)
      .map(type => type.originalIndex);
    
    if (actualIndices.length === 0) {
      log('No types to process in this batch');
      resolve();
      return;
    }
    
    // We'll use the scraper directly with specific indices
    const startTypeIndex = actualIndices[0];
    const count = actualIndices.length;
    
    // Create the command to run the scraper for a specific batch
    const batchArgs = [
      path.join(__dirname, 'type_details_scraper.js'),
      startTypeIndex.toString(),
      count.toString()
    ];
    
    log(`Running batch from types index ${startTypeIndex} with count ${count}`);
    
    const process = spawn('node', batchArgs);
    
    process.stdout.on('data', (data) => {
      const text = data.toString();
      // Uncomment for more verbose logging
      // log(`Batch output: ${text}`);
    });
    
    process.stderr.on('data', (data) => {
      const text = data.toString();
      log(`Batch error: ${text}`);
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        log(`Batch completed successfully`);
        resolve();
      } else {
        log(`Batch failed with code ${code}`);
        // Continue anyway to process as many as we can
        resolve();
      }
    });
  });
}

// Scrape a limited number of types that haven't been scraped yet
async function scrapeTypes(typesToScrape, maxBatches = 5) {
  const totalTypes = typesToScrape.length;
  const totalBatchesToRun = Math.min(maxBatches, Math.ceil(totalTypes / BATCH_SIZE));
  
  log(`Need to scrape ${totalTypes} types. Will process ${totalBatchesToRun} batches (${totalBatchesToRun * BATCH_SIZE} types max) in this run.`);
  
  // Process each batch
  for (let i = 0; i < totalBatchesToRun; i++) {
    const batchStartIndex = i * BATCH_SIZE;
    const remainingTypes = totalTypes - batchStartIndex;
    const currentBatchSize = Math.min(BATCH_SIZE, remainingTypes);
    
    log(`Starting batch ${i + 1}/${totalBatchesToRun}`);
    
    try {
      await runBatch(typesToScrape, batchStartIndex, currentBatchSize);
    } catch (error) {
      log(`Error in batch ${i + 1}: ${error.message}`);
    }
    
    // Add delay between batches
    if (i < totalBatchesToRun - 1) {
      log(`Waiting ${BATCH_DELAY}ms before starting next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
  
  log(`Completed ${totalBatchesToRun} batches. ${totalTypes - (totalBatchesToRun * BATCH_SIZE)} types remain to be scraped.`);
}

// Load a scraped type data
function loadScrapedData(typeName) {
  try {
    const fileName = `${typeName.replace(/[\[\]\/:*?"<>|]/g, '_')}.json`;
    const filePath = path.join(SCRAPED_DIR, fileName);
    
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    log(`Error loading scraped data for ${typeName}: ${error.message}`);
  }
  
  return null;
}

// Merge the scraped data with the original types data
function mergeData(typesData) {
  const { allTypes } = getTypesToScrape(typesData);
  
  log(`Merging data for ${allTypes.length} types`);
  
  let mergedCount = 0;
  let missingCount = 0;
  
  // Process each type
  for (let i = 0; i < allTypes.length; i++) {
    const type = allTypes[i];
    
    // Skip types without a href
    if (!type.href) {
      continue;
    }
    
    // Load the scraped data
    const scrapedData = loadScrapedData(type.name);
    
    if (scrapedData) {
      // Add the scraped data as a 'data' field
      type.data = scrapedData;
      mergedCount++;
      
      // Log progress every 100 types
      if (mergedCount % 100 === 0) {
        log(`Merged ${mergedCount} types so far`);
      }
    } else {
      missingCount++;
    }
    
    // Remove the originalIndex which was just for our internal use
    delete type.originalIndex;
  }
  
  log(`Merged ${mergedCount} types, missing data for ${missingCount} types`);
  
  return typesData;
}

// Save the merged data to a new file
function saveData(data) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  log(`Merged data saved to ${OUTPUT_FILE}`);
}

// Main function
async function main() {
  // Parse command line args
  const args = process.argv.slice(2);
  const command = args[0] || 'merge';  // Default to just merging
  const maxBatches = parseInt(args[1], 10) || 5; // Default to 5 batches
  
  // Initialize log file
  fs.writeFileSync(LOG_FILE, `Merge Types Started at ${new Date().toISOString()}\n`);
  
  // Create scraped_types directory if it doesn't exist
  if (!fs.existsSync(SCRAPED_DIR)) {
    fs.mkdirSync(SCRAPED_DIR, { recursive: true });
  }
  
  // Load the original types data
  const typesData = loadTypes();
  
  // Get the types that need to be scraped
  const { typesToScrape } = getTypesToScrape(typesData);
  
  // Check which command to run
  if (command === 'scrape') {
    // Scrape and merge mode
    if (typesToScrape.length > 0) {
      log(`Found ${typesToScrape.length} types that need to be scraped`);
      await scrapeTypes(typesToScrape, maxBatches);
    } else {
      log('All types have already been scraped');
    }
  } else if (command === 'merge') {
    // Merge only mode
    log(`Running in merge-only mode. ${typesToScrape.length} types still need to be scraped.`);
  } else {
    log(`Unknown command: ${command}. Use 'merge' or 'scrape'.`);
    process.exit(1);
  }
  
  // Merge the scraped data with the original types data
  const mergedData = mergeData(typesData);
  
  // Save the merged data
  saveData(mergedData);
  
  log('All done!');
}

// Run the main function
main();
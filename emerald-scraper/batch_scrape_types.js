const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const BATCH_SIZE = 5; // Number of types to process in each batch
const BATCH_DELAY = 2000; // Delay between batches in milliseconds
const MAX_RETRIES = 3; // Maximum number of retries for failed batches
const LOG_FILE = path.join(__dirname, 'batch_scrape_log.txt');

// Set up logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Load the types from the all_types_structured.json file
function loadTypes() {
  const typesFile = path.join(__dirname, 'all_types_structured.json');
  if (!fs.existsSync(typesFile)) {
    log('Error: all_types_structured.json not found. Please run the types scraper first.');
    process.exit(1);
  }
  
  const typesData = JSON.parse(fs.readFileSync(typesFile, 'utf8'));
  
  // Get all the types (both models and objects)
  const allTypes = [];
  if (typesData.models) allTypes.push(...typesData.models);
  if (typesData.objects) allTypes.push(...typesData.objects);
  if (typesData.allTypes) allTypes.push(...typesData.allTypes);
  
  return allTypes.filter(type => type.href); // Only keep types with hrefs
}

// Run a batch of types
function runBatch(startIndex, batchSize, types, retries = 0) {
  return new Promise((resolve, reject) => {
    // Create the scraped_types directory if it doesn't exist
    const outputDir = path.join(__dirname, 'scraped_types');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    log(`Running batch from index ${startIndex} to ${startIndex + batchSize - 1} (${batchSize} types)`);
    
    const process = spawn('node', [
      'type_details_scraper.js',
      startIndex.toString(),
      batchSize.toString()
    ]);
    
    let output = '';
    
    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Uncomment for debugging
      // console.log(text);
    });
    
    process.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Only log errors that aren't already logged by the scraper
      if (!text.includes('Error processing')) {
        console.error(`Error: ${text}`);
      }
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        log(`Batch completed successfully (${startIndex} - ${startIndex + batchSize - 1})`);
        resolve();
      } else {
        log(`Batch failed with code ${code} (${startIndex} - ${startIndex + batchSize - 1})`);
        
        // Retry logic
        if (retries < MAX_RETRIES) {
          log(`Retrying batch (attempt ${retries + 1} of ${MAX_RETRIES})...`);
          setTimeout(() => {
            runBatch(startIndex, batchSize, types, retries + 1)
              .then(resolve)
              .catch(reject);
          }, BATCH_DELAY);
        } else {
          log(`Maximum retries exceeded for batch ${startIndex} - ${startIndex + batchSize - 1}`);
          // Save the failed indices to a file for later retry
          const failedFile = path.join(__dirname, 'failed_indices.json');
          let failedIndices = [];
          
          if (fs.existsSync(failedFile)) {
            failedIndices = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
          }
          
          for (let i = 0; i < batchSize; i++) {
            failedIndices.push(startIndex + i);
          }
          
          fs.writeFileSync(failedFile, JSON.stringify(failedIndices, null, 2));
          log(`Failed indices saved to failed_indices.json`);
          
          // Continue with the next batch
          resolve();
        }
      }
    });
  });
}

// Main function to run all batches
async function main() {
  // Initialize log file
  fs.writeFileSync(LOG_FILE, `Batch Scraping Started at ${new Date().toISOString()}\n`);
  
  // Get command line arguments
  const args = process.argv.slice(2);
  let startIndex = 0;
  let endIndex = -1; // -1 means process all
  
  if (args.length >= 1) {
    startIndex = parseInt(args[0], 10) || 0;
  }
  
  if (args.length >= 2) {
    endIndex = parseInt(args[1], 10) || -1;
  }
  
  // Load all types
  const types = loadTypes();
  log(`Loaded ${types.length} types from all_types_structured.json`);
  
  if (endIndex === -1 || endIndex >= types.length) {
    endIndex = types.length - 1;
  }
  
  // Calculate total batches
  const totalTypes = endIndex - startIndex + 1;
  const totalBatches = Math.ceil(totalTypes / BATCH_SIZE);
  
  log(`Processing ${totalTypes} types in ${totalBatches} batches`);
  
  // Process each batch
  for (let i = 0; i < totalBatches; i++) {
    const batchStartIndex = startIndex + (i * BATCH_SIZE);
    const remainingTypes = totalTypes - (i * BATCH_SIZE);
    const currentBatchSize = Math.min(BATCH_SIZE, remainingTypes);
    
    log(`Starting batch ${i + 1}/${totalBatches}`);
    
    try {
      await runBatch(batchStartIndex, currentBatchSize, types);
    } catch (error) {
      log(`Error in batch ${i + 1}: ${error.message}`);
    }
    
    // Add delay between batches
    if (i < totalBatches - 1) {
      log(`Waiting ${BATCH_DELAY}ms before starting next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
  
  log('All batches completed!');
}

// Run the main function
main(); 
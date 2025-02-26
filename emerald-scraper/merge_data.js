const fs = require('fs');
const path = require('path');

/**
 * Merges the scraped data with the original types data
 * @returns {Promise<void>}
 */
async function mergeData() {
  console.log('Starting data merge process...');
  
  // Load the original types data
  const typesFilePath = path.join(__dirname, 'all_types_structured.json');
  if (!fs.existsSync(typesFilePath)) {
    console.error('Error: all_types_structured.json not found!');
    return;
  }
  
  const typesData = JSON.parse(fs.readFileSync(typesFilePath, 'utf8'));
  console.log(`Loaded types data with ${Object.keys(typesData).length} categories`);
  
  // Get all types from all categories
  const allTypes = [];
  if (typesData.models) allTypes.push(...typesData.models);
  if (typesData.objects) allTypes.push(...typesData.objects);
  if (typesData.allTypes) allTypes.push(...typesData.allTypes);
  
  console.log(`Total of ${allTypes.length} types to process`);
  
  // Directory containing the scraped data files
  const scrapedDir = path.join(__dirname, 'scraped_types');
  if (!fs.existsSync(scrapedDir)) {
    console.error(`Error: Scraped data directory not found: ${scrapedDir}`);
    return;
  }
  
  // Get all scraped files
  const scrapedFiles = fs.readdirSync(scrapedDir)
    .filter(file => file.endsWith('.json'));
  
  console.log(`Found ${scrapedFiles.length} scraped data files`);
  
  // Create a map of type names to scraped data files for quick lookup
  const typeFileMap = {};
  scrapedFiles.forEach(file => {
    // Extract type name from filename
    // The filename format is typeName.json where typeName has special chars replaced with _
    const fileName = file.replace('.json', '');
    typeFileMap[fileName] = file;
  });
  
  // Process each type and merge with scraped data
  let mergedCount = 0;
  let missingCount = 0;
  
  for (let i = 0; i < allTypes.length; i++) {
    const type = allTypes[i];
    const typeName = type.name;
    
    // Generate the expected filename (matching the pattern used in type_details_scraper.js)
    const expectedFileName = typeName.replace(/[\[\]\/:*?"<>|]/g, '_');
    
    // Check if we have scraped data for this type
    if (typeFileMap[expectedFileName]) {
      // Load the scraped data
      const scrapedFilePath = path.join(scrapedDir, typeFileMap[expectedFileName]);
      try {
        const scrapedData = JSON.parse(fs.readFileSync(scrapedFilePath, 'utf8'));
        
        // Add the scraped data as a "data" field under "href"
        type.data = scrapedData;
        mergedCount++;
        
        // Log progress every 100 types
        if (mergedCount % 100 === 0) {
          console.log(`Merged ${mergedCount} types so far...`);
        }
      } catch (error) {
        console.error(`Error loading scraped data for ${typeName}:`, error.message);
      }
    } else {
      missingCount++;
      console.log(`No scraped data found for ${typeName}`);
    }
  }
  
  console.log(`\nMerge summary:`);
  console.log(`- Successfully merged data for ${mergedCount} types`);
  console.log(`- Missing data for ${missingCount} types`);
  
  // Save the merged data to a new file
  const outputPath = path.join(__dirname, 'all_types_merged.json');
  fs.writeFileSync(outputPath, JSON.stringify(typesData, null, 2));
  
  console.log(`\nMerged data saved to: ${outputPath}`);
}

// If this script is run directly, execute the merge function
if (require.main === module) {
  mergeData();
} 
const puppeteer = require('puppeteer');

async function scrapeTypesTree() {
  // Launch a browser instance
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null
  });
  
  // Open a new page
  const page = await browser.newPage();
  
  // Navigate to the types URL
  console.log('Navigating to the types page...');
  await page.goto('https://www.emeraldcloudlab.com/documentation/types/');
  
  // Wait for initial page load
  console.log('Waiting for initial page load...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Result object to store the scraped data
  const result = {};
  
  try {
    // From our debug info, we can see the Models section has a specific class and structure
    // Let's try to find the Models dropdown by its class and text
    console.log('Looking for the Models dropdown...');
    
    // Find elements with the specific classes we saw in the debug output
    const modelDropdowns = await page.$$('div.ListItemAccordion__ListItemAccordionExpandableDiv-sc-1pcslqd-2');
    console.log(`Found ${modelDropdowns.length} potential model dropdowns`);
    
    // Look for the dropdown with "Models" text
    let modelsDropdown = null;
    for (const dropdown of modelDropdowns) {
      const text = await page.evaluate(el => el.textContent, dropdown);
      if (text.includes('Models')) {
        modelsDropdown = dropdown;
        console.log('Found Models dropdown:', await page.evaluate(el => el.outerHTML, dropdown));
        break;
      }
    }
    
    if (modelsDropdown) {
      console.log('Clicking Models dropdown to expand...');
      await modelsDropdown.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Take a screenshot after expanding Models
      await page.screenshot({ path: 'types-models-expanded.png' });
      
      // Now let's find all the model items
      console.log('Finding model items...');
      
      // Get all model items with triangular expanders
      const modelItems = await page.$$('div.ListItemAccordion__ListItemAccordionExpandableDiv-sc-1pcslqd-2');
      console.log(`Found ${modelItems.length} model items`);
      
      // The result tree structure
      const typesTree = {};
      
      // First pass: collect all model names
      for (let i = 1; i < modelItems.length; i++) { // Skip the first one as it's the Models dropdown
        const modelItem = modelItems[i];
        const text = await page.evaluate(el => el.textContent, modelItem);
        
        // Extract model name and subtypes count
        const modelMatch = text.match(/([A-Za-z]+)\s+(\d+)\s+subtypes/);
        if (modelMatch) {
          const modelName = modelMatch[1];
          const subtypesCount = modelMatch[2];
          console.log(`Found model: ${modelName} with ${subtypesCount} subtypes`);
          
          // Add to our tree
          typesTree[modelName] = {
            name: modelName, 
            subtypesCount: subtypesCount,
            types: []
          };
          
          // Click to expand if it has subtypes
          if (parseInt(subtypesCount) > 0) {
            console.log(`Expanding model: ${modelName}`);
            await modelItem.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Take a screenshot after expanding all models
      await page.screenshot({ path: 'types-all-expanded.png' });
      
      // Now find all the Model[Type] links
      const modelLinks = await page.$$('a[href*="Model"]');
      console.log(`Found ${modelLinks.length} model links`);
      
      // Process each model link
      for (const link of modelLinks) {
        const linkData = await page.evaluate(el => {
          // Get the link name and URL
          const name = el.textContent.trim();
          const url = el.getAttribute('href');
          
          // Try to get the description
          let description = '';
          let parentText = '';
          
          // Navigate up the DOM to find the parent that contains both the link and description
          let parent = el.parentElement;
          while (parent && !parentText) {
            parentText = parent.textContent.trim();
            // If we found a parent with more text than just the link, extract the description
            if (parentText.length > name.length + 5) {
              // Remove the link text from the parent text to get the description
              description = parentText.replace(name, '').trim();
              // Clean up any leading/trailing dashes or hyphens
              description = description.replace(/^[-:\s]+|[-:\s]+$/g, '').trim();
              break;
            }
            parent = parent.parentElement;
          }
          
          // Try to identify which model this belongs to based on context
          let modelName = '';
          // Walk up the DOM to find a header or section indicator
          let current = el.parentElement;
          const maxLevels = 5; // Prevent infinite loops
          let level = 0;
          
          while (current && level < maxLevels) {
            // Look for elements that might contain model names
            const text = current.textContent;
            const modelMatch = text.match(/^\s*([A-Za-z]+)\s+\d+\s+subtypes/);
            if (modelMatch) {
              modelName = modelMatch[1];
              break;
            }
            current = current.parentElement;
            level++;
          }
          
          return {
            name,
            url,
            description,
            modelName
          };
        }, link);
        
        console.log(`Processed link: ${linkData.name} under model ${linkData.modelName}`);
        
        // Add to our tree structure
        if (linkData.modelName && typesTree[linkData.modelName]) {
          typesTree[linkData.modelName].types.push({
            name: linkData.name,
            url: linkData.url,
            description: linkData.description
          });
        } else {
          // If we couldn't determine the model, add to a general list
          if (!typesTree.unclassified) {
            typesTree.unclassified = { types: [] };
          }
          typesTree.unclassified.types.push({
            name: linkData.name,
            url: linkData.url,
            description: linkData.description
          });
        }
      }
      
      // Save our results
      result.typesTree = typesTree;
      console.log('Scraping completed successfully.');
      
      // Output the results
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('Could not find the Models dropdown.');
      
      // Let's still try to collect any model links we can find
      const modelLinks = await page.$$('a[href*="Model"]');
      console.log(`Found ${modelLinks.length} model links without expanding dropdowns`);
      
      const typesList = [];
      
      for (const link of modelLinks) {
        const linkInfo = await page.evaluate(el => ({
          name: el.textContent.trim(),
          url: el.getAttribute('href'),
          // Try to get parent's text as description
          description: el.parentElement ? 
            el.parentElement.textContent.replace(el.textContent, '').trim() : ''
        }), link);
        
        typesList.push(linkInfo);
      }
      
      result.types = typesList;
      console.log(JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Run the scraper
scrapeTypesTree(); 
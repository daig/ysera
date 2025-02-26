const puppeteer = require('puppeteer');

async function scrapeTypesLinks() {
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
  const result = {
    types: []
  };
  
  try {
    // Take a screenshot of the initial state
    await page.screenshot({ path: 'types-initial-state.png' });
    
    // Now specifically target links with the TypesBrowser__TypeDetailsLink class
    console.log('Looking for links with TypesBrowser__TypeDetailsLink class...');
    const typeLinks = await page.$$('a[class^="TypesBrowser__TypeDetailsLink"]');
    console.log(`Found ${typeLinks.length} type links with the specific class`);
    
    // Process each type link
    for (const link of typeLinks) {
      const linkInfo = await page.evaluate(el => {
        const text = el.textContent.trim();
        const href = el.getAttribute('href');
        
        // Extract the model name from the link text (Model[X])
        const modelNameMatch = text.match(/Model\[([A-Za-z]+)\]/);
        const modelName = modelNameMatch ? modelNameMatch[1] : '';
        
        // Try to get the description
        let description = '';
        let parent = el.parentElement;
        
        // Navigate up to find a parent with a description
        while (parent && !description) {
          const parentText = parent.textContent.trim();
          if (parentText.length > text.length + 10) {
            // Extract description by removing the link text
            description = parentText.replace(text, '').trim();
            // Clean up any leading/trailing punctuation
            description = description.replace(/^[-:\s]+|[-:\s]+$/g, '').trim();
            break;
          }
          parent = parent.parentElement;
        }
        
        return {
          name: text,
          modelName: modelName,
          href: href,
          description: description
        };
      }, link);
      
      result.types.push(linkInfo);
    }
    
    // If we found links, show what we found
    if (result.types.length > 0) {
      console.log(`Found ${result.types.length} type links on the initial page`);
    } else {
      console.log('No type links found on the initial page, trying to expand sections...');
      
      // Try to click on the Models dropdown to expand it
      const modelsElements = await page.$$('div.ListItemAccordion__ListItemAccordionExpandableDiv-sc-1pcslqd-2');
      
      // Look for the Models section by text content
      let modelsSection = null;
      for (const el of modelsElements) {
        const text = await page.evaluate(el => el.textContent.trim(), el);
        if (text.includes('Models')) {
          modelsSection = el;
          break;
        }
      }
      
      if (modelsSection) {
        console.log('Found Models section, clicking to expand...');
        await modelsSection.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Take a screenshot after expanding
        await page.screenshot({ path: 'types-models-expanded.png' });
        
        // Now look for model sections to expand (Cell, Container, etc.)
        const modelSections = await page.$$('div.ListItemAccordion__ListItemAccordionExpandableDiv-sc-1pcslqd-2');
        console.log(`Found ${modelSections.length} potential model sections`);
        
        // Process each section
        for (let i = 0; i < modelSections.length; i++) {
          const section = modelSections[i];
          const text = await page.evaluate(el => el.textContent.trim(), section);
          
          // Check if this is a model section (contains subtypes)
          if (text.includes('subtypes')) {
            console.log(`Found model section: ${text}`);
            
            // Click to expand
            console.log(`Clicking to expand: ${text}`);
            await section.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // Take a screenshot after expanding all models
        await page.screenshot({ path: 'types-all-expanded.png' });
        
        // Now look for type links again with the specific class
        console.log('Looking for type links after expansion...');
        const expandedTypeLinks = await page.$$('a[class^="TypesBrowser__TypeDetailsLink"]');
        console.log(`Found ${expandedTypeLinks.length} type links after expansion`);
        
        // Process each type link
        for (const link of expandedTypeLinks) {
          const linkInfo = await page.evaluate(el => {
            const text = el.textContent.trim();
            const href = el.getAttribute('href');
            
            // Extract the model name from the link text
            const modelNameMatch = text.match(/Model\[([A-Za-z]+)\]/);
            const modelName = modelNameMatch ? modelNameMatch[1] : '';
            
            // Try to get the description
            let description = '';
            let parent = el.parentElement;
            
            // Navigate up to find a parent with a description
            while (parent && !description) {
              const parentText = parent.textContent.trim();
              if (parentText.length > text.length + 10) {
                // Extract description by removing the link text
                description = parentText.replace(text, '').trim();
                description = description.replace(/^[-:\s]+|[-:\s]+$/g, '').trim();
                break;
              }
              parent = parent.parentElement;
            }
            
            // Try to determine the category/parent model
            let category = '';
            let element = el;
            let levels = 0;
            const maxLevels = 6;
            
            while (element && levels < maxLevels) {
              element = element.parentElement;
              levels++;
              
              if (element) {
                const elementText = element.textContent;
                if (elementText.includes('subtypes')) {
                  const categoryMatch = elementText.match(/([A-Za-z]+)\s+\d+\s+subtypes/);
                  if (categoryMatch) {
                    category = categoryMatch[1];
                    break;
                  }
                }
              }
            }
            
            return {
              name: text,
              modelName: modelName,
              href: href,
              description: description,
              category: category
            };
          }, link);
          
          // Only add if we don't already have this link
          if (!result.types.some(item => item.name === linkInfo.name)) {
            result.types.push(linkInfo);
          }
        }
      }
    }
    
    // Organize the results by category if possible
    const organizedResults = {};
    
    for (const type of result.types) {
      const category = type.category || 'Uncategorized';
      if (!organizedResults[category]) {
        organizedResults[category] = [];
      }
      organizedResults[category].push(type);
    }
    
    result.organizedTypes = organizedResults;
    
    // Final result after all processing
    console.log(`Total models found: ${result.types.length}`);
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Run the scraper
scrapeTypesLinks(); 
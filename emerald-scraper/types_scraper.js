const puppeteer = require('puppeteer');

async function scrapeTypes() {
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
    // First, let's find all the expandable sections (the triangular icons)
    console.log('Looking for expandable sections...');
    
    // These are likely SVG elements or special characters in the DOM
    // Let's try to identify them by their appearance and function
    const expandableSections = await page.$$('svg[transform], path[d*="M0"], div > svg');
    console.log(`Found ${expandableSections.length} potential expandable sections`);
    
    // Also try by finding elements that have triangular icons as children
    const headings = await page.$$('div:has(svg), div:has(path[d*="M"])');
    console.log(`Found ${headings.length} potential section headings`);
    
    // Locate expandable sections from the specific structure we observed
    // The "Models" section with the triangle icon
    const modelsSections = await page.$$('.types-content-container .expandable-section, div:has(> svg)');
    console.log(`Found ${modelsSections.length} model sections`);
    
    // Try to directly find the specific models section based on text content
    const models = await page.evaluate(() => {
      // Look for elements containing the text "Models"
      const elements = Array.from(document.querySelectorAll('div, span, p, h2, h3, h4, h5, h6'));
      return elements
        .filter(el => el.textContent.trim() === 'Models')
        .map(el => ({
          element: el.outerHTML,
          parent: el.parentElement ? el.parentElement.outerHTML.substring(0, 100) : null,
          grandparent: el.parentElement && el.parentElement.parentElement 
            ? el.parentElement.parentElement.outerHTML.substring(0, 100) : null
        }));
    });
    
    console.log(`Found ${models.length} elements with "Models" text`);
    if (models.length > 0) {
      console.log('First Models element:', models[0]);
    }
    
    // Find all the type links (blue Model[Name] links)
    const typeLinks = await page.$$('a[href*="Model"]');
    console.log(`Found ${typeLinks.length} type links`);
    
    // Extract data from each type link
    const typeData = [];
    for (const link of typeLinks) {
      const typeInfo = await page.evaluate(el => {
        const name = el.textContent;
        const href = el.getAttribute('href');
        // Try to get the description that follows the link (usually a sibling or parent's child)
        let description = '';
        
        // Get the next sibling's text if it exists
        if (el.nextSibling) {
          description = el.nextSibling.textContent.trim();
        }
        
        // If description is empty, try parent's text content minus the link text
        if (!description && el.parentElement) {
          const parentText = el.parentElement.textContent;
          description = parentText.replace(name, '').trim();
        }
        
        // Try to get the subtypes count if available (usually near the link)
        let subtypesCount = '';
        const parentElement = el.parentElement;
        if (parentElement) {
          // Look for text with numbers and "subtypes"
          const subtypesMatch = parentElement.textContent.match(/(\d+)\s*subtypes/);
          if (subtypesMatch) {
            subtypesCount = subtypesMatch[1];
          }
        }
        
        return {
          name,
          href,
          description,
          subtypesCount
        };
      }, link);
      
      typeData.push(typeInfo);
    }
    
    console.log('Extracted type data:');
    console.log(JSON.stringify(typeData, null, 2));
    
    // Try to click on expandable sections to reveal more content
    console.log('Attempting to expand sections...');
    
    // First, try to find the Models section and expand it
    const modelsSection = await page.$('div:has(> span:contains("Models"))');
    if (modelsSection) {
      console.log('Found Models section, attempting to expand...');
      await modelsSection.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Click on each model's expand icon to show subtypes
    const modelExpanders = await page.$$('svg[width="10"], svg[height="10"]');
    console.log(`Found ${modelExpanders.length} potential model expanders`);
    
    for (let i = 0; i < Math.min(modelExpanders.length, 5); i++) {
      console.log(`Clicking expander ${i + 1}`);
      try {
        await modelExpanders[i].click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error clicking expander ${i + 1}:`, error.message);
      }
    }
    
    // After expanding, take another snapshot of the data
    const expandedTypeLinks = await page.$$('a[href*="Model"]');
    console.log(`Found ${expandedTypeLinks.length} type links after expansion`);
    
    // Take a screenshot to see the result
    await page.screenshot({ path: 'types-scraped.png' });
    
    // Build result object
    result.types = typeData;
    
    // Write the result to stdout
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Run the scraper
scrapeTypes(); 
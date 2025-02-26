const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeTypesDirectly() {
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
  
  // Take a screenshot of the initial state
  await page.screenshot({ path: 'types-initial-state.png' });
  
  // Result object to store the scraped data
  const result = {
    models: [],
    objects: [],
    allTypes: []
  };
  
  try {
    // Step 1: First, let's expand all the visible accordion elements
    console.log('Finding all expander elements...');
    const expanders = await page.$$('img[class^="ListItemAccordion__ListItemAccordionExpander"]');
    console.log(`Found ${expanders.length} expander elements`);
    
    // Click all expanders to open them
    console.log('Expanding all accordion elements...');
    for (let i = 0; i < expanders.length; i++) {
      try {
        // Check if it's already expanded
        const isExpanded = await page.evaluate(el => {
          return el.getAttribute('alt') === 'collapse' || 
                el.style.transform.includes('rotate(90deg)');
        }, expanders[i]);
        
        if (!isExpanded) {
          console.log(`Clicking expander ${i+1}/${expanders.length}`);
          await expanders[i].click();
          await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between clicks
        } else {
          console.log(`Expander ${i+1}/${expanders.length} is already expanded`);
        }
      } catch (err) {
        console.log(`Error clicking expander ${i+1}: ${err.message}`);
      }
    }
    
    // Take a screenshot after expanding all accordions
    await page.screenshot({ path: 'types-all-expanded.png' });
    
    // Step 2: Now extract all type links
    console.log('Extracting all type links...');
    const typeLinks = await page.$$('a[class^="TypesBrowser__TypeDetailsLink"]');
    console.log(`Found ${typeLinks.length} type links`);
    
    // Process each type link
    for (const link of typeLinks) {
      const linkInfo = await page.evaluate(el => {
        const text = el.textContent.trim();
        const href = el.getAttribute('href');
        
        // Extract the model name from the link text (Model[X])
        const modelNameMatch = text.match(/Model\[([A-Za-z]+)\]/);
        const modelName = modelNameMatch ? modelNameMatch[1] : '';
        
        // Check if it's a Model or Object
        const isModel = text.startsWith('Model[');
        const isObject = text.startsWith('Object[');
        
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
        
        // Try to determine the category by looking at parent elements
        let category = '';
        let categoryEl = el.parentElement;
        let maxLevels = 5;
        
        while (categoryEl && maxLevels > 0) {
          // See if there's a header or span with category info
          const possibleCategoryEl = categoryEl.querySelector('span, h1, h2, h3, h4, h5, h6');
          if (possibleCategoryEl && possibleCategoryEl.textContent.trim() !== text) {
            category = possibleCategoryEl.textContent.trim();
            break;
          }
          categoryEl = categoryEl.parentElement;
          maxLevels--;
        }
        
        return {
          name: text,
          modelName: modelName,
          href: href,
          description: description,
          category: category,
          isModel: isModel,
          isObject: isObject
        };
      }, link);
      
      // Add to the appropriate category
      if (linkInfo.isModel) {
        result.models.push(linkInfo);
      } else if (linkInfo.isObject) {
        result.objects.push(linkInfo);
      }
      
      // Add to all types
      result.allTypes.push(linkInfo);
    }
    
    // Final result after all processing
    console.log(`Total types found: ${result.allTypes.length}`);
    console.log(`Models: ${result.models.length}`);
    console.log(`Objects: ${result.objects.length}`);
    
    // Save the results to a file
    fs.writeFileSync('all_types.json', JSON.stringify(result, null, 2));
    console.log('Results saved to all_types.json');
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Run the scraper
scrapeTypesDirectly(); 
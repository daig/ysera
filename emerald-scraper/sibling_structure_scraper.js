const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeTypesSiblingStructure() {
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
  
  // Function to extract type links from the current page state
  async function extractTypeLinks() {
    const typeLinks = await page.$$('a[class^="TypesBrowser__TypeDetailsLink"]');
    console.log(`Found ${typeLinks.length} type links in current page state`);
    
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
        
        return {
          name: text,
          modelName: modelName,
          href: href,
          description: description,
          isModel: isModel,
          isObject: isObject
        };
      }, link);
      
      // Check if we already have this link (avoid duplicates)
      if (!result.allTypes.some(type => type.name === linkInfo.name)) {
        // Add to the appropriate category
        if (linkInfo.isModel) {
          result.models.push(linkInfo);
        } else if (linkInfo.isObject) {
          result.objects.push(linkInfo);
        }
        
        // Add to all types
        result.allTypes.push(linkInfo);
        console.log(`Added type: ${linkInfo.name}`);
      }
    }
  }
  
  try {
    // First, extract any links visible without expansion
    await extractTypeLinks();
    
    // Identify and handle the expandable sections one at a time
    let moreExpandersExist = true;
    let round = 1;
    
    while (moreExpandersExist) {
      console.log(`\n--- Expansion Round ${round} ---`);
      
      // Find all expander images that are not yet expanded
      const unexpandedExpanders = await page.evaluate(() => {
        const allExpanders = Array.from(document.querySelectorAll('img[class^="ListItemAccordion__ListItemAccordionExpander"]'));
        
        return allExpanders
          .filter(img => {
            // Check if it's not already expanded
            const isExpanded = img.getAttribute('alt') === 'collapse' || 
                              img.style.transform.includes('rotate(90deg)');
            return !isExpanded;
          })
          .map((img, index) => {
            // Get information about this expander
            let headerText = '';
            let headerEl = img.parentElement.querySelector('span');
            if (headerEl) {
              headerText = headerEl.textContent.trim();
            }
            
            return {
              index: index,
              text: headerText
            };
          });
      });
      
      if (unexpandedExpanders.length === 0) {
        console.log('No more unexpanded sections found');
        moreExpandersExist = false;
        break;
      }
      
      console.log(`Found ${unexpandedExpanders.length} unexpanded sections`);
      
      // Click on the first unexpanded expander
      const firstUnexpanded = unexpandedExpanders[0];
      console.log(`Expanding section: "${firstUnexpanded.text}" (${firstUnexpanded.index + 1})`);
      
      // Find and click the expander
      const expanders = await page.$$('img[class^="ListItemAccordion__ListItemAccordionExpander"]');
      
      // Make sure we haven't run out of expanders
      if (firstUnexpanded.index >= expanders.length) {
        console.log('Expander index out of bounds, stopping expansion');
        break;
      }
      
      try {
        // Click to expand
        await expanders[firstUnexpanded.index].click();
        console.log('Clicked expander');
        
        // Wait for expansion
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Take a screenshot after expanding
        await page.screenshot({ path: `types-expanded-round-${round}.png` });
        
        // Extract any newly visible links
        await extractTypeLinks();
      } catch (error) {
        console.error(`Error expanding section ${firstUnexpanded.index}:`, error.message);
        
        // If we run into too many errors, consider stopping
        if (round > 50) {
          console.log('Exceeded maximum expansion rounds, stopping');
          break;
        }
      }
      
      round++;
    }
    
    // Final result after all processing
    console.log(`\n--- Final Results ---`);
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
scrapeTypesSiblingStructure(); 
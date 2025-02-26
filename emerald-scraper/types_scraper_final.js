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
  const result = {
    types: []
  };
  
  try {
    // Take a screenshot of the initial state
    await page.screenshot({ path: 'types-initial-state.png' });
    
    // From the screenshot, we can see blue links like "Model[Cell]", etc.
    // Let's directly scrape these visible links that we can see on the page
    console.log('Scraping visible type links and their descriptions...');
    
    // First, try to find all links on the page (these might include Model links)
    const allLinks = await page.$$('a');
    console.log(`Found ${allLinks.length} links on the page`);
    
    // Process each link to see if it's a Model link
    const modelData = [];
    for (const link of allLinks) {
      const linkInfo = await page.evaluate(el => {
        const href = el.getAttribute('href');
        const text = el.textContent.trim();
        
        // Check if this is a model link (contains "Model[" in text)
        if (text.includes('Model[')) {
          // Try to extract the description
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
          
          // Try to determine the category based on the link text or context
          let category = '';
          const modelNameMatch = text.match(/Model\[([A-Za-z]+)\]/);
          if (modelNameMatch) {
            const modelName = modelNameMatch[1];
            
            // Look for category headers above this element
            let element = el;
            let levels = 0;
            const maxLevels = 6;
            
            while (element && levels < maxLevels) {
              // Move up in the DOM
              element = element.parentElement;
              levels++;
              
              if (element) {
                // Check for header elements or elements with stronger styling
                const headerEls = element.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b, .header, div[class*="header"]');
                for (const headerEl of headerEls) {
                  const headerText = headerEl.textContent.trim();
                  if (headerText && headerText !== text) {
                    category = headerText;
                    break;
                  }
                }
                
                // Also check for elements that might contain subtype counts
                if (!category) {
                  const elementText = element.textContent;
                  if (elementText.includes('subtypes')) {
                    const categoryMatch = elementText.match(/([A-Za-z]+)\s+\d+\s+subtypes/);
                    if (categoryMatch) {
                      category = categoryMatch[1];
                      break;
                    }
                  }
                }
                
                if (category) break;
              }
            }
            
            return {
              type: 'model',
              name: text,
              modelName: modelName,
              href: href,
              description: description,
              category: category
            };
          }
        }
        return null;
      }, link);
      
      if (linkInfo) {
        modelData.push(linkInfo);
      }
    }
    
    console.log(`Found ${modelData.length} model links`);
    
    // Add links to the result
    result.types = modelData;
    
    // Try to click on the Models dropdown to expand and get more content
    console.log('Looking for the Models section to expand...');
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
      
      // Now collect all blue model links again after expansion
      console.log('Collecting all model links after expansion...');
      
      // Try to find links with blue text (likely the Model links)
      const blueLinks = await page.$$('a[style*="color: blue"], a[class*="blue"], a[style*="color:#"], a');
      console.log(`Found ${blueLinks.length} potential model links after expansion`);
      
      // Process each blue link
      for (const link of blueLinks) {
        const linkInfo = await page.evaluate(el => {
          const text = el.textContent.trim();
          const href = el.getAttribute('href');
          
          // Check if this is a model link
          if (text.includes('Model[')) {
            // Try to extract the description
            let description = '';
            let parent = el.parentElement;
            
            // Get description from parent's text
            while (parent && !description) {
              const parentText = parent.textContent.trim();
              if (parentText.length > text.length + 10) {
                description = parentText.replace(text, '').trim();
                description = description.replace(/^[-:\s]+|[-:\s]+$/g, '').trim();
                break;
              }
              parent = parent.parentElement;
            }
            
            // Determine category
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
            
            const modelNameMatch = text.match(/Model\[([A-Za-z]+)\]/);
            const modelName = modelNameMatch ? modelNameMatch[1] : '';
            
            return {
              type: 'model',
              name: text,
              modelName: modelName,
              href: href,
              description: description,
              category: category
            };
          }
          return null;
        }, link);
        
        if (linkInfo && !result.types.some(item => item.name === linkInfo.name)) {
          result.types.push(linkInfo);
        }
      }
    }
    
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
scrapeTypesTree(); 
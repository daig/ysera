const puppeteer = require('puppeteer');

async function scrapeCatalog() {
  // Launch a new browser instance (non-headless)
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null
  });
  
  // Open a new page
  const page = await browser.newPage();
  
  // Navigate to the target URL
  console.error('Navigating to the catalog page...');
  await page.goto('https://www.emeraldcloudlab.com/documentation/objects/');
  
  // Wait for initial page load
  console.error('Waiting for initial page load...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Result object to store the scraped data
  const result = {};
  
  // Stack to keep track of our current path
  const pathStack = [];
  
  // Recursive function to explore the catalog depth-first
  async function exploreCatalog() {
    try {
      const headList = await page.$('div[class*="ObjectBrowser__HeaderContainer-"] + div + div');
      // Get all expandable divs at the current level
      const expandableDivs = await headList.$$(':scope > div > div');
      console.error(`Found ${expandableDivs.length} expandable divs at the top level`);
      
      async function processExpandableDiv(div) {
        // get the header div
        const headerDiv = await div.$(':scope > div[class*="ListItemAccordion__ListItemAccordionExpandableDiv-"]');
        // Get the header text
        const headerTextElement = await headerDiv.$('span');

        if (!headerTextElement) {
          console.error(`No header text found for div ${pathStack.join(' > ')}`);
          console.error(`Found header div: ${await page.evaluate(el => el.outerHTML, headerDiv)}`);
          throw new Error('No header text found');
          return;
        }
        
        // Extract and trim the text content from the header element
        const headerText = await page.evaluate(el => el.textContent.trim(), headerTextElement);
        console.error(`Processing ${div}/${expandableDivs.length}: "${headerText}"`);
        
        // Add to path stack
        pathStack.push(headerText);
        console.error(`Current path: ${pathStack.join(' > ')}`);
        
        // Find and click the expander
        const expanderImg = await headerDiv.$(':scope > img[class*="ListItemAccordion__ListItemAccordionExpander-"]');
        if (!expanderImg) {
          console.error(`No expander found for "${headerText}"`);
          pathStack.pop();
          return;
        }
        
        // Click to expand
        console.error(`Clicking expander for "${headerText}"`);
        await expanderImg.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // After clicking, check for the expanded content
        const expandedList = await div.$(':scope > ul[class*="ObjectBrowser__CatalogBrowserHeaderList-"]');
        
        if (expandedList) {
          console.error('Found expanded list');

          const listItems = await expandedList.$$(':scope > div');
          console.error(`Found ${listItems.length} list items`);

          if (listItems.length > 0) {
            for (const listItem of listItems) {
                // Check if this level has leaf nodes (links)
                const leafLink = await listItem.$(':scope > a');
                if (leafLink) {
                    console.error(`Found leaf link: ${leafLink}`);
                    // Process the leaf links
                    const name = await page.evaluate(el => el.textContent.trim(), leafLink);
                    const url = await page.evaluate(el => el.getAttribute('href'), leafLink);
                    console.error(`LEAF: ${pathStack.join(' > ')} > ${name}, URL: ${url}`);
              
                    // Add to result object
                    let current = result;
                    for (const path of pathStack) {
                        if (!current[path]) current[path] = {};
                        current = current[path];
                    }
              
                    if (!current.items) current.items = [];
                    current.items.push({ name, url });
                }
                else {
                    const nextDiv = await listItem.$(':scope > div');
                    await processExpandableDiv(nextDiv); }
            }
          } else { console.error(`No list items found after clicking "${headerText}"`); }
        } else { console.error(`No expanded list found after clicking "${headerText}"`); }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        pathStack.pop();
      }

      for (let i = 0; i < expandableDivs.length; i++) {
        await processExpandableDiv(expandableDivs[i], i);
      }
    } catch (error) { console.error('Error during exploration:', error); }
  }
  
  try {
    // Start the scraping process
    await exploreCatalog();
    
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
scrapeCatalog();
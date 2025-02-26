const puppeteer = require('puppeteer');

async function exploreTypesPage() {
  // Launch a browser instance (non-headless for visibility)
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null
  });
  
  // Open a new page
  const page = await browser.newPage();
  
  // Navigate to the types URL
  console.log('Navigating to the types page...');
  await page.goto('https://www.emeraldcloudlab.com/documentation/types/');
  
  // Wait for initial page load - increase wait time
  console.log('Waiting for initial page load...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Explore the structure
  console.log('Exploring page structure...');
  
  try {
    // Take an initial screenshot
    await page.screenshot({ path: 'types-initial.png' });
    console.log('Initial screenshot saved as types-initial.png');
    
    // Get the page HTML for debugging
    const pageHtml = await page.evaluate(() => document.body.innerHTML);
    console.log('Page HTML snippet:');
    console.log(pageHtml.substring(0, 2000) + '...');
    
    // Try to find any accordions or expandable elements
    const divs = await page.$$('div');
    console.log(`Found ${divs.length} divs on the page`);
    
    // Look for any elements that match potential expander patterns
    const expanders = await page.$$('img[src*="chevron"]');
    console.log(`Found ${expanders.length} potential expander images (with chevron in src)`);
    
    // Try more generic accordion selectors
    const accordions = await page.$$('div[class*="Accordion"], div[class*="accordion"], div[class*="expandable"], div[class*="Expandable"]');
    console.log(`Found ${accordions.length} potential accordion elements`);
    
    if (expanders.length > 0) {
      console.log('First few expander elements:');
      for (let i = 0; i < Math.min(expanders.length, 3); i++) {
        console.log(`Expander ${i + 1}:`, await page.evaluate(el => el.outerHTML, expanders[i]));
        
        // Try to get parent elements to understand the structure
        const parent = await expanders[i].evaluateHandle(el => el.parentElement);
        console.log(`Expander ${i + 1} parent:`, await page.evaluate(el => el.outerHTML, parent));
      }
      
      // Try to click on the expanders
      console.log('Attempting to click on expanders...');
      for (let i = 0; i < Math.min(expanders.length, 5); i++) {
        console.log(`Clicking expander ${i + 1}`);
        try {
          await expanders[i].click();
          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait longer for expansion
        } catch (error) {
          console.error(`Error clicking expander ${i + 1}:`, error.message);
        }
      }
    }
    
    // Also try to find list items which might be part of the tree structure
    const listItems = await page.$$('li, div[role="listitem"]');
    console.log(`Found ${listItems.length} potential list items`);
    
    // Take a final screenshot after interactions
    await page.screenshot({ path: 'types-after-expansion.png' });
    console.log('After-expansion screenshot saved as types-after-expansion.png');
    
  } catch (error) {
    console.error('Error exploring page structure:', error);
  } finally {
    console.log('Exploration complete. Browser will remain open for manual inspection.');
    console.log('Press Ctrl+C to exit when done.');
    
    // Uncomment to wait indefinitely (to manually inspect the page)
    // await new Promise(resolve => {});
    
    // Wait for a bit before closing browser to allow manual inspection
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
    await browser.close();
  }
}

// Run the explorer
exploreTypesPage(); 
const puppeteer = require('puppeteer');

async function scrapeTypesRecursively() {
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
    types: [],
    hierarchy: {}
  };
  
  // Stack to keep track of our current path in the hierarchy
  const pathStack = [];
  
  // Function to extract type links from the current page state
  async function extractTypeLinks() {
    console.log('Extracting type links from current page state...');
    const typeLinks = await page.$$('a[class^="TypesBrowser__TypeDetailsLink"]');
    console.log(`Found ${typeLinks.length} type links on current page state`);
    
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
          description: description,
          path: [] // Will be filled with the current path
        };
      }, link);
      
      // Add the current path to the link info
      linkInfo.path = [...pathStack];
      
      // Check if we already have this link (avoid duplicates)
      if (!result.types.some(item => item.name === linkInfo.name)) {
        result.types.push(linkInfo);
        console.log(`Added type: ${linkInfo.name}`);
      }
    }
  }
  
  // Recursive function to explore all expandable elements
  async function exploreRecursively(parentElement = null) {
    try {
      // Find all expandable elements (divs containing an img with the expander class)
      const expandableElements = await page.evaluate((parentSelector) => {
        const parent = parentSelector ? document.querySelector(parentSelector) : document.body;
        const allExpanders = parent.querySelectorAll('img[class^="ListItemAccordion__ListItemAccordionExpander"]');
        
        return Array.from(allExpanders).map(img => {
          // Find the closest div container to the expander image
          let container = img;
          while (container && container.tagName !== 'DIV') {
            container = container.parentElement;
          }
          
          // If we found a container div, get its selector path
          if (container) {
            // Use a unique identifier for the container - here we'll use the parent's child index
            const parent = container.parentElement;
            if (parent) {
              const children = Array.from(parent.children);
              const index = children.indexOf(container);
              return {
                id: `#selector-${Date.now()}-${index}`,
                text: container.textContent.trim(),
                // Any other useful info we can extract
              };
            }
          }
          return null;
        }).filter(item => item !== null);
      }, parentElement);
      
      console.log(`Found ${expandableElements.length} expandable elements at current level`);
      
      // First, extract any type links at the current level
      await extractTypeLinks();
      
      // Process each expandable element
      for (const expandable of expandableElements) {
        const headerText = expandable.text.split('\n')[0].trim();
        console.log(`Processing expandable section: "${headerText}"`);
        
        // Add to path stack
        pathStack.push(headerText);
        console.log(`Current path: ${pathStack.join(' > ')}`);
        
        // Find and click the expander img directly
        const expanders = await page.$$('img[class^="ListItemAccordion__ListItemAccordionExpander"]');
        
        let clickedExpander = false;
        
        for (const expander of expanders) {
          const expanderText = await page.evaluate((el, headerText) => {
            let parent = el.parentElement;
            while (parent && !parent.textContent.includes(headerText)) {
              parent = parent.parentElement;
            }
            return parent ? parent.textContent.trim() : '';
          }, expander, headerText);
          
          if (expanderText.includes(headerText)) {
            // Check if it's already expanded
            const isExpanded = await page.evaluate(el => {
              return el.getAttribute('alt') === 'collapse' || 
                    el.style.transform.includes('rotate(90deg)');
            }, expander);
            
            if (!isExpanded) {
              console.log(`Clicking to expand "${headerText}"`);
              await expander.click();
              await new Promise(resolve => setTimeout(resolve, 1000));
              clickedExpander = true;
            } else {
              console.log(`Section "${headerText}" is already expanded`);
              clickedExpander = true;
            }
            break;
          }
        }
        
        if (!clickedExpander) {
          console.log(`Could not find expander for "${headerText}"`);
          pathStack.pop();
          continue;
        }
        
        // Take a screenshot after expanding
        await page.screenshot({ path: `types-expanded-${headerText.replace(/[^a-zA-Z0-9]/g, '_')}.png` });
        
        // Call extractTypeLinks again to capture any newly revealed links
        await extractTypeLinks();
        
        // Now recursively explore this expanded section
        await exploreRecursively();
        
        // Remove from path stack when we're done with this section
        pathStack.pop();
      }
    } catch (error) {
      console.error('Error during recursive exploration:', error);
      console.error('Current path:', pathStack.join(' > '));
    }
  }
  
  try {
    // Start the recursive exploration from the top level
    await exploreRecursively();
    
    // Build the hierarchy based on the collected paths
    for (const type of result.types) {
      let current = result.hierarchy;
      
      // Navigate through the path to build the hierarchy
      for (const pathPart of type.path) {
        if (!current[pathPart]) {
          current[pathPart] = { types: [], children: {} };
        }
        current = current[pathPart].children;
      }
      
      // Add the type to the final level
      if (type.path.length > 0) {
        let lastLevel = result.hierarchy;
        for (let i = 0; i < type.path.length; i++) {
          const pathPart = type.path[i];
          if (i === type.path.length - 1) {
            lastLevel[pathPart].types.push(type.name);
          } else {
            lastLevel = lastLevel[pathPart].children;
          }
        }
      } else {
        // For types at the root level
        if (!result.hierarchy.root) {
          result.hierarchy.root = { types: [], children: {} };
        }
        result.hierarchy.root.types.push(type.name);
      }
    }
    
    // Final result after all processing
    console.log(`Total types found: ${result.types.length}`);
    console.log(JSON.stringify(result, null, 2));
    
    // Save the results to a file
    const fs = require('fs');
    fs.writeFileSync('types_hierarchy.json', JSON.stringify(result, null, 2));
    console.log('Results saved to types_hierarchy.json');
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Run the scraper
scrapeTypesRecursively(); 
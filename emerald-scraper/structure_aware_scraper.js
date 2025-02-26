const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeTypesStructureAware() {
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
        
        // Try to determine the section hierarchy by looking up the DOM
        let sectionPath = [];
        let currentEl = el.parentElement;
        const maxLevels = 5; // Prevent infinite loops
        let level = 0;
        
        while (currentEl && level < maxLevels) {
          // Look for a header or span in parent elements
          const sectionHeader = currentEl.querySelector('span[class*="ListItemAccordion__ListItemAccordionTitle"]');
          if (sectionHeader && sectionHeader.textContent.trim() !== text) {
            sectionPath.unshift(sectionHeader.textContent.trim());
          }
          
          // Move up to parent, checking if we're in a ul
          if (currentEl.tagName === 'UL') {
            // We've reached a list container, move to its parent
            currentEl = currentEl.parentElement;
          } else {
            currentEl = currentEl.parentElement;
          }
          
          level++;
        }
        
        return {
          name: text,
          modelName: modelName,
          href: href,
          description: description,
          sectionPath: sectionPath,
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
    console.log('Extracting initial visible links...');
    await extractTypeLinks();
    
    // Identify and expand all the expandable sections
    console.log('\nFinding all expandable sections...');
    const allExpanders = await page.evaluate(() => {
      const expanders = Array.from(document.querySelectorAll('img[class^="ListItemAccordion__ListItemAccordionExpander"]'));
      
      return expanders.map((img, index) => {
        // Get the header text for this expander
        let headerText = '';
        let headerEl = img.parentElement.querySelector('span');
        if (headerEl) {
          headerText = headerEl.textContent.trim();
        }
        
        // Check if it's already expanded
        const isExpanded = img.getAttribute('alt') === 'collapse' || 
                          img.style.transform.includes('rotate(90deg)');
        
        // Check if it's a top-level section by checking if it's outside of a ul
        let isTopLevel = true;
        let parentEl = img.parentElement;
        
        while (parentEl && parentEl.tagName !== 'BODY') {
          if (parentEl.tagName === 'UL') {
            isTopLevel = false;
            break;
          }
          parentEl = parentEl.parentElement;
        }
        
        return {
          index: index,
          text: headerText,
          isExpanded: isExpanded,
          isTopLevel: isTopLevel,
          shouldSkip: isExpanded || isTopLevel // Skip if expanded or top-level
        };
      });
    });
    
    console.log(`Found ${allExpanders.length} total expanders`);
    console.log(`${allExpanders.filter(e => e.isTopLevel).length} are top-level sections (not in ul elements)`);
    console.log(`${allExpanders.filter(e => e.isExpanded).length} are already expanded`);
    console.log(`${allExpanders.filter(e => !e.shouldSkip).length} need to be expanded`);
    
    // Save the initial screenshots to see the structure
    await page.screenshot({ path: 'types-before-expansion.png' });
    
    // Process each expander that needs to be clicked
    let expandersToClick = allExpanders.filter(e => !e.shouldSkip);
    console.log(`\nWill expand ${expandersToClick.length} sections in sequence`);
    
    // For each expander we need to click
    for (let i = 0; i < expandersToClick.length; i++) {
      const expander = expandersToClick[i];
      console.log(`\n--- Expanding section ${i+1}/${expandersToClick.length}: "${expander.text}" ---`);
      
      try {
        // Get fresh expanders from the page (the DOM changes with each expansion)
        const currentExpanders = await page.$$('img[class^="ListItemAccordion__ListItemAccordionExpander"]');
        
        // Make sure we haven't run out of expanders
        if (expander.index >= currentExpanders.length) {
          console.log('Expander index out of bounds, skipping');
          continue;
        }
        
        // Check again if this expander should be skipped (it might have changed)
        const shouldSkip = await page.evaluate(el => {
          // Check if it's already expanded
          const isExpanded = el.getAttribute('alt') === 'collapse' || 
                            el.style.transform.includes('rotate(90deg)');
          
          // Skip if already expanded
          return isExpanded;
        }, currentExpanders[expander.index]);
        
        if (shouldSkip) {
          console.log('Expander is already expanded, skipping');
          continue;
        }
        
        // Click to expand
        await currentExpanders[expander.index].click();
        console.log('Clicked expander');
        
        // Wait for expansion
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Extract any newly visible links
        await extractTypeLinks();
        
        // If we've done more than 10 expansions, reassess what's left
        if (i > 0 && i % 10 === 0) {
          // Check if there are any new unexpanded elements due to nesting
          const updatedExpanders = await page.evaluate(() => {
            const expanders = Array.from(document.querySelectorAll('img[class^="ListItemAccordion__ListItemAccordionExpander"]'));
            
            return expanders.map((img, index) => {
              // Get the header text for this expander
              let headerText = '';
              let headerEl = img.parentElement.querySelector('span');
              if (headerEl) {
                headerText = headerEl.textContent.trim();
              }
              
              // Check if it's already expanded
              const isExpanded = img.getAttribute('alt') === 'collapse' || 
                                img.style.transform.includes('rotate(90deg)');
              
              // Check if it's a top-level section by checking if it's outside of a ul
              let isTopLevel = true;
              let parentEl = img.parentElement;
              
              while (parentEl && parentEl.tagName !== 'BODY') {
                if (parentEl.tagName === 'UL') {
                  isTopLevel = false;
                  break;
                }
                parentEl = parentEl.parentElement;
              }
              
              return {
                index: index,
                text: headerText,
                isExpanded: isExpanded,
                isTopLevel: isTopLevel,
                shouldSkip: isExpanded || isTopLevel
              };
            });
          });
          
          // Update our list of expanders to click
          expandersToClick = updatedExpanders.filter(e => !e.shouldSkip);
          console.log(`Updated: ${expandersToClick.length} sections still need expansion`);
        }
      } catch (error) {
        console.error(`Error expanding section ${i+1}:`, error.message);
      }
    }
    
    // One final extraction to make sure we got everything
    console.log('\nPerforming final link extraction...');
    await extractTypeLinks();
    
    // Final result after all processing
    console.log(`\n--- Final Results ---`);
    console.log(`Total types found: ${result.allTypes.length}`);
    console.log(`Models: ${result.models.length}`);
    console.log(`Objects: ${result.objects.length}`);
    
    // Group types by section path for better organization
    const groupedTypes = {};
    for (const type of result.allTypes) {
      const path = type.sectionPath.length > 0 ? type.sectionPath.join(' > ') : 'Top Level';
      if (!groupedTypes[path]) {
        groupedTypes[path] = [];
      }
      groupedTypes[path].push(type);
    }
    
    result.groupedBySection = groupedTypes;
    
    // Save the results to a file
    fs.writeFileSync('all_types_structured.json', JSON.stringify(result, null, 2));
    console.log('Results saved to all_types_structured.json');
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Run the scraper
scrapeTypesStructureAware(); 
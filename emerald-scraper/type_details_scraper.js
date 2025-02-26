const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Defines the structure for field metadata
 * @typedef {Object} FieldMetadata
 * @property {string} type - The metadata type (e.g., "Format:", "Class:")
 * @property {string} value - The metadata value (for multi-value fields, this is all values joined by " | ")
 * @property {string|null} link - Optional link URL if the value is a link (for multi-value fields, this is the first link)
 * @property {boolean} isMultiValue - Indicates if this metadata has multiple values
 * @property {Array<{text: string, link: string|null}>} [valueList] - For multi-value fields, an array of value objects
 */

/**
 * Defines the structure for a field
 * @typedef {Object} Field
 * @property {string} name - The name of the field
 * @property {string} description - The description of the field
 * @property {FieldMetadata[]} metadata - Array of metadata for the field
 * @property {Object.<string, FieldMetadata[]>} nestedMetadata - Object containing nested metadata for Multiple format fields
 */

/**
 * Defines the structure for a section
 * @typedef {Object} Section
 * @property {string} title - The title of the section
 * @property {Field[]} fields - Array of fields in the section
 */

/**
 * Parses field metadata from a Bullet div
 * @param {puppeteer.ElementHandle} bulletDiv - The Puppeteer element handle for the Bullet div
 * @returns {Promise<FieldMetadata>} - The parsed metadata
 */
async function parseMetadata(bulletDiv, page) {
  return await page.evaluate((div) => {
    const span = div.querySelector('span');
    if (!span) return null;
    
    const type = span.textContent.trim();
    
    // Special handling for Relation fields which can have multiple values
    if (type === 'Relation:') {
      // Get all anchors in the div
      const anchors = div.querySelectorAll('a');
      
      if (anchors.length > 0) {
        // If we have anchors, extract each one's text and link
        const valueList = [];
        let rawText = div.textContent.trim().substring(type.length).trim();
        
        Array.from(anchors).forEach(anchor => {
          valueList.push({
            text: anchor.textContent.trim(),
            link: anchor.getAttribute('href')
          });
        });
        
        // Return a special format for relations
        return {
          type,
          valueList,
          // Join all texts for backward compatibility
          value: valueList.map(v => v.text).join(' | '),
          link: valueList[0]?.link || null,
          isMultiValue: true
        };
      } else {
        // If no anchors but still might be a list with '|' separator
        let value = div.textContent.trim().substring(type.length).trim();
        if (value.includes(' | ')) {
          const values = value.split(' | ').map(v => ({
            text: v.trim(),
            link: null
          }));
          
          return {
            type,
            valueList: values,
            value,
            link: null,
            isMultiValue: true
          };
        }
      }
    }
    
    // Standard handling for other fields
    let value = '';
    let link = null;
    
    // Check if there's an anchor tag after the span for links
    const anchor = div.querySelector('a');
    if (anchor) {
      value = anchor.textContent.trim();
      link = anchor.getAttribute('href');
    } else {
      // Get text content after the span
      const textContent = div.textContent.trim();
      value = textContent.substring(type.length).trim();
    }
    
    return { type, value, link, isMultiValue: false };
  }, bulletDiv);
}

/**
 * Parses nested metadata for Multiple format fields
 * @param {puppeteer.ElementHandle} container - The container element with nested metadata
 * @returns {Promise<Object.<string, FieldMetadata[]>>} - Object of group name to metadata array
 */
async function parseNestedMetadata(container, page) {
  // Debug: Print the container HTML to understand its structure
  const containerHtml = await page.evaluate(el => el.outerHTML, container);
  console.log('Container HTML:', containerHtml.substring(0, 200) + '...');

  const nestedMetadata = {};
  
  // First, check if there are any h1 elements with 'em' inside
  const groupHeaders = await container.$$('h1 em, h2 em, h3 em, h4 em');
  console.log(`Found ${groupHeaders.length} group headers with 'em' elements`);

  if (groupHeaders.length === 0) {
    // If no group headers found, try looking for Headers in the metadata
    const headerMetadata = await page.evaluate(el => {
      const bullets = Array.from(el.querySelectorAll('.Bullet'));
      const headers = bullets
        .filter(bullet => {
          const span = bullet.querySelector('span');
          return span && span.textContent.trim() === 'Header:';
        })
        .map(bullet => {
          const span = bullet.querySelector('span');
          const textContent = bullet.textContent.trim();
          const headerValue = textContent.substring(span.textContent.trim().length).trim();
          return headerValue;
        });
      return headers;
    }, container);

    console.log('Found header metadata values:', headerMetadata);

    // Group the metadata by headers
    if (headerMetadata.length > 0) {
      // Create a grouped structure based on headers
      const allBullets = await container.$$('.Bullet');
      let currentHeader = null;
      let currentGroup = [];

      for (const bullet of allBullets) {
        const metadata = await parseMetadata(bullet, page);
        
        if (!metadata) continue;
        
        if (metadata.type === 'Header:') {
          // If we were building a group, add it to the result
          if (currentHeader && currentGroup.length > 0) {
            nestedMetadata[currentHeader] = currentGroup;
          }
          
          // Start a new group
          currentHeader = metadata.value;
          currentGroup = [];
        } else if (currentHeader) {
          // Add to the current group
          currentGroup.push(metadata);
        }
      }

      // Add the last group if it exists
      if (currentHeader && currentGroup.length > 0) {
        nestedMetadata[currentHeader] = currentGroup;
      }
    }
  } else {
    // Process each header with em element
    for (const header of groupHeaders) {
      // Get the group name
      const groupName = await page.evaluate(el => el.textContent.trim(), header);
      
      if (!groupName) continue;
      
      console.log(`Processing group: ${groupName}`);
      
      // Find the parent element of this header
      const parentEl = await page.evaluateHandle(el => el.parentElement, header);
      
      // Find the next sibling after the header's parent that contains the hideable div
      const nextSibling = await page.evaluateHandle(el => {
        let current = el.nextElementSibling;
        while (current) {
          if (current.classList.contains('hideable')) {
            return current;
          }
          current = current.nextElementSibling;
        }
        return null;
      }, parentEl);
      
      if (!nextSibling.asElement()) {
        console.log('Could not find hideable div for group:', groupName);
        continue;
      }
      
      // Find all Bullet divs inside the hideable div
      const bulletDivs = await nextSibling.$$('.Bullet');
      console.log(`Found ${bulletDivs.length} bullet divs for group: ${groupName}`);
      
      const metadataItems = [];
      
      for (const bulletDiv of bulletDivs) {
        const metadata = await parseMetadata(bulletDiv, page);
        if (metadata) metadataItems.push(metadata);
      }
      
      nestedMetadata[groupName] = metadataItems;
    }
  }
  
  return nestedMetadata;
}

/**
 * Parses field information from a field-container
 * @param {puppeteer.ElementHandle} fieldContainer - The field container element
 * @returns {Promise<Field>} - The parsed field
 */
async function parseField(fieldContainer, page) {
  // Get the field name from h3 > strong
  const fieldName = await page.evaluate(container => {
    const h3 = container.querySelector('h3');
    if (!h3) return '';
    
    const strong = h3.querySelector('strong');
    return strong ? strong.textContent.trim() : h3.textContent.trim();
  }, fieldContainer);
  
  // Get the field description from the Text div
  const description = await page.evaluate(container => {
    const textDiv = container.querySelector('.field-info .Text');
    return textDiv ? textDiv.textContent.trim() : '';
  }, fieldContainer);
  
  // Get the field info div that contains all metadata
  const fieldInfo = await fieldContainer.$('.field-info');
  if (!fieldInfo) {
    return { name: fieldName, description, metadata: [], nestedMetadata: {} };
  }
  
  // Get all children of the field-info div to process them based on their type
  const children = await page.evaluate(el => {
    const allChildren = Array.from(el.children);
    return allChildren.map(child => ({
      tagName: child.tagName.toLowerCase(),
      className: child.className,
      textContent: child.textContent.trim(),
      hasEm: !!child.querySelector('em'),
      isHideable: child.classList.contains('hideable')
    }));
  }, fieldInfo);
  
  // Regular metadata and grouped metadata containers
  let metadata = [];
  const nestedMetadata = {};
  
  // Process each child based on its type
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    
    // Skip the description Text div, we already got it
    if (child.className === 'Text') continue;
    
    // If it's a Bullet div, process as regular metadata
    if (child.className === 'Bullet') {
      const bulletDiv = await fieldInfo.evaluateHandle(
        (el, idx) => el.children[idx], i
      );
      
      if (bulletDiv.asElement()) {
        const metadataItem = await parseMetadata(bulletDiv.asElement(), page);
        if (metadataItem) metadata.push(metadataItem);
      }
    }
    // If it's an h1 element, it's the start of a nested metadata group
    else if (child.tagName === 'h1' || child.tagName === 'h2' || child.tagName === 'h3' || child.tagName === 'h4') {
      // Get the group name (from the em element or directly from the header)
      const groupName = child.hasEm ? 
        await page.evaluate((el, index) => {
          const em = el.children[index].querySelector('em');
          return em ? em.textContent.trim() : el.children[index].textContent.trim();
        }, fieldInfo, i) : 
        child.textContent;
      
      // Look for a hideable div after this h1 element
      let hideableIdx = -1;
      for (let j = i + 1; j < children.length; j++) {
        if (children[j].isHideable) {
          hideableIdx = j;
          break;
        }
      }
      
      if (hideableIdx !== -1) {
        // Get the hideable div
        const hideableDiv = await fieldInfo.evaluateHandle(
          (el, idx) => el.children[idx], hideableIdx
        );
        
        if (hideableDiv.asElement()) {
          // Find all Bullet divs inside the hideable div
          const bulletDivs = await hideableDiv.asElement().$$('.Bullet');
          const groupMetadata = [];
          
          for (const bulletDiv of bulletDivs) {
            const metadataItem = await parseMetadata(bulletDiv, page);
            if (metadataItem) groupMetadata.push(metadataItem);
          }
          
          // Add this group's metadata to nestedMetadata
          if (groupMetadata.length > 0) {
            nestedMetadata[groupName] = groupMetadata;
          }
          
          // Skip to after the hideable div
          i = hideableIdx;
        }
      }
    }
  }
  
  // Process metadata items that have Header: keys for metadata groups
  let currentHeader = null;
  let currentGroup = [];
  
  // Look for Header: metadata to create additional groups
  for (const item of metadata) {
    if (item.type === 'Header:') {
      // If we were building a group, add it
      if (currentHeader && currentGroup.length > 0) {
        nestedMetadata[currentHeader] = currentGroup;
      }
      
      // Start a new group
      currentHeader = item.value;
      currentGroup = [];
    } else if (currentHeader) {
      // Add to current group if we have a header
      currentGroup.push(item);
    }
  }
  
  // Add the last group if it exists
  if (currentHeader && currentGroup.length > 0) {
    nestedMetadata[currentHeader] = currentGroup;
    
    // Remove Header: entries from the main metadata since they're now in nested groups
    metadata = metadata.filter(item => item.type !== 'Header:');
    
    // Also remove metadata that's already in a group
    const groupedTypes = new Set(Object.values(nestedMetadata)
      .flatMap(group => group.map(item => item.type)));
    
    metadata = metadata.filter(item => !groupedTypes.has(item.type));
  }
  
  console.log(`Field "${fieldName}" metadata: ${metadata.length} items, nested groups: ${Object.keys(nestedMetadata).length}`);
  
  return {
    name: fieldName,
    description,
    metadata,
    nestedMetadata
  };
}

/**
 * Parses a section from the page
 * @param {puppeteer.ElementHandle} sectionElement - The section element
 * @returns {Promise<Section>} - The parsed section
 */
async function parseSection(sectionElement, page) {
  // Get the section title from h1 ::before text using JavaScript in the page context
  const title = await page.evaluate(section => {
    const h1 = section.querySelector('h1');
    if (!h1) return '';
    
    // Get the computed style for the ::before pseudo-element
    const style = window.getComputedStyle(h1, '::before');
    const content = style.getPropertyValue('content');
    
    // Remove quotes from the content string if needed
    let beforeText = content.replace(/^["']|["']$/g, '');
    
    // If we couldn't get the ::before content, use the h1 text
    if (!beforeText || beforeText === 'none') {
      beforeText = '';
    }
    
    // Combine the ::before text with the element's own text
    return (beforeText + ' ' + h1.textContent).trim();
  }, sectionElement);
  
  // Find all field-container divs that are children of the section's ul
  const ul = await sectionElement.$('ul');
  if (!ul) return { title, fields: [] };
  
  const fieldContainers = await ul.$$('div.field-container');
  const fields = [];
  
  // Parse each field container
  for (const fieldContainer of fieldContainers) {
    const field = await parseField(fieldContainer, page);
    fields.push(field);
  }
  
  return { title, fields };
}

/**
 * Main function to scrape a type page
 * @param {string} url - URL of the type page to scrape
 * @param {boolean} [headless=true] - Whether to run in headless mode
 * @returns {Promise<Object>} - The scraped data
 */
async function scrapeTypePage(url, headless = true) {
  console.log(`Scraping type page: ${url}`);
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless,
    defaultViewport: null
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'type_page_screenshot.png' });
    
    // Extract the type name from the URL or page title
    const typeName = await page.evaluate(() => {
      const title = document.title;
      return title.replace(' | Emerald Cloud Lab Documentation', '').trim();
    });
    
    // Extract the type description from the div with class "type-description"
    const typeDescription = await page.evaluate(() => {
      const typeDescriptionDiv = document.querySelector('div.type-description > div');
      return typeDescriptionDiv ? typeDescriptionDiv.textContent.trim() : '';
    });
    
    // Find all sections with class "category"
    const sectionElements = await page.$$('section.category');
    console.log(`Found ${sectionElements.length} sections`);
    
    const sections = [];
    
    // Parse each section
    for (const sectionElement of sectionElements) {
      const section = await parseSection(sectionElement, page);
      sections.push(section);
    }
    
    // Create the result object
    const result = {
      typeName,
      typeDescription,
      url,
      scrapedAt: new Date().toISOString(),
      sections
    };
    
    // Return the scraped data
    return result;
  } catch (error) {
    console.error('Error scraping page:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Save scraped data to a JSON file
 * @param {Object} data - The data to save
 * @param {string} typeName - The name of the type (used for filename)
 */
async function saveData(data, typeName) {
  // Create directory if it doesn't exist
  const dirPath = path.join(__dirname, 'scraped_types');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // Generate filename from type name (replace special characters)
  const fileName = `${typeName.replace(/[\[\]\/:*?"<>|]/g, '_')}.json`;
  const filePath = path.join(dirPath, fileName);
  
  // Write data to file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Data saved to: ${filePath}`);
}

/**
 * Main function to run the scraper
 */
async function main() {
  // Check if all_types_structured.json exists
  const typesFile = path.join(__dirname, 'all_types_structured.json');
  if (!fs.existsSync(typesFile)) {
    console.error('Error: all_types_structured.json not found. Please run the types scraper first.');
    return;
  }
  
  // Load the types data
  const typesData = JSON.parse(fs.readFileSync(typesFile, 'utf8'));
  
  // Get all the types (both models and objects)
  const allTypes = [];
  if (typesData.models) allTypes.push(...typesData.models);
  if (typesData.objects) allTypes.push(...typesData.objects);
  if (typesData.allTypes) allTypes.push(...typesData.allTypes);
  
  console.log(`Loaded ${allTypes.length} types from all_types_structured.json`);
  
  // Get command line arguments for batch processing
  const args = process.argv.slice(2);
  let startIndex = 0;
  let count = 1; // Default to just one type for testing
  
  if (args.length >= 1) {
    startIndex = parseInt(args[0], 10) || 0;
  }
  
  if (args.length >= 2) {
    count = parseInt(args[1], 10) || 1;
  }
  
  // Make sure count doesn't exceed the number of types
  count = Math.min(count, allTypes.length - startIndex);
  
  console.log(`Processing ${count} types starting from index ${startIndex}`);
  
  // Process each type
  for (let i = 0; i < count; i++) {
    const typeIndex = startIndex + i;
    if (typeIndex >= allTypes.length) break;
    
    const type = allTypes[typeIndex];
    
    // Skip types without a href
    if (!type.href) {
      console.log(`Skipping type ${type.name} - no href found`);
      continue;
    }
    
    // Construct the full URL with the toggles=open parameter
    const url = `https://www.emeraldcloudlab.com${type.href}${type.href.includes('?') ? '&' : '?'}toggles=open`;
    
    try {
      console.log(`\nProcessing type ${typeIndex + 1}/${startIndex + count}: ${type.name}`);
      // Use non-headless mode only when testing a single type
      const useHeadless = !(count === 1 && startIndex === 0);
      const result = await scrapeTypePage(url, useHeadless);
      
      // Save the data
      await saveData(result, type.name);
      
      // Output summary
      console.log(`Scraped ${result.sections.length} sections with a total of ${
        result.sections.reduce((sum, section) => sum + section.fields.length, 0)
      } fields`);
      
      // Add a small delay between requests to avoid overloading the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing ${type.name}:`, error.message);
    }
  }
  
  console.log('\nAll done!');
}

// If this script is run directly, execute the main function
if (require.main === module) {
  main();
} 
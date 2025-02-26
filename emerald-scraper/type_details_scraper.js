const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Defines the structure for field metadata
 * @typedef {Object} FieldMetadata
 * @property {string} type - The metadata type (e.g., "Format:", "Class:")
 * @property {string} value - The metadata value
 * @property {string|null} link - Optional link URL if the value is a link
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
    
    return { type, value, link };
  }, bulletDiv);
}

/**
 * Parses nested metadata for Multiple format fields
 * @param {puppeteer.ElementHandle} container - The container element with nested metadata
 * @returns {Promise<Object.<string, FieldMetadata[]>>} - Object of group name to metadata array
 */
async function parseNestedMetadata(container, page) {
  const nestedMetadata = {};
  
  // Find all h1 elements with metadata group names
  const groupHeaders = await container.$$('h1');
  
  for (const header of groupHeaders) {
    // Get the group name from the em element inside h1
    const groupName = await page.evaluate(el => {
      const em = el.querySelector('em');
      return em ? em.textContent.trim() : '';
    }, header);
    
    if (!groupName) continue;
    
    // Find the next hideable div with the metadata
    const hideableDiv = await page.evaluateHandle(el => {
      let current = el.nextElementSibling;
      while (current) {
        if (current.classList.contains('hideable')) {
          return current;
        }
        current = current.nextElementSibling;
      }
      return null;
    }, header);
    
    if (!hideableDiv.asElement()) continue;
    
    // Find all Bullet divs inside the hideable div
    const bulletDivs = await hideableDiv.$$('.Bullet');
    const metadataItems = [];
    
    for (const bulletDiv of bulletDivs) {
      const metadata = await parseMetadata(bulletDiv, page);
      if (metadata) metadataItems.push(metadata);
    }
    
    nestedMetadata[groupName] = metadataItems;
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
  
  // Get the field metadata from Bullet divs
  const bulletDivs = await fieldContainer.$$('.field-info .Bullet');
  const metadata = [];
  let format = null;
  let nestedMetadata = {};
  
  // Process each Bullet div to extract metadata
  for (const bulletDiv of bulletDivs) {
    const metadataItem = await parseMetadata(bulletDiv, page);
    if (metadataItem) {
      metadata.push(metadataItem);
      
      // Check if this is the Format metadata, which determines if we need to parse nested metadata
      if (metadataItem.type === 'Format:') {
        format = metadataItem.value;
      }
    }
  }
  
  // If format is Multiple, parse nested metadata
  if (format === 'Multiple') {
    const fieldInfo = await fieldContainer.$('.field-info');
    if (fieldInfo) {
      nestedMetadata = await parseNestedMetadata(fieldInfo, page);
    }
  }
  
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
 * @returns {Promise<Object>} - The scraped data
 */
async function scrapeTypePage(url) {
  console.log(`Scraping type page: ${url}`);
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    defaultViewport: null
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Extract the type name from the URL or page title
    const typeName = await page.evaluate(() => {
      const title = document.title;
      return title.replace(' | Emerald Cloud Lab Documentation', '').trim();
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
  // Example URL to test the scraper
  const testUrl = 'https://www.emeraldcloudlab.com/helpfiles/types/model_qualification_autoclave?toggles=open';
  
  try {
    const result = await scrapeTypePage(testUrl);
    console.log('Scraping completed successfully');
    
    // Save the data
    await saveData(result, result.typeName);
    
    // Output summary
    console.log(`Scraped ${result.sections.length} sections with a total of ${
      result.sections.reduce((sum, section) => sum + section.fields.length, 0)
    } fields`);
  } catch (error) {
    console.error('Error running scraper:', error);
  }
}

// Run the main function
main(); 
const puppeteer = require('puppeteer');
import { parse } from 'path';
import { Page, ElementHandle } from 'puppeteer';

type Header = { text: string; }
enum ValueType { scalar, subtable }
type Field = { name: string; description: string; }
type FieldValue = { kind: 'link'; link: string; }
                | { kind: 'scalar'; value: string; }
                | { kind: 'subtable'; subtable: FieldValue[][]; }
type Record = { field: Field; value: FieldValue; }
type PlotImage = { src: string; }
type SectionHeader = { name: string; }
type Section = { name: string; records: Record[]; }

type DataTable = { header: string[]; rows: FieldValue[][] }

type TD = { kind: 'field', field: Field }
        | { kind: 'section', section: SectionHeader }
        | { kind: 'plot', plot: PlotImage }
        | { kind: 'value', value: FieldValue}
        | { kind: 'subtable', subtable: DataTable }

type Result = {
  objectName: string;
  img: PlotImage | null;
  sections: Section[];
}

async function getClassName(page: Page, rowDatum: ElementHandle): Promise<string> {
  return await page.evaluate((el: Element) => el.className.split('-')[0], rowDatum);
}

async function parseHeaderTD(page: Page, rowDatum: ElementHandle): Promise<Header> {
    const text = await page.evaluate((el: Element) => el.textContent!.trim(), rowDatum);
    console.log(`Header: ${text}`);
    return { text: text };
}


async function parsePlotImageTD(page: Page, rowDatum: ElementHandle): Promise<PlotImage> {
    // get the nested img element
    const img = await rowDatum.$('img');
    if (!img) throw new Error('Image not found');
    const src = await page.evaluate((el: HTMLImageElement) => el.src, img);
    console.log(`Plot Image: ${src}`);
    return { src: src };
}

async function parseFieldTD(page: Page, rowDatum: ElementHandle): Promise<Field> {
  const name = await page.evaluate((el: Element) => el.textContent!.trim(), rowDatum);
  const description = await page.evaluate((el: Element) => el.getAttribute('title') || '', rowDatum);
  return { name: name, description: description };
}

async function parseSectionHeaderTD(page: Page, rowDatum: ElementHandle): Promise<SectionHeader> {
  const name = await page.evaluate((el: Element) => el.textContent!.trim(), rowDatum);
  return { name: name };
}

async function parseValueTD(page: Page, rowDatum: ElementHandle): Promise<FieldValue> {
  const a = await rowDatum.$('a');
  if (a) {
    const link = await page.evaluate((el: HTMLAnchorElement) => el.href, a);
    console.log(`Link: ${link}`);
    return { kind: 'link', link: link };
  }
  const value = await page.evaluate((el: Element) => el.textContent!.trim(), rowDatum);
  console.log(`Value: ${value}`);
  return { kind: 'scalar', value };
}

async function parseSubtableHeader(page: Page, subtable: ElementHandle): Promise<string[]> {
  const headTR = await subtable.$(':scope > thead[class^="PublishedObject__PublishedObjectSubfieldTableHeader"] > tr[class^="PublishedObject__PublishedObjectSubfieldTableRow"]');
  if (!headTR) throw new Error('Subtable header not found');
  const headers = await headTR.$$(':scope > th[class^="PublishedObject__PublishedObjectSubfieldTableHeaderData"]');
  const headerTexts: string[] = [];
  for (const header of headers) {
    const headerText = await page.evaluate((el: Element) => el.textContent!.trim(), header);
    console.log(`Header: ${headerText}`);
    headerTexts.push(headerText);
  }
  return headerTexts;
}

async function parseSubtableBody(page: Page, subtable: ElementHandle): Promise<FieldValue[][]> {
  const rowsTR = await subtable.$$(':scope > tbody > tr[class^="PublishedObject__PublishedObjectSubfieldTableRow"]');
  console.log(`Rows: ${rowsTR.length}`);
  if (!rowsTR) throw new Error('Subtable body not found');
  const rowData: FieldValue[][] = [];
  for (const row of rowsTR) {
    const cells = await row.$$(':scope > td[class^="PublishedObject__PublishedObjectTableSubFieldValueData"]');
    console.log(`Cells: ${cells.length}`);
    if (!cells) throw new Error('Subtable row not found');
    const rowValues: FieldValue[] = [];
    for (const cell of cells) {
      const cv = await parseValueTD(page, cell);
      if (cv.kind === 'scalar') { rowValues.push(cv); }
      else { throw new Error('Subtable cell is not a scalar'); }
    rowData.push(rowValues.slice());
    }
  }
  return rowData;
}
async function parseSubtableTD(page: Page, rowDatum: ElementHandle): Promise<DataTable> {
  const subtable = await rowDatum.$(':scope > div[class^="PublishedObject__PublishedObjectSubfieldTableContainer"] > table[class^="PublishedObject__PublishedObjectSubfieldTableElement"]');
  if (!subtable) throw new Error('Subtable not found');
  const headerTexts = await parseSubtableHeader(page, subtable);
  const subtableBody = await parseSubtableBody(page, subtable);
  const subtableData: DataTable = { header: headerTexts, rows: subtableBody };
  console.log(`Subtable: ${JSON.stringify(subtableData)}`);
  return subtableData;
}

async function parseTD(page: Page, rowDatum: ElementHandle): Promise<TD> {
  const className = await getClassName(page, rowDatum);
  switch (className) {
    case 'PublishedObject__PublishedObjectTablePlotImageData':
      return { kind: 'plot', plot: await parsePlotImageTD(page, rowDatum) };
    case 'PublishedObject__PublishedObjectTableFieldNameData':
      return { kind: 'field', field: await parseFieldTD(page, rowDatum) };
    case 'PublishedObject__PublishedObjectTableCategoryHeaderData':
      return { kind: 'section', section: await parseSectionHeaderTD(page, rowDatum) };
    case 'PublishedObject__PublishedObjectTableFieldValueData':
      return { kind: 'value', value: await parseValueTD(page, rowDatum) };
    case '': //subtable
      return { kind: 'subtable', subtable: await parseSubtableTD(page, rowDatum) };
    default: 
      throw new Error(`Unknown class name: ${className}`);

     
  }
}

async function processRows(page: Page, result: any, rows: ElementHandle[]): Promise<void> {
    if (rows.length === 0) { console.error('No rows found'); return; }
    const records: Record[] = [];
    var sectionName: string | null = null;
    for (var i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowData = await row.$$(':scope > td');
      var fieldBuffer: Field | null = null;
      for (var j = 0; j < rowData.length; j++) {

        var td = await parseTD(page, rowData[j]);

        switch (td.kind) {
          case 'field':
            console.log(`Field: ${td.field.name}`);
            fieldBuffer = td.field;
            continue;
          case 'value':
            if (fieldBuffer) {
              records.push({ field: fieldBuffer, value: td.value });
              fieldBuffer = null;
            } else { throw new Error('No field found for value'); }
            continue;
          case 'section':
            console.log(`Section: ${td.section.name}`);
            if (sectionName) {
              result.sections.push({ name: sectionName, records: records.slice() });
              sectionName = td.section.name;
            } else if (records.length == 0) {
              sectionName = td.section.name;
            } else { throw new Error('Records found without section name found'); }
            continue;
          case 'plot':
            console.log(`Plot: ${td.plot.src}`);
            result.img = td.plot;
            break;
        }
      }
    }
  result.sections.push({ name: sectionName, records: records.slice() });
  return result;
}

async function scrapeTableData(url: string): Promise<Result> {
  // Launch a new browser instance (non-headless)
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null
  });
  
  // Open a new page
  const page = await browser.newPage();
  
  // Navigate to the target URL
  console.error('Navigating to the documentation page...');
  await page.goto(url);
  
  // Wait for initial page load and table content
  console.error('Waiting for page content to load...');
  await page.waitForSelector('table', { timeout: 10000 });
  
  const result: Result = {
    objectName: '',
    img: null,
    sections: []
  };

  try {
    // First process the main table to get the structure
    const mainTable = await page.$('table[class^="PublishedObject__PublishedObjectTableElement"]');
    if (!mainTable) { throw new Error('Main table not found'); }

    // process main table header
    const mainNameRow = await mainTable.$(':scope > thead > tr > td[colspan="2"]');
    // print the name
    const mainName = await page.evaluate((el: Element) => el.textContent?.trim() || '', mainNameRow);
    result.objectName = mainName;
    console.log(`Object Name: ${mainName}`);

    const mainBody = await mainTable.$(':scope > tbody');
    if (!mainBody) { throw new Error('Table body not found'); }

    const rows = await mainBody.$$(':scope > tr');
    await processRows(page, result, rows);

  } catch (error) { console.error('Error during scraping:', error);
  } finally { await browser.close(); }
  console.log(`Result: ${JSON.stringify(result, null, 2)}`);
  return result;
}





    /*

    // Process main table to get sections and basic key-value pairs
    let currentMainSection = '';
    let currentSubSection = '';
    let currentField = '';

    const rows = await mainTable.$$('tr');
    for (const row of rows) {
      const cells = await row.$$('td');
      
      if (cells.length === 1) {
        // This is a header row
        const text = await page.evaluate(el => el.textContent.trim(), cells[0]);
        
        // Check if this is a main section header
        if (text.endsWith('Information') || 
            text === 'Compatibility' || 
            text === 'Physical Properties' ||
            text === 'Dimensions' ||
            text === 'Container Properties') {
          currentMainSection = text;
          currentSubSection = '';
          currentField = '';
          if (!result.sections[currentMainSection]) {
            result.sections[currentMainSection] = {};
          }
        } else if (!text.includes(':') && !currentMainSection) {
          // This might be the object name/title if we haven't started any section yet
          result.objectName = text;
        } else if (text && !text.includes(':')) {
          // This is likely a subsection header
          currentSubSection = text;
          currentField = '';
          if (!result.sections[currentMainSection][currentSubSection]) {
            result.sections[currentMainSection][currentSubSection] = {};
          }
        }
      } else if (cells.length === 2) {
        // Get both the key cell and value cell data
        const [keyCell, valueCell] = cells;
        
        // Extract text content and title (description) from key cell
        const [key, keyDescription] = await page.evaluate(el => [
          el.textContent.trim(),
          el.getAttribute('title') || ''
        ], keyCell);

        // Check if this field has a subtable by looking for the container div
        const hasSubtable = await page.evaluate(el => {
          const row = el.closest('tr');
          const nextRow = row.nextElementSibling;
          if (!nextRow) return false;
          
          // Check for subtable container
          const container = nextRow.querySelector('.PublishedObject__PublishedObjectSubfieldTableContainer-sc-jhrie7-3');
          if (!container) return false;
          
          // Get the table element to check its class
          const table = container.querySelector('table');
          return table && table.className.includes('PublishedObject__PublishedObjectSubfieldTableElement-sc-jhrie7-4');
        }, keyCell);

        // Extract text content and title (description) from value cell
        const [value, valueDescription] = await page.evaluate(el => [
          el.textContent.trim(),
          el.getAttribute('title') || ''
        ], valueCell);

        if (currentMainSection && key) {
          // Store the current field name for potential subtable association
          currentField = key;
          
          // Create the field data object
          const fieldData = {
            value: hasSubtable ? { type: 'subtable', data: [] } : parseValue(value),
            description: keyDescription || valueDescription || undefined
          };
          
          // Remove undefined description if no descriptions were found
          if (!fieldData.description) {
            delete fieldData.description;
          }
          
          // Add to the appropriate section/subsection
          if (currentSubSection) {
            result.sections[currentMainSection][currentSubSection][key] = fieldData;
          } else {
            result.sections[currentMainSection][key] = fieldData;
          }

          if (hasSubtable) {
            console.error(`Found subtable for field: ${key} in section: ${currentMainSection}${currentSubSection ? ' > ' + currentSubSection : ''}`);
          }
        }
      }
    }

    // Now process all subtables
    const subtables = await page.$$('table.PublishedObject__PublishedObjectSubfieldTableElement-sc-jhrie7-4');
    console.error(`\nFound ${subtables.length} subtables`);

    for (const subtable of subtables) {
      // Get the table's container and context
      const context = await page.evaluate(el => {
        // First get the container div
        const container = el.closest('.PublishedObject__PublishedObjectSubfieldTableContainer-sc-jhrie7-3');
        if (!container) return null;

        // Get the parent row that contains this subtable container
        const containerParent = container.parentElement;
        if (!containerParent || !containerParent.matches('tr')) return null;

        // Get the previous row that contains the field info
        const mainRow = containerParent.previousElementSibling;
        if (!mainRow || !mainRow.matches('tr')) return null;

        // Get the cells from the main row
        const cells = mainRow.querySelectorAll('td');
        if (cells.length !== 2) return null;

        // Get section information by walking up the DOM
        const getSection = (element) => {
          const sections = [];
          let current = element;
          
          while (current) {
            if (current.matches('tr')) {
              const td = current.querySelector('td[colspan="2"]');
              if (td) {
                const text = td.textContent.trim();
                if (text.endsWith('Information') || 
                    text === 'Compatibility' || 
                    text === 'Physical Properties' ||
                    text === 'Dimensions' ||
                    text === 'Container Properties') {
                  sections.unshift({ type: 'main', text });
                } else if (text) {
                  sections.unshift({ type: 'sub', text });
                }
              }
            }
            current = current.previousElementSibling;
          }
          
          return sections;
        };

        const sections = getSection(mainRow);
        const mainSection = sections.find(s => s.type === 'main');
        const subSection = sections.find(s => s.type === 'sub');

        return {
          fieldName: cells[0].textContent.trim(),
          description: cells[0].getAttribute('title') || '',
          section: mainSection ? mainSection.text : null,
          subsection: subSection ? subSection.text : null
        };
      }, subtable);

      if (!context) {
        console.error('Could not determine context for subtable');
        // Debug the DOM structure
        await page.evaluate(el => {
          console.log('Subtable DOM structure:');
          let current = el;
          while (current && current.tagName !== 'TABLE') {
            console.log(`${current.tagName}: ${current.className}`);
            current = current.parentElement;
          }
        }, subtable);
        continue;
      }

      console.error(`\nProcessing subtable for field: ${context.fieldName}`);
      console.error(`Section: ${context.section}${context.subsection ? ' > ' + context.subsection : ''}`);

      // Get the headers with their descriptions
      const headers = await subtable.$$eval('th', ths => 
        ths.map(th => ({
          text: th.textContent.trim(),
          description: th.getAttribute('title') || undefined
        }))
      );

      console.error('Headers:', headers.map(h => h.text).join(', '));

      // Get the data rows
      const rows = await subtable.$$('tbody tr');
      const tableData = [];

      for (const row of rows) {
        const cells = await row.$$('td');
        const rowData = {};
        
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const [value, description] = await page.evaluate(el => [
            el.textContent.trim(),
            el.getAttribute('title') || ''
          ], cell);

          const header = headers[i] || { text: `Column${i + 1}` };
          rowData[header.text] = {
            value: parseValue(value),
            description: description || header.description
          };
        }
        
        tableData.push(rowData);
      }

      // Find where to put this subtable data in the result structure
      let found = false;
      for (const [sectionName, section] of Object.entries(result.sections)) {
        if (sectionName === context.section) {
          if (context.subsection && section[context.subsection]) {
            if (context.fieldName in section[context.subsection]) {
              result.sections[sectionName][context.subsection][context.fieldName].value.data = tableData;
              found = true;
              break;
            }
          } else if (context.fieldName in section) {
            result.sections[sectionName][context.fieldName].value.data = tableData;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        console.error(`Could not find parent field for subtable: ${context.fieldName}`);
        console.error('Available sections:', Object.keys(result.sections).join(', '));
        if (context.section && result.sections[context.section]) {
          console.error('Available fields in section:', Object.keys(result.sections[context.section]).join(', '));
          if (context.subsection && result.sections[context.section][context.subsection]) {
            console.error('Available fields in subsection:', Object.keys(result.sections[context.section][context.subsection]).join(', '));
          }
        }
      } else {
        console.error(`Successfully linked subtable data to field: ${context.fieldName}`);
      }
    }

    // Write the result to stdout
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Helper function to parse different value types
function parseValue(value) {
  // Try to parse numeric values with units
  const numericMatch = value.match(/^(-?\d+\.?\d*)\s+(.+)$/);
  if (numericMatch) {
    return {
      value: parseFloat(numericMatch[1]),
      unit: numericMatch[2]
    };
  }
  
  // Parse object references
  if (value.startsWith('Object[') || value.startsWith('Model[')) {
    const objMatch = value.match(/^(Object|Model)\[(.*?)\]$/);
    if (objMatch) {
      return {
        type: objMatch[1],
        value: objMatch[2].split(', ')
      };
    }
  }
  
  // Parse boolean values
  if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
    return value.toLowerCase() === 'true';
  }
  
  // Return as is if no special parsing needed
  return value;
}
  */

// Run the scraper with the URL
// const url = 'https://www.emeraldcloudlab.com/documentation/publish/object/?id=id:kEJ9mqRV4Ye3';
const url = 'https://www.emeraldcloudlab.com/documentation/publish/object/?id=id:dORYzZJDvjqw';
scrapeTableData(url); 

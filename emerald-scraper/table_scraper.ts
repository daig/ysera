const puppeteer = require('puppeteer');
import { parse } from 'path';
import { Page, ElementHandle } from 'puppeteer';

type Header = { text: string; }
enum ValueType { scalar, subtable }
type Field = { name: string; description: string; }
type FieldValue = { kind: 'link'; link: string; }
                | { kind: 'scalar'; value: string; }
                | { kind: 'subtable'; subtable: DataTable; }
                | { kind: 'list'; values: string[]; }
type Record = { field: Field; value: FieldValue; }
type PlotImage = { src: string; }
type SectionHeader = { name: string; }
type Section = { name: string; records: Record[]; }

type DataTable = { 
  header: string[]; 
  rows: FieldValue[][]; 
}

type ListValue = { values: string[]; }

type TD = { kind: 'field', field: Field }
        | { kind: 'section', section: SectionHeader }
        | { kind: 'plot', plot: PlotImage }
        | { kind: 'value', value: FieldValue}
        | { kind: 'subtable', subtable: DataTable }
        | { kind: 'list', values: ListValue }

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

async function parseListValueDIV(page: Page, rowDatum: ElementHandle): Promise<FieldValue> {
  // If the element itself is the div with the class, use it directly
  const isListDiv = await page.evaluate((el: Element) => 
    el.className.includes('PublishedObject__PublishedObjectMultipleFieldValue'), rowDatum);
  
  let listDiv;
  if (isListDiv) {
    listDiv = rowDatum;
  } else {
    // Otherwise look for a nested div
    listDiv = await rowDatum.$('div[class^="PublishedObject__PublishedObjectMultipleFieldValue"]');
  }
  
  if (!listDiv) throw new Error('List div not found');
  
  const valueTDs = await listDiv.$$('td[class^="PublishedObject__PublishedObjectTableFieldValueData"]');
  const values: string[] = [];
  
  for (const td of valueTDs) {
    const value = await page.evaluate((el: Element) => el.textContent!.trim(), td);
    values.push(value);
  }
  
  console.log(`List values: ${values.join(', ')}`);
  return { kind: 'list', values };
}

async function parseValueTD(page: Page, rowDatum: ElementHandle): Promise<FieldValue> {
  // First check if this is a list value
  const listDiv = await rowDatum.$('div[class^="PublishedObject__PublishedObjectMultipleFieldValue"]');
  if (listDiv) {
    return parseListValueDIV(page, rowDatum);
  }

  // Otherwise handle as before
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
    case 'PublishedObject__PublishedObjectMultipleFieldValue':
      const fieldValue = await parseListValueDIV(page, rowDatum);
      if (fieldValue.kind === 'list') {
        return { kind: 'list', values: { values: fieldValue.values } };
      } else {
        throw new Error('Expected list value from parseListValueDIV');
      }
    default: 
      throw new Error(`Unknown class name: ${className}`);
  }
}

async function processRows(page: Page, result: any, rows: ElementHandle[]): Promise<void> {
    if (rows.length === 0) { console.error('No rows found'); return; }
    let currentRecords: Record[] = [];
    let currentSection: string | null = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowData = await row.$$(':scope > td, :scope > div[class^="PublishedObject__PublishedObjectMultipleFieldValue"]');
      let fieldBuffer: Field | null = null;

      for (let j = 0; j < rowData.length; j++) {
        const td = await parseTD(page, rowData[j]);

        switch (td.kind) {
          case 'field':
            console.log(`Field: ${td.field.name}`);
            fieldBuffer = td.field;
            break;
          case 'value':
            if (fieldBuffer) {
              currentRecords.push({ field: fieldBuffer, value: td.value });
              fieldBuffer = null;
            } else { 
              throw new Error('No field found for value'); 
            }
            break;
          case 'list':
            if (fieldBuffer) {
              console.log(`List for field: ${fieldBuffer.name}`);
              currentRecords.push({ 
                field: fieldBuffer, 
                value: { 
                  kind: 'list', 
                  values: td.values.values 
                } 
              });
              fieldBuffer = null;
            } else {
              throw new Error('No field found for list');
            }
            break;
          case 'subtable':
            if (fieldBuffer) {
              console.log(`Subtable for field: ${fieldBuffer.name}`);
              currentRecords.push({ 
                field: fieldBuffer, 
                value: { 
                  kind: 'subtable', 
                  subtable: td.subtable 
                } 
              });
              fieldBuffer = null;
            } else {
              throw new Error('No field found for subtable');
            }
            break;
          case 'section':
            console.log(`Section: ${td.section.name}`);
            // If we have a previous section, save its records
            if (currentSection) {
              result.sections.push({ 
                name: currentSection, 
                records: [...currentRecords] // Create a new array copy
              });
              currentRecords = []; // Clear records for new section
            }
            currentSection = td.section.name;
            break;
          case 'plot':
            console.log(`Plot: ${td.plot.src}`);
            result.img = td.plot;
            break;
        }
      }
    }

    // Don't forget to add the last section
    if (currentSection && currentRecords.length > 0) {
      result.sections.push({ 
        name: currentSection, 
        records: [...currentRecords]
      });
    }
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

// Run the scraper with the URL
// const url = 'https://www.emeraldcloudlab.com/documentation/publish/object/?id=id:kEJ9mqRV4Ye3';
const url = 'https://www.emeraldcloudlab.com/documentation/publish/object/?id=id:dORYzZJDvjqw';
scrapeTableData(url); 

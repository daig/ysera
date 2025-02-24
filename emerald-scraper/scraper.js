const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function expandAccordion(page, element) {
    try {
        console.log('Attempting to click expander...');
        await element.click();
        console.log('Expander clicked, waiting for content...');
        await sleep(500);
    } catch (error) {
        console.error('Error in expandAccordion:', error);
    }
}

// Store results in memory as backup
const results = [];

// Function to append a result to file
async function appendResult(result) {
    try {
        // If file doesn't exist, create it with opening bracket
        try {
            await fs.access('catalog.json');
        } catch {
            await fs.writeFile('catalog.json', '[\n');
        }

        // Read the file to check if we need a comma
        const content = await fs.readFile('catalog.json', 'utf8');
        const needsComma = content.trim() !== '[';

        // Append the new result
        const resultStr = JSON.stringify(result, null, 2);
        let appendStr = needsComma ? ',\n' + resultStr : resultStr;
        await fs.appendFile('catalog.json', appendStr);

    } catch (error) {
        console.error('Error appending to file:', error);
    }
}

// Function to finalize the JSON file
async function finalizeResults() {
    try {
        await fs.appendFile('catalog.json', '\n]');
    } catch (error) {
        console.error('Error finalizing results file:', error);
    }
}

async function processObjectLink(page, link, path) {
    try {
        const [linkText, href] = await link.evaluate(el => [el.textContent, el.href]);
        const result = {
            path: path.map(p => p.split(' (')[0]), // Remove counts from path components
            text: linkText,
            url: href
        };
        results.push(result);
        console.log('Found object:', path.join(' > '), '>', linkText, '\nURL:', href);
        
        // Append this result to file
        await appendResult(result);
        console.log('Result appended to file');
    } catch (error) {
        console.error('Error in processObjectLink:', error);
    }
}

async function processNestedStructure(page, parentElement, currentPath = []) {
    try {
        console.log('\nProcessing structure for path:', currentPath.join(' > '));
        
        // Find all accordion expandable divs
        const accordionDivs = await parentElement.$$('[class^="ListItemAccordion__ListItemAccordionExpandableDiv"]');
        console.log(`Found ${accordionDivs.length} accordion divs`);
        
        for (const accordionDiv of accordionDivs) {
            console.log('\nChecking accordion div...');
            
            // Find the expander image
            const expander = await accordionDiv.$('[class^="ListItemAccordion__ListItemAccordionExpander"]');
            if (expander) {
                console.log('Found expander element');
                
                // Get category name before expanding
                const categoryText = await accordionDiv.evaluate(el => {
                    console.log('Evaluating category text...');
                    const textEl = el.querySelector('[class^="ObjectBrowser__CatalogBrowserHeaderText"]') || 
                                 el.querySelector('[class^="ObjectBrowser__CatalogBrowserChildText"]');
                    return textEl ? textEl.textContent.trim() : '';
                });
                
                console.log('Category text:', categoryText);
                
                if (categoryText) {
                    currentPath.push(categoryText);
                    console.log('Current path:', currentPath.join(' > '));
                }

                // Expand the accordion
                await expandAccordion(page, expander);

                // Look for object links
                console.log('Looking for object links...');
                const objectLinks = await parentElement.$$('[class^="ObjectBrowser__CatalogBrowserObjectLink"]');
                console.log(`Found ${objectLinks.length} object links`);
                
                for (const link of objectLinks) {
                    await processObjectLink(page, link, currentPath);
                }

                // Find nested catalog browser lists
                console.log('Looking for nested lists...');
                const nestedLists = await parentElement.$$('[class^="ObjectBrowser__CatalogBrowserChildList"]');
                console.log(`Found ${nestedLists.length} nested lists`);
                
                for (const list of nestedLists) {
                    await processNestedStructure(page, list, [...currentPath]);
                }

                if (categoryText) {
                    currentPath.pop();
                    console.log('Popped path back to:', currentPath.join(' > '));
                }
            } else {
                console.log('No expander found in this accordion div');
            }
        }
    } catch (error) {
        console.error('Error in processNestedStructure:', error);
        console.error('Current path when error occurred:', currentPath.join(' > '));
    }
}

async function main() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null
    });

    try {
        // Initialize empty results file
        console.log('Initializing results file...');
        await fs.writeFile('catalog.json', '[\n');

        console.log('Launching browser...');
        const page = await browser.newPage();
        
        // Navigate to the page
        console.log('Navigating to page...');
        await page.goto('https://www.emeraldcloudlab.com/documentation/objects/', {
            waitUntil: 'networkidle0'
        });

        console.log('Waiting for initial page load...');
        
        // Wait for the loading text to disappear
        try {
            console.log('Waiting for loading text to disappear...');
            await page.waitForFunction(
                () => {
                    const hasLoading = document.body.textContent.includes('Loading...');
                    console.log('Has loading text:', hasLoading);
                    return !hasLoading;
                },
                { timeout: 30000 }
            );
            console.log('Loading text gone');
        } catch (error) {
            console.error('Timeout waiting for loading to complete:', error);
            throw error;
        }

        console.log('Looking for top-level categories...');

        // Wait for and get all top-level categories
        console.log('Waiting for expander elements...');
        await page.waitForSelector('[class^="ListItemAccordion__ListItemAccordionExpander"]', { visible: true });
        console.log('Expander elements visible, waiting extra time...');
        await sleep(2000);

        // Get all top-level expanders
        const topLevelExpanders = await page.$$('[class^="ListItemAccordion__ListItemAccordionExpander"]');
        console.log(`Found ${topLevelExpanders.length} top-level expanders`);

        // Log all category names first
        console.log('Category names found:');
        for (const expander of topLevelExpanders) {
            const parentDiv = await expander.evaluateHandle(el => el.closest('[class^="ListItemAccordion__ListItemAccordionExpandableDiv"]'));
            const text = await parentDiv.evaluate(el => {
                const textEl = el.querySelector('[class^="ObjectBrowser__CatalogBrowserHeaderText"]');
                return textEl ? textEl.textContent.trim() : '';
            });
            console.log('- ' + text);
        }

        // Process each top-level category
        for (const expander of topLevelExpanders) {
            // Get category name
            const parentDiv = await expander.evaluateHandle(el => el.closest('[class^="ListItemAccordion__ListItemAccordionExpandableDiv"]'));
            const categoryText = await parentDiv.evaluate(el => {
                const textEl = el.querySelector('[class^="ObjectBrowser__CatalogBrowserHeaderText"]');
                return textEl ? textEl.textContent.trim() : '';
            });
            
            console.log(`\n=== Processing top-level category: ${categoryText} ===`);
            
            // Click to expand
            console.log('Clicking to expand...');
            await expander.click();
            console.log('Clicked, waiting for expansion...');
            await sleep(500);

            // Find and process the expanded content
            console.log('Looking for expanded content...');
            const expandedContent = await page.$('[class^="ObjectBrowser__CatalogBrowserHeaderList"]');
            if (expandedContent) {
                console.log('Found expanded content, processing...');
                await processNestedStructure(page, expandedContent, [categoryText.split(' (')[0]]);
            } else {
                console.log('No expanded content found!');
            }

            // Click again to collapse
            console.log('Collapsing category...');
            await expander.click();
            await sleep(250);
            console.log('Category collapsed');
        }

        // Finalize the JSON file with closing bracket
        console.log('\nFinalizing results file...');
        await finalizeResults();
        console.log('Scraping complete!');

    } catch (error) {
        console.error('Error in main:', error);
        // Attempt to finalize the file even if there was an error
        await finalizeResults();
    } finally {
        console.log('Closing browser...');
        await browser.close();
        console.log('Browser closed');
    }
}

main(); 
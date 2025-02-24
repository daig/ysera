import scrapy
from scrapy.linkextractors import LinkExtractor
from urllib.parse import urlparse, parse_qs, urljoin
import os
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import time

class EmeraldDocsSpider(scrapy.Spider):
    name = "emerald_docs"
    allowed_domains = ['emeraldcloudlab.com', 'www.emeraldcloudlab.com']
    start_urls = [
        'https://www.emeraldcloudlab.com/documentation',
        'https://www.emeraldcloudlab.com/documentation/publish/object/?id=id:eGakldJ6kYpq'
    ]

    def __init__(self):
        super().__init__()  # Call parent's init
        allowed_paths = [
            r'/documentation/.*',
            r'/api/.*',
            r'/guides/.*',
            r'/documentation/publish/.*',
            r'/helpfiles/.*',  # Add helpfiles path
            r'/helpfiles/types/.*'  # Add specific helpfiles types path
        ]
        self.link_extractor = LinkExtractor(
            allow=allowed_paths,
            canonicalize=True,
            allow_domains=self.allowed_domains,
            deny_extensions=[]  # Allow all extensions to catch query params
        )
        # Create docs directory if it doesn't exist
        self.docs_dir = 'docs'
        if not os.path.exists(self.docs_dir):
            os.makedirs(self.docs_dir)
        
        # Keep track of visited URLs to avoid duplicates
        self.visited_urls = set()
        
        # Initialize Selenium WebDriver with Mac-specific Chrome path
        chrome_options = Options()
        chrome_options.add_argument('--headless')  # Run in headless mode
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.binary_location = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        
        # Set up Chrome service
        chrome_service = Service(ChromeDriverManager().install())
        
        self.driver = webdriver.Chrome(service=chrome_service, options=chrome_options)
        self.driver.set_page_load_timeout(30)  # Set page load timeout

    def closed(self, reason):
        # Clean up Selenium WebDriver when spider is closed
        if hasattr(self, 'driver'):
            self.driver.quit()

    def get_rendered_content(self, url):
        try:
            self.driver.get(url)
            
            # Wait for content to load (adjust selectors and timeout as needed)
            try:
                # Wait for the loading text to disappear or for actual content to appear
                WebDriverWait(self.driver, 20).until_not(
                    EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Loading...")
                )
                
                # Additional wait for dynamic content
                time.sleep(3)  # Give extra time for JavaScript to complete
                
                # Get the rendered content
                return self.driver.page_source
            except Exception as e:
                self.logger.error(f"Error waiting for content to load on {url}: {str(e)}")
                return None
        except Exception as e:
            self.logger.error(f"Error loading page {url}: {str(e)}")
            return None

    def start_requests(self):
        for url in self.start_urls:
            yield scrapy.Request(
                url,
                callback=self.parse,
                headers={'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},
                dont_filter=True,  # Allow duplicates for the start URLs
                meta={'selenium': True}  # Mark for Selenium processing
            )

    def parse(self, response):
        # Skip if we've already processed this URL
        if response.url in self.visited_urls:
            return
        self.visited_urls.add(response.url)

        # Get rendered content if needed
        if response.meta.get('selenium', False):
            content = self.get_rendered_content(response.url)
            if not content:
                self.logger.error(f"Failed to get rendered content for {response.url}")
                return
        else:
            content = response.text

        # Parse URL to handle query parameters
        parsed_url = urlparse(response.url)
        path_parts = parsed_url.path.rstrip('/').split('/')
        query_params = parse_qs(parsed_url.query)
        
        # Create filename from path and query parameters
        if path_parts[-1]:
            filename = path_parts[-1]
        else:
            filename = 'index'
            
        # If there are query parameters, append them to filename
        if query_params:
            # Handle specific ID parameter if present
            if 'id' in query_params:
                id_value = query_params['id'][0].replace(':', '_')
                filename = f"{filename}_{id_value}"
        
        filename = filename + '.html'
        
        # Create subdirectories based on path structure
        subpath = '/'.join(path_parts[1:-1])  # Skip first empty part and filename
        if subpath:
            save_dir = os.path.join(self.docs_dir, subpath)
            os.makedirs(save_dir, exist_ok=True)
        else:
            save_dir = self.docs_dir
            
        filepath = os.path.join(save_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        # Create a Selector from the rendered content for link extraction
        sel = scrapy.Selector(text=content)
        
        # Extract and follow links from the rendered content
        # Look for documentation links
        doc_links = sel.css('a[href*="/documentation/"]::attr(href), a[href*="/documentation/publish/"]::attr(href)').getall()
        for href in doc_links:
            absolute_url = urljoin(response.url, href)
            if absolute_url not in self.visited_urls:
                yield scrapy.Request(
                    absolute_url,
                    callback=self.parse,
                    headers={'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},
                    meta={'selenium': True}
                )

        # Look for helpfiles links
        helpfile_links = sel.css('a[href*="/helpfiles/"]::attr(href)').getall()
        for href in helpfile_links:
            absolute_url = urljoin(response.url, href)
            if absolute_url not in self.visited_urls:
                yield scrapy.Request(
                    absolute_url,
                    callback=self.parse,
                    headers={'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},
                    meta={'selenium': True}
                )

        # Look for object links in documentation/publish/object/
        object_links = sel.css('a[href*="/documentation/publish/object/"]::attr(href)').getall()
        for href in object_links:
            absolute_url = urljoin(response.url, href)
            if absolute_url not in self.visited_urls:
                yield scrapy.Request(
                    absolute_url,
                    callback=self.parse,
                    headers={'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},
                    meta={'selenium': True}
                ) 
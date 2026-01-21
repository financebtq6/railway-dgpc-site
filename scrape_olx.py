#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OLX Scraper for Digital PC
Scrapes computer listings from OLX user page and updates products.json
"""

import json
import os
import re
import time
import requests
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# Configuration
OLX_USER_URL = "https://www.olx.ua/uk/list/user/10oQVa/"
DATA_FILE = "data/products.json"
IMAGES_DIR = "images/products"

# Keywords to filter computer ads (case-insensitive)
PC_KEYWORDS = [
    "компьютер", "комп'ютер", "пк", "rtx", "gtx", "ryzen", "intel",
    "core i", "ddr4", "ddr5", "ssd", "nvme", "gaming pc", "ігровий"
]


def setup_driver():
    """Setup Chrome driver with headless mode"""
    print("[*] Setting up Chrome driver...")
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Run in background
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver


def is_computer_ad(title, description=""):
    """Check if ad is about computers based on keywords"""
    text = (title + " " + description).lower()
    return any(keyword.lower() in text for keyword in PC_KEYWORDS)


def extract_id_from_url(url):
    """Extract product ID from OLX URL (e.g., IDXsRs3 -> XsRs3)"""
    match = re.search(r'ID([A-Za-z0-9]+)\.html', url)
    return match.group(1) if match else None


def clean_price(price_text):
    """Extract numeric price from text"""
    # Remove all non-digit characters except spaces
    numbers = re.sub(r'[^\d\s]', '', price_text)
    # Remove spaces and convert to int
    try:
        return int(numbers.replace(' ', ''))
    except:
        return 0


def clean_specs(raw_specs):
    """Clean and format specs to match 22.txt style (bullet points)"""
    if not raw_specs:
        return []
    
    # Split by newlines or common separators
    lines = raw_specs.replace('\\n', '\n').split('\n')
    cleaned = []
    
    for line in lines:
        line = line.strip()
        # Remove leading dashes, bullets, numbers
        line = re.sub(r'^[-•\*\d+\.)\s]+', '', line)
        # Remove price mentions
        if re.search(r'\d+\s*(грн|uah|₴)', line.lower()):
            continue
        # Remove "new/used" indicators
        if any(word in line.lower() for word in ['новий', 'б/в', 'вживаний', 'new', 'used']):
            continue
        # Remove upgrade options (text in parentheses)
        line = re.sub(r'\([^)]*можна[^)]*\)', '', line, flags=re.IGNORECASE)
        line = re.sub(r'\([^)]*або[^)]*\)', '', line, flags=re.IGNORECASE)
        
        line = line.strip()
        if line and len(line) > 3:  # Ignore very short fragments
            cleaned.append(line)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_specs = []
    for spec in cleaned:
        spec_lower = spec.lower()
        if spec_lower not in seen:
            seen.add(spec_lower)
            unique_specs.append(spec)
    
    return unique_specs[:15]  # Limit to 15 specs max


def download_image(url, save_path):
    """Download image from URL"""
    try:
        response = requests.get(url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        if response.status_code == 200:
            with open(save_path, 'wb') as f:
                f.write(response.content)
            return True
    except Exception as e:
        print(f"   [!] Failed to download image: {e}")
    return False


def scrape_olx_listings(driver):
    """Scrape all computer listings from OLX user page"""
    print(f"\n[*] Loading OLX page: {OLX_USER_URL}")
    driver.get(OLX_USER_URL)
    
    # Wait for listings to load
    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-cy='l-card']"))
        )
        time.sleep(2)  # Extra wait for dynamic content
    except Exception as e:
        print(f"[ERROR] Error loading page: {e}")
        return []
    
    # Scroll to load all listings (handle lazy loading)
    last_height = driver.execute_script("return document.body.scrollHeight")
    while True:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1)
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height
    
    # Find all listing cards
    listings = driver.find_elements(By.CSS_SELECTOR, "[data-cy='l-card']")
    print(f"[*] Found {len(listings)} total listings")
    
    products = []
    
    for idx, listing in enumerate(listings, 1):
        try:
            # Extract title
            title_elem = listing.find_element(By.CSS_SELECTOR, "h6")
            title = title_elem.text.strip()
            
            # Extract URL
            link_elem = listing.find_element(By.CSS_SELECTOR, "a")
            url = link_elem.get_attribute("href")
            
            # Filter: only computer ads
            if not is_computer_ad(title):
                print(f"   [SKIP] Not a PC: {title}")
                continue
            
            print(f"\n[OK] [{idx}] Processing: {title}")
            
            # Extract price
            try:
                price_elem = listing.find_element(By.CSS_SELECTOR, "p[data-testid='ad-price']")
                price = clean_price(price_elem.text)
            except:
                price = 0
            
            # Extract ID from URL
            product_id = extract_id_from_url(url)
            if not product_id:
                print(f"   [!] Could not extract ID from URL: {url}")
                continue
            
            # Visit product page for detailed specs and images
            print(f"   [*] Visiting product page...")
            driver.execute_script("window.open('');")
            driver.switch_to.window(driver.window_handles[1])
            driver.get(url)
            
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "div[data-cy='ad_description']"))
                )
            except:
                pass
            
            # Extract description/specs
            try:
                desc_elem = driver.find_element(By.CSS_SELECTOR, "div[data-cy='ad_description']")
                raw_description = desc_elem.text
            except:
                raw_description = ""
            
            specs = clean_specs(raw_description)
            
            # Extract images
            image_urls = []
            try:
                img_elements = driver.find_elements(By.CSS_SELECTOR, "img[data-testid='photo-gallery-image']")
                for img in img_elements[:8]:  # Max 8 images
                    src = img.get_attribute("src")
                    if src and "http" in src:
                        image_urls.append(src)
            except:
                pass
            
            # Download images
            product_img_dir = Path(IMAGES_DIR) / product_id
            product_img_dir.mkdir(parents=True, exist_ok=True)
            
            downloaded_images = []
            for img_idx, img_url in enumerate(image_urls, 1):
                img_path = product_img_dir / f"{img_idx}.jpg"
                print(f"   [*] Downloading image {img_idx}/{len(image_urls)}...")
                if download_image(img_url, img_path):
                    downloaded_images.append(f"./images/products/{product_id}/{img_idx}.jpg")
            
            # Close product page tab
            driver.close()
            driver.switch_to.window(driver.window_handles[0])
            
            # Build product object
            product = {
                "id": product_id,
                "title": title,
                "price": price,
                "image": downloaded_images[0] if downloaded_images else "",
                "images": downloaded_images,
                "specs": specs,
                "description": "Комплектація:\\n• Встановлена Windows 11, усі необхідні драйвери та програми для тестування\\n• Протестований пк в заводському пакуванні\\n• Коробки та інструкції від комплектуючих\\n• Кабель живлення\\n• Гарантійний талон\\n\\n• Повна кастомізація збірки під ваші потреби\\n• Оплата на рахунок ФОП\\n• Оплата частинами від ПриватБанку\\n• Офіційна гарантія",
                "olx_url": url
            }
            
            products.append(product)
            print(f"   [OK] Successfully processed: {product_id}")
            
        except Exception as e:
            print(f"   [ERROR] Error processing listing: {e}")
            continue
    
    return products


def update_products_json(products):
    """Update products.json with scraped data"""
    print(f"\n[*] Updating {DATA_FILE}...")
    
    # Backup existing file
    if os.path.exists(DATA_FILE):
        backup_path = DATA_FILE.replace('.json', '_backup.json')
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            with open(backup_path, 'w', encoding='utf-8') as bf:
                bf.write(f.read())
        print(f"   [*] Backup created: {backup_path}")
    
    # Write new data
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    
    print(f"   [OK] Updated with {len(products)} products")


def main():
    """Main execution"""
    print("=" * 60)
    print(" OLX SCRAPER FOR DIGITAL PC")
    print("=" * 60)
    
    driver = None
    try:
        driver = setup_driver()
        products = scrape_olx_listings(driver)
        
        if products:
            update_products_json(products)
            print(f"\n[SUCCESS] Scraped {len(products)} computer listings")
        else:
            print("\n[WARNING] No computer listings found")
        
    except Exception as e:
        print(f"\n[CRITICAL ERROR] {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        if driver:
            driver.quit()
            print("\n[*] Browser closed")
    
    print("\n" + "=" * 60)
    print(" SCRAPING COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()

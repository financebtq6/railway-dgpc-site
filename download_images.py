# -*- coding: utf-8 -*-
"""
Download images from OLX for all products
This script downloads product images from OLX CDN
"""

import requests
import os
from pathlib import Path
import time

# Sample image URLs from browser extraction
SAMPLE_IMAGES = {
    "WZqWc": [  # Digital PC Esport Odin
        "https://ireland.apollo.olxcdn.com/v1/files/kpv3phcum4i53-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/757ooeotghsr3-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/gds84jokt7me2-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/kv3pf6k8s0mv3-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/1rm9yyy2lmvj3-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/9mju86z5gr8h-UA/image;s=1000x700"
    ],
    "ZG423": [  # Digital PC Apex Monarch
        "https://ireland.apollo.olxcdn.com/v1/files/4h6mo1zjp6hq3-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/jkh940d8p3wg3-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/0h7kq5hsetai2-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/bdq385tb0cag2-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/x97iqumbasvk3-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/pdsilfa09ohl2-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/hk81a3ze4j9o-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/8b4aa2ty3kdh2-UA/image;s=1000x700"
    ],
    "YX0wc": [  # ПК rtx5050
        "https://ireland.apollo.olxcdn.com/v1/files/9g96vzahcj3t-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/jqaojhhrwjdf1-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/0z1chz79xswt2-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/1l4dmb9h13fi-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/lvpc9x0pzw1l3-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/akjdx1p1byzk2-UA/image;s=1000x700",
        "https://ireland.apollo.olxcdn.com/v1/files/qzrw12gynnso3-UA/image;s=1000x700"
    ]
}

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
        else:
            print(f"Failed to download {url}: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

# Download images for sample products
total_downloaded = 0
for product_id, image_urls in SAMPLE_IMAGES.items():
    product_dir = Path(f"images/products/{product_id}")
    product_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\nDownloading images for product {product_id}...")
    for idx, url in enumerate(image_urls, 1):
        save_path = product_dir / f"{idx}.jpg"
        print(f"  [{idx}/{len(image_urls)}] Downloading to {save_path}...")
        if download_image(url, save_path):
            print(f"  [OK] Success")
            total_downloaded += 1
        else:
            print(f"  [FAIL] Failed")
        time.sleep(0.5)  # Be nice to the server

print(f"\n\nTotal images downloaded: {total_downloaded}")
print(f"Images saved to: images/products/")

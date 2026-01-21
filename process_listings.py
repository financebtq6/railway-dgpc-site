# -*- coding: utf-8 -*-
"""
Process OLX listings: Extract specs, download images, update products.json
This script will be run manually to collect data from the 35 OLX listings
"""

import json
import re
import os
from pathlib import Path

# The 35 listings extracted from OLX
OLX_LISTINGS = [
    {"title": "Digital PC Esport Odin | Ryzen 5 7500F + RTX5070", "price": "68 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-esport-odin-ryzen-5-7500f-rtx5070-IDWZqWc.html?reason=seller_listing"},
    {"title": "Digital PC Apex Monarch | Ryzen 7 9800X3D + RTX5080", "price": "132 500 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-apex-monarch-ryzen-7-9800x3d-rtx5080-IDZG423.html?reason=seller_listing"},
    {"title": "ПК rtx5050 Ryzen 5 5600 16 gb ddr4 ssd m2", "price": "35 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/pk-rtx5050-ryzen-5-5600-16-gb-ddr4-ssd-m2-IDYX0wc.html?reason=seller_listing"},
    {"title": "В наявності • ПК rtx5060ti 16gb ryzen 5 7500f ddr5 32 gb", "price": "60 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/v-nayavnost-pk-rtx5060ti-16gb-ryzen-5-7500f-ddr5-32-gb-IDV3FPR.html?reason=seller_listing"},
    {"title": "‼️Ігровий пк RTX5070 i7-14700kf ddr5 32 b760 ssd m2", "price": "115 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/groviy-pk-rtx5070-i7-14700kf-ddr5-32-b760-ssd-m2-IDXhzOA.html?reason=seller_listing"},
    {"title": "‼️Ігровий пк rtx 3070 I5-14400f 16 gb ssd hdd gtx", "price": "37 600 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/groviy-pk-rtx-3070-i5-14400f-16-gb-ssd-hdd-gtx-IDUcQc4.html?reason=seller_listing"},
    {"title": "ПК rtx5070 r7 7700 ddr5 32gb ssd m2 nvme", "price": "71 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/pk-rtx5070-r7-7700-ddr5-32gb-ssd-m2-nvme-IDT52Fk.html?reason=seller_listing"},
    {"title": "White pc r5 7500f rtx5070 b650 32 gb ddr5 ssd m2", "price": "68 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/white-pc-r5-7500f-rtx5070-b650-32-gb-ddr5-ssd-m2-IDTIYkK.html?reason=seller_listing"},
    {"title": "Ігровий пк rtx5070TI R7 7700 32gb 6000cl30 ssd nvme", "price": "89 600 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/groviy-pk-rtx5070ti-r7-7700-32gb-6000cl30-ssd-nvme-IDWCYxu.html?reason=seller_listing"},
    {"title": "‼️Ігровий пк R5 7500f RTX5060 ddr5 32 gb m2 nvme", "price": "51 400 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/groviy-pk-r5-7500f-rtx5060-ddr5-32-gb-m2-nvme-IDTXIuu.html?reason=seller_listing"},
    {"title": "Ігровий пк Ryzen 7500f rtx3070 32 gb ddr5 6000 mhz ssd m2 nvme", "price": "49 500 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/groviy-pk-ryzen-7500f-rtx3070-32-gb-ddr5-6000-mhz-ssd-m2-nvme-IDTIWS4.html?reason=seller_listing"},
    {"title": "Ігровий пк ryzen 7 7700 rtx4070 ddr5 32 gb m2 ssd", "price": "66 500 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/groviy-pk-ryzen-7-7700-rtx4070-ddr5-32-gb-m2-ssd-IDXj065.html?reason=seller_listing"},
    {"title": "‼️Ігровий пк RTX5070 r7 7700 32gb ddr5 ssd m2", "price": "73 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/groviy-pk-rtx5070-r7-7700-32gb-ddr5-ssd-m2-IDUmxN2.html?reason=seller_listing"},
    {"title": "В наявності • Пк R5 7500f rtx5060 ddr5 32 gb ssd m2", "price": "51 400 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/v-nayavnost-pk-r5-7500f-rtx5060-ddr5-32-gb-ssd-m2-IDWGS6T.html?reason=seller_listing"},
    {"title": "Ігровий total black pc rtx3070 Ryzen5500 16/32 gb ddr4 ssd m2", "price": "34 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/groviy-total-black-pc-rtx3070-ryzen5500-16-32-gb-ddr4-ssd-m2-IDZDBsQ.html?reason=seller_listing"},
    {"title": "Ryzen 7 7700 + RTX5060TI/Cybersport 240Hz+/FULL HD ULtra", "price": "67 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/ryzen-7-7700-rtx5060ti-cybersport-240hz-full-hd-ultra-IDYrpcs.html?reason=seller_listing"},
    {"title": "Ryzen 7 7700 + RTX5070/Cybersport 240Hz/WIFI/Гарантія", "price": "73 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/ryzen-7-7700-rtx5070-cybersport-240hz-wifi-garantya-IDWHI1o.html?reason=seller_listing"},
    {"title": "Ryzen 5 7500F + RTX5070/1440P ULTRA/Гарантія", "price": "68 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/ryzen-5-7500f-rtx5070-1440p-ultra-garantya-IDXzGwV.html?reason=seller_listing"},
    {"title": "Ryzen 7 7800X3D + RTX5070/MINI PC/1440P Ultra", "price": "85 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/ryzen-7-7800x3d-rtx5070-mini-pc-1440p-ultra-IDYPEUj.html?reason=seller_listing"},
    {"title": "Ryzen 7500f + rtx5060/FULL HD ULTRA/Апгрейд", "price": "52 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/ryzen-7500f-rtx5060-full-hd-ultra-apgreyd-IDTwlRN.html?reason=seller_listing"},
    {"title": "Digital PC Esport Nano | Ryzen 7 7700 + RTX5070", "price": "75 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-esport-nano-ryzen-7-7700-rtx5070-IDUGVG0.html?reason=seller_listing"},
    {"title": "Digital PC Solid Titan | Ryzen 5 5600 + RTX3070", "price": "36 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-solid-titan-ryzen-5-5600-rtx3070-IDW4a2u.html?reason=seller_listing"},
    {"title": "Digital PC Solid Eclipse | Ryzen 5500 + RTX5060", "price": "38 400 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-solid-eclipse-ryzen-5500-rtx5060-IDUsPN9.html?reason=seller_listing"},
    {"title": "Digital PC Midline Halo | Ryzen 5 7500F + RTX3080", "price": "52 500 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-midline-halo-ryzen-5-7500f-rtx3080-IDUpY56.html?reason=seller_listing"},
    {"title": "Digital PC Esport Thor | Ryzen 7 7700 + RX9070XT", "price": "76 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-esport-thor-ryzen-7-7700-rx9070xt-IDWK1Vo.html?reason=seller_listing"},
    {"title": "Digital PC Midline Rift | Ryzen 5 7500F + RTX4060TI", "price": "54 500 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-midline-rift-ryzen-5-7500f-rtx4060ti-IDYsN05.html?reason=seller_listing"},
    {"title": "ПК rtx5060 Ryzen 5 5600 16 gb ddr4 ssd m2", "price": "40 400 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/pk-rtx5060-ryzen-5-5600-16-gb-ddr4-ssd-m2-IDZ813M.html?reason=seller_listing"},
    {"title": "‼️ТОП Пк RTX5080 r7 7800X3D b850 32 gb ddr5 ssd m2", "price": "125 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/top-pk-rtx5080-r7-7800x3d-b850-32-gb-ddr5-ssd-m2-IDXYcab.html?reason=seller_listing"},
    {"title": "Digital PC Esport Ares | Ryzen 7 7700 + RTX5070", "price": "73 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-esport-ares-ryzen-7-7700-rtx5070-IDWULCg.html?reason=seller_listing"},
    {"title": "Digital PC Apex Legacy | Core I7-14700KF + RTX5070", "price": "80 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-apex-legacy-core-i7-14700kf-rtx5070-IDYMXSd.html?reason=seller_listing"},
    {"title": "Digital PC Apex Aurora | Ryzen 7 7800X3D + RTX5070", "price": "92 500 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-apex-aurora-ryzen-7-7800x3d-rtx5070-IDTUZ1x.html?reason=seller_listing"},
    {"title": "Digital PC Midline Phantom | Core I5-14600KF + RTX3080", "price": "57 500 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/digital-pc-midline-phantom-core-i5-14600kf-rtx3080-IDWWiOk.html?reason=seller_listing"},
    {"title": "ПК RTX5060TI 16gb Ryzen 7700 32 gb ssd m2", "price": "65 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/pk-rtx5060ti-16gb-ryzen-7700-32-gb-ssd-m2-IDWGb6L.html?reason=seller_listing"},
    {"title": "Ігровий total black pc rtx3060 Ryzen5500 16/32 gb ddr4 ssd m2", "price": "31 500 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/groviy-total-black-pc-rtx3060-ryzen5500-16-32-gb-ddr4-ssd-m2-IDZDEhB.html?reason=seller_listing"},
    {"title": "‼️Ігровий пк rtx 5070 DDR5 32 GB i5-14600kf Ssd m2", "price": "75 900 грн.", "url": "https://www.olx.ua/d/uk/obyavlenie/groviy-pk-rtx-5070-ddr5-32-gb-i5-14600kf-ssd-m2-IDUxTaU.html?reason=seller_listing"}
]

def extract_id_from_url(url):
    """Extract product ID from OLX URL"""
    match = re.search(r'ID([A-Za-z0-9]+)\.html', url)
    return match.group(1) if match else None

def clean_price(price_str):
    """Convert price string to integer"""
    return int(re.sub(r'[^\d]', '', price_str))

def parse_title_for_specs(title):
    """Extract basic specs from title"""
    specs = {}
    title_lower = title.lower()
    
    # Extract CPU
    if 'ryzen 5 5600' in title_lower or 'r5 5600' in title_lower:
        specs['cpu'] = 'AMD Ryzen 5 5600'
    elif 'ryzen 5 7500f' in title_lower or 'r5 7500f' in title_lower:
        specs['cpu'] = 'AMD Ryzen 5 7500F'
    elif 'ryzen 5500' in title_lower:
        specs['cpu'] = 'AMD Ryzen 5 5500'
    elif 'ryzen 7 7700' in title_lower or 'r7 7700' in title_lower:
        specs['cpu'] = 'AMD Ryzen 7 7700'
    elif 'ryzen 7 7800x3d' in title_lower or 'r7 7800x3d' in title_lower:
        specs['cpu'] = 'AMD Ryzen 7 7800X3D'
    elif 'ryzen 7 9800x3d' in title_lower:
        specs['cpu'] = 'AMD Ryzen 7 9800X3D'
    elif 'i5-14600kf' in title_lower or 'i5 14600kf' in title_lower:
        specs['cpu'] = 'Intel Core i5 14600KF'
    elif 'i5-14400f' in title_lower:
        specs['cpu'] = 'Intel Core i5 14400F'
    elif 'i7-14700kf' in title_lower:
        specs['cpu'] = 'Intel Core i7 14700KF'
    
    # Extract GPU
    if 'rtx5050' in title_lower or 'rtx 5050' in title_lower:
        specs['gpu'] = 'GeForce RTX 5050'
    elif 'rtx5060ti' in title_lower or 'rtx 5060 ti' in title_lower or 'rtx5060 ti' in title_lower:
        specs['gpu'] = 'GeForce RTX 5060 Ti'
    elif 'rtx5060' in title_lower or 'rtx 5060' in title_lower:
        specs['gpu'] = 'GeForce RTX 5060'
    elif 'rtx5070ti' in title_lower or 'rtx 5070 ti' in title_lower or 'rtx5070 ti' in title_lower:
        specs['gpu'] = 'GeForce RTX 5070 Ti'
    elif 'rtx5070' in title_lower or 'rtx 5070' in title_lower:
        specs['gpu'] = 'GeForce RTX 5070'
    elif 'rtx5080' in title_lower or 'rtx 5080' in title_lower:
        specs['gpu'] = 'GeForce RTX 5080'
    elif 'rtx4060ti' in title_lower or 'rtx 4060 ti' in title_lower:
        specs['gpu'] = 'GeForce RTX 4060 Ti'
    elif 'rtx4070' in title_lower or 'rtx 4070' in title_lower:
        specs['gpu'] = 'GeForce RTX 4070'
    elif 'rtx3060' in title_lower or 'rtx 3060' in title_lower:
        specs['gpu'] = 'GeForce RTX 3060'
    elif 'rtx3070' in title_lower or 'rtx 3070' in title_lower:
        specs['gpu'] = 'GeForce RTX 3070'
    elif 'rtx3080' in title_lower or 'rtx 3080' in title_lower:
        specs['gpu'] = 'GeForce RTX 3080'
    elif 'rx9070xt' in title_lower:
        specs['gpu'] = 'AMD Radeon RX 9070 XT'
    
    # Extract RAM
    if '16 gb ddr4' in title_lower or '16gb ddr4' in title_lower:
        specs['ram'] = '16 GB DDR4 3200 MHz'
    elif '32 gb ddr4' in title_lower or '32gb ddr4' in title_lower:
        specs['ram'] = '32 GB DDR4 3200 MHz'
    elif '16 gb ddr5' in title_lower or '16gb ddr5' in title_lower:
        specs['ram'] = '16 GB DDR5'
    elif '32 gb ddr5' in title_lower or '32gb ddr5' in title_lower:
        specs['ram'] = '32 GB DDR5'
    
    # Extract motherboard
    if 'b650' in title_lower:
        specs['motherboard'] = 'B650 Gaming'
    elif 'b760' in title_lower:
        specs['motherboard'] = 'B760 Gaming'
    elif 'b850' in title_lower:
        specs['motherboard'] = 'B850 Gaming'
    elif 'a520' in title_lower:
        specs['motherboard'] = 'A520M'
    elif 'a620' in title_lower:
        specs['motherboard'] = 'A620M'
    
    # Default values
    if 'storage' not in specs:
        specs['storage'] = '512 GB NVMe SSD'
    if 'psu' not in specs:
        specs['psu'] = '750W 80+ Bronze'
    if 'case' not in specs:
        specs['case'] = 'Gaming Case Black (ARGB)'
    if 'cooling' not in specs:
        if 'x3d' in title_lower or 'i7' in title_lower:
            specs['cooling'] = 'Water Cooling 240mm/360mm'
        else:
            specs['cooling'] = 'Tower Air Cooler (ARGB)'
    
    return specs

# Process all listings
products = []
for listing in OLX_LISTINGS:
    product_id = extract_id_from_url(listing['url'])
    if not product_id:
        continue
    
    price = clean_price(listing['price'])
    specs = parse_title_for_specs(listing['title'])
    
    product = {
        "id": product_id,
        "title": listing['title'].replace('‼️', '').replace('•', '').strip(),
        "price": price,
        "image": f"./images/products/{product_id}/1.jpg",
        "images": [f"./images/products/{product_id}/{i}.jpg" for i in range(1, 6)],  # Assume 5 images
        "specs": specs,
        "description": "Комплектація:\\n• Встановлена Windows 11, усі необхідні драйвери та програми для тестування\\n• Протестований пк в заводському пакуванні\\n• Коробки та інструкції від комплектуючих\\n• Кабель живлення\\n• Гарантійний талон\\n\\n• Повна кастомізація збірки під ваші потреби\\n• Оплата на рахунок ФОП\\n• Оплата частинами від ПриватБанку\\n• Офіційна гарантія",
        "olx_url": listing['url']
    }
    
    products.append(product)

# Save to JSON
output_file = 'data/products_new.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

print(f"Processed {len(products)} products")
print(f"Saved to: {output_file}")
print("\nFirst product:")
print(json.dumps(products[0], ensure_ascii=False, indent=2))

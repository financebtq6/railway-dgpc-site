import json

# Read the products.json file
with open(r'C:\Users\user\Desktop\старый\backup_scrape_update_2025-12-25\data\products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

# Update all image paths from absolute to relative
for product in products:
    if 'image' in product and product['image'].startswith('/images/'):
        product['image'] = '.' + product['image']
    
    if 'images' in product and isinstance(product['images'], list):
        product['images'] = ['.' + img if img.startswith('/images/') else img for img in product['images']]

# Write back to file
with open(r'C:\Users\user\Desktop\старый\backup_scrape_update_2025-12-25\data\products.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

print("Successfully updated all image paths to relative paths!")
print(f"Total products updated: {len(products)}")

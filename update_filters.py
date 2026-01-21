import re

# Read the file
with open(r'C:\Users\user\Desktop\старый\railway-dgpc-site1\app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Ryzen X3D filter matching
pattern1 = r"(if \(cat === 'Amd ryzen 7'\) return text\.match\(/ryzen\\s\*7/\);)"
replacement1 = r"\1\r\n          if (cat === 'Amd ryzen X3D') return text.match(/ryzen.*x3d|x3d/);"
content = re.sub(pattern1, replacement1, content)

# Add AMD Radeon filter matching  
pattern2 = r"(if \(group === '50 Серія \(50xx\)'\) return text\.match\(/rtx\\s\*50\\d\\d\|50\\d\\d/\);)"
replacement2 = r"\1\r\n          if (group === 'AMD Radeon') return text.match(/amd.*radeon|radeon.*rx|rx\\s*\\d{3,4}/);"
content = re.sub(pattern2, replacement2, content)

# Find and replace storage filter block
storage_start = content.find("// Storage\n    if (activeFilters.storage.length > 0) {")
if storage_start == -1:
    storage_start = content.find("// Storage\r\n    if (activeFilters.storage.length > 0) {")

if storage_start != -1:
    # Find the end of this block (next filter or end of function)
    storage_end = content.find("// RAM Type", storage_start)
    if storage_end == -1:
        storage_end = content.find("// Sort", storage_start)
    
    if storage_end != -1:
        # Extract and replace
        old_block = content[storage_start:storage_end]
        
        new_block = """// Storage
    if (activeFilters.storage.length > 0) {
      result = result.filter(p => {
        const text = getProductText(p);
        return activeFilters.storage.some(f => {
          if (f === 'SSD M.2') return text.match(/ssd.*m\\.?2|m\\.?2.*ssd|nvme/);
          if (f === 'SSD SATA') return text.match(/ssd.*sata|sata.*ssd/) && !text.match(/m\\.?2/);
          if (f === 'HDD') return text.match(/\\bhdd\\b|hard\\s*disk/);
          
          // Keep existing size-based logic
          const num = parseInt(f); // 512 or 1
          const unit = f.includes('TB') ? 'tb' : 'gb';
          return text.includes(num + " " + unit) || text.includes(num + unit);
        });
      });
    }

    """
        
        content = content[:storage_start] + new_block + content[storage_end:]

# Write back
with open(r'C:\Users\user\Desktop\старый\railway-dgpc-site1\app.js', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Filter logic updated successfully!")

# Filter System Analysis & Enhancement Plan

## PHASE 1: EXISTING SYSTEM ANALYSIS

### Current Architecture
**File**: `app.js` (lines 497-687)
**Data Source**: `./data/products.json`

### How Filters Work:

1. **Filter Generation** (`generateFilters()` function):
   - Scans all products in `allProductsData`
   - Extracts text from `title` + `full_specs` fields
   - Uses regex patterns to detect components
   - Populates predefined "buckets" (categories)
   - Renders checkboxes for detected options

2. **Filter Application** (`applyFilters()` function):
   - Reads checked checkboxes from DOM
   - Updates `activeFilters` state object
   - Triggers `renderApp()` to re-render catalog

3. **Data Filtering** (`getFilteredAndSortedData()` function):
   - Iterates through products
   - Applies regex/text matching for each filter category
   - Returns filtered array

### Current Filter Categories & Detection Logic:

#### CPU (lines 542-545):
```javascript
buckets.cpu = {
  'Intel core i5': false,  // Regex: /core\s*i5|i5-\d/
  'Intel core i7': false,  // Regex: /core\s*i7|i7-\d/
  'Amd ryzen 5': false,    // Regex: /ryzen\s*5/
  'Amd ryzen 7': false     // Regex: /ryzen\s*7/
}
```

#### RAM Type (lines 513-516):
```javascript
buckets.ramType = {
  'DDR4': false,  // Text match: 'ddr4'
  'DDR5': false   // Text match: 'ddr5'
}
```

#### RAM Size (lines 517-521):
```javascript
buckets.ramSize = {
  '16 GB': false,  // Regex: /16\s*gb/
  '32 GB': false,  // Regex: /32\s*gb/
  '64 GB': false   // Regex: /64\s*gb/
}
```

#### Storage (lines 522-526):
```javascript
buckets.storage = {
  '512 GB': false,  // Regex: /512\s*gb/
  '1 TB': false,    // Regex: /1\s*tb/
  '2 TB': false     // Regex: /2\s*tb/
}
```

#### GPU (lines 527-533):
```javascript
buckets.gpu = {
  '10 Серія (10xx)': false,  // Regex: /gtx\s*10\d\d|10\d\d/
  '20 Серія (20xx)': false,  // Regex: /rtx\s*20\d\d|20\d\d/
  '30 Серія (30xx)': false,  // Regex: /rtx\s*30\d\d|30\d\d/
  '40 Серія (40xx)': false,  // Regex: /rtx\s*40\d\d|40\d\d/
  '50 Серія (50xx)': false   // Regex: /rtx\s*50\d\d|50\d\d/
}
```

### Product Data Structure Example:
```json
{
  "id": "Digital-PC-Base-Unit-Core-I5-12400f-+-RTX4060",
  "title": "Digital PC Base Unit | Core I5-12400f + RTX4060",
  "price": 27500,
  "specs": {
    "cpu": "Intel core i5-12400f",
    "gpu": "Nvidia rtx4060 8 gb Palit oc",
    "storage": "512 GB NVMe SSD"
  },
  "full_specs": { ... }
}
```

**Key Insight**: Filters search in `title` + `full_specs` using lowercase text matching.

---

## PHASE 2: REQUIRED CHANGES

### User Requirements:
1. **Processor**: Add "Ryzen X3D"
2. **RAM Type**: Already has DDR4, DDR5 ✓
3. **RAM Size**: Already has 16/32/64 GB ✓
4. **Storage**: Add "Ssd M2", "Ssd Sata", "HDD"
5. **Graphics Cards**: Add "AMD RADEON"

### Changes Needed:

#### 1. CPU Bucket (Line ~507-511)
**BEFORE**:
```javascript
cpu: {
  'Intel core i5': false,
  'Intel core i7': false,
  'Amd ryzen 5': false,
  'Amd ryzen 7': false
}
```

**AFTER**:
```javascript
cpu: {
  'Intel core i5': false,
  'Intel core i7': false,
  'Amd ryzen 5': false,
  'Amd ryzen 7': false,
  'Amd ryzen X3D': false  // NEW
}
```

#### 2. CPU Detection Logic (Line ~542-545)
**ADD**:
```javascript
if (rawText.match(/ryzen.*x3d|x3d/)) buckets.cpu['Amd ryzen X3D'] = true;
```

#### 3. CPU Filter Logic in getFilteredAndSortedData (Line ~624-628)
**ADD**:
```javascript
if (cat === 'Amd ryzen X3D') return text.match(/ryzen.*x3d|x3d/);
```

#### 4. Storage Bucket (Line ~522-526)
**BEFORE**:
```javascript
storage: {
  '512 GB': false,
  '1 TB': false,
  '2 TB': false
}
```

**AFTER**:
```javascript
storage: {
  'SSD M.2': false,     // NEW
  'SSD SATA': false,    // NEW
  'HDD': false,         // NEW
  '512 GB': false,
  '1 TB': false,
  '2 TB': false
}
```

#### 5. Storage Detection Logic (Line ~558-561)
**ADD**:
```javascript
if (rawText.match(/ssd.*m\.?2|m\.?2.*ssd|nvme/)) buckets.storage['SSD M.2'] = true;
if (rawText.match(/ssd.*sata|sata.*ssd/) && !rawText.match(/m\.?2/)) buckets.storage['SSD SATA'] = true;
if (rawText.match(/\bhdd\b|hard\s*disk/)) buckets.storage['HDD'] = true;
```

#### 6. Storage Filter Logic in getFilteredAndSortedData (Line ~666-673)
**REPLACE** entire storage filter block with:
```javascript
if (activeFilters.storage.length > 0) {
  result = result.filter(p => {
    const text = getProductText(p);
    return activeFilters.storage.some(f => {
      if (f === 'SSD M.2') return text.match(/ssd.*m\.?2|m\.?2.*ssd|nvme/);
      if (f === 'SSD SATA') return text.match(/ssd.*sata|sata.*ssd/) && !text.match(/m\.?2/);
      if (f === 'HDD') return text.match(/\bhdd\b|hard\s*disk/);
      
      // Keep existing size-based logic
      const num = parseInt(f);
      const unit = f.includes('TB') ? 'tb' : 'gb';
      return text.includes(num + " " + unit) || text.includes(num + unit);
    });
  });
}
```

#### 7. GPU Bucket (Line ~527-533)
**ADD** at the end:
```javascript
'AMD Radeon': false  // NEW
```

#### 8. GPU Detection Logic (Line ~562-566)
**ADD**:
```javascript
if (rawText.match(/amd.*radeon|radeon.*rx|rx\s*\d{3,4}/)) buckets.gpu['AMD Radeon'] = true;
```

#### 9. GPU Filter Logic in getFilteredAndSortedData (Line ~636-644)
**ADD**:
```javascript
if (group === 'AMD Radeon') return text.match(/amd.*radeon|radeon.*rx|rx\s*\d{3,4}/);
```

---

## PHASE 3: IMPLEMENTATION TASKS

- [ ] Task 1: Update CPU bucket definition (add Ryzen X3D)
- [ ] Task 2: Add CPU detection regex for X3D
- [ ] Task 3: Add CPU filter matching for X3D
- [ ] Task 4: Update Storage bucket (add SSD M.2, SSD SATA, HDD)
- [ ] Task 5: Add Storage detection regexes
- [ ] Task 6: Update Storage filter logic (hybrid type + size)
- [ ] Task 7: Update GPU bucket (add AMD Radeon)
- [ ] Task 8: Add GPU detection regex for AMD
- [ ] Task 9: Add GPU filter matching for AMD
- [ ] Task 10: Test with existing product
- [ ] Task 11: Verify no breaks in filter functionality

---

## PHASE 4: VERIFICATION PLAN

1. **Start local server**: `python -m http.server 8080`
2. **Test existing product** (Core i5-12400f + RTX4060):
   - Should appear in "Intel core i5" filter
   - Should appear in "40 Серія (40xx)" GPU filter
   - Should appear in "512 GB" storage filter
3. **Test new filters**:
   - Manually check if new options appear (if products contain them)
   - Verify checkbox rendering
   - Verify filter application
4. **Test edge cases**:
   - Multiple filters selected
   - Reset filters button
   - Sorting + filtering combined

---

## CRITICAL NOTES

1. **Regex Precision**: Must avoid false positives (e.g., "SSD M.2" shouldn't match "SSD SATA")
2. **Case Insensitivity**: All text is lowercased before matching
3. **Backward Compatibility**: Existing products must continue to work
4. **Future-Proof**: New products with these specs should auto-populate filters

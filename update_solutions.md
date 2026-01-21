# GitHub Deployment Solutions (Zero Data Loss)

**Objective:** Deploy burger menu fixes and updated reviews to [GitHub](https://github.com/financebtq6/railway-dgpc-site) without overwriting new PC listings added remotely.

**Verified Local Fixes:**
*   **Burger Menu:** Fixed on all 5 pages (`index`, `computers`, `reviews`, `about`, `contacts`) by standardizing `app.js` loading and removing duplicate inline scripts.
*   **Reviews:** Added 10 real Google Maps reviews to `index.html`.

---

## ⚠️ CRITICAL WARNING
**Do NOT** simply drag-and-drop your local `computers.html` or `index.html` to GitHub. The remote GitHub version contains **new PC listings** that exist *only* there. Overwriting files will delete these new products.

---

## Solution A: "Smart Stitching" (Recommended)
*Best for: Absolute safety and precision. Zero chance of accidentally deleting remote products.*

### Step 1: Clone the LIVE Repository
Create a fresh folder (NOT your current working folder) to pull the latest GitHub code.
```powershell
# In your terminal (e.g., Desktop)
mkdir deployment_stage
cd deployment_stage
git clone https://github.com/financebtq6/railway-dgpc-site.git .
```

### Step 2: Apply Fixes Manually (File by File)
Edit the *freshly cloned* files in `deployment_stage` with your fixes.

**1. `index.html` (Reviews Only)**
*   Open `deployment_stage/index.html`.
*   Find the `<div class="reviews-marquee...">` section.
*   Replace **ONLY** the reviews section content with your local real reviews from `C:\Users\user\Desktop\старый\railway-dgpc-site1\index.html`.
*   *Verification:* Ensure you didn't touch the "Featured Computers" list.

**2. `reviews.html` (JS Fix)**
*   Open `deployment_stage/reviews.html`.
*   **Remove** the inline `<script>` block that contains `// Mobile menu toggle` code (usually near bottom).
*   Save.

**3. `computers.html` (JS Fix)**
*   Open `deployment_stage/computers.html`.
*   **Remove** the duplicate inline `<script>` block with `// Mobile menu toggle`.
*   *Verification:* Do NOT touch any product cards or JSON data links.

**4. `about.html` & `contacts.html` (Script Tag Fix)**
*   Open both files.
*   Find: `<script src="app.js" defer></script>`
*   Replace with: `<script src="./app.js?v=8"></script>`
*   Remove any inline `// Mobile menu toggle` scripts if present.

### Step 3: Verify & Push
```powershell
# distinct local change verification
git diff

# If diff shows ONLY reviews/script changes (and NO product deletions), proceed:
git add index.html reviews.html computers.html about.html contacts.html
git commit -m "Fix burger menu on all pages and update reviews"
git push origin main
```
*Railway will automatically detect the push and redeploy.*

---

## Solution B: Git Merge (Advanced)
*Best for: Automated merging if you are comfortable resolving merge conflicts.*

### Step 1: Initialize Git in Local Folder
In your *current working folder* (`C:\Users\user\Desktop\старый\railway-dgpc-site1`):
```powershell
git init
git remote add origin https://github.com/financebtq6/railway-dgpc-site.git
```

### Step 2: Pull & Merge
```powershell
git fetch origin
git switch -c main 
# If main exists locally, use: git checkout main

# Pull remote changes (new PCs) into your local fixes
git pull origin main --allow-unrelated-histories
```

### Step 3: Resolve Conflicts
You will likely get a **MERGE CONFLICT** in `computers.html` and `index.html`.
*   Open the conflicted files depending on your editor (VS Code highlights them).
*   **In `computers.html`**: Keep the *Remote* (Incoming) HTML body (products), but keep *Local* (Current) script fixes at the bottom.
*   **In `index.html`**: Keep *Remote* (Incoming) product sections, but keep *Local* (Current) reviews section.
*   Once fixed, save files.

### Step 4: Finalize
```powershell
git add .
git commit -m "Merge local menu fixes with remote new products"
git push origin main
```

---

## Verification Steps (Post-Deploy)
1.  **Check Site**: Go to your live URL.
2.  **Verify New PCs**: Ensure the new computers added strictly on GitHub are still visible.
3.  **Verify Menu**: Test burger menu on all 5 pages on mobile.
4.  **Verify Reviews**: Check `index.html` for real reviews.

**Recommendation:** Use **Solution A** to guarantee you don't accidentally merge-overwrite the new product data.

# Print System Validation Checklist

## Pre-Deployment Validation

Use this checklist to verify all printing functionality is working correctly.

---

## 1. Unit Test Validation

### Run Tests
```bash
npm test
```

### Expected Results
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Coverage above 80%

### Test Results Log
```
PASS  src/shared/services/__tests__/invoiceRenderer.test.ts
  Invoice Renderer
    ✓ should generate valid HTML structure
    ✓ should include all invoice data
    ✓ should support Arabic RTL text
    ✓ should include print CSS with correct page sizes
    ✓ should format currency correctly
    ✓ should handle thermal printer size
    ✓ should include all invoice items in table
    ✓ should calculate totals correctly
    ✓ should handle empty items array gracefully

PASS  src/shared/services/__tests__/receiptRenderer.test.ts
  Receipt Renderer
    ✓ should generate valid HTML structure
    ✓ should include receipt header with shop name
    ✓ should include date and time
    ✓ should support Arabic RTL text
    ✓ should format items with proper spacing
    ✓ should include thermal printer optimized CSS
    ✓ should show dashed separator lines
    ✓ should calculate and display totals
    ✓ should include payment method
    ✓ should handle single item receipt

PASS  src/shared/services/__tests__/barcodeLabelRenderer.test.ts
  Barcode Label Renderer
    ✓ should generate valid HTML structure
    ✓ should include item barcode
    ✓ should include item name in Arabic
    ✓ should include item price
    ✓ should support 4x6 inch standard thermal label size
    ✓ should support 2.5x3.5 inch small label size
    ✓ should support A4 sheet size
    ✓ should generate multiple labels for requested quantity
    ✓ should support Arabic RTL text
    ✓ should include barcode rendering library reference
    ✓ should handle items with long names

PASS  src/shared/components/__tests__/PrintPreviewDialog.test.tsx
  PrintPreviewDialog
    ✓ should render when open
    ✓ should not render when closed
    ✓ should display print preview in iframe
    ✓ should have print size selector
    ✓ should handle print size changes
    ✓ should have direct print button
    ✓ should call onPrint when direct print button clicked
    ✓ should have browser print dialog option
    ✓ should have save as PDF option
    ✓ should call onSaveAs when save PDF button clicked
    ✓ should have close button
    ✓ should call onClose when close button clicked
    ✓ should be accessible with keyboard navigation

Tests: 44 passed
```

---

## 2. Invoice Printing Validation

### Step 1: Display Test
- [ ] Open invoice in app
- [ ] Click print button
- [ ] PrintPreviewDialog opens

### Step 2: Data Validation
Open DevTools (F12) → Console and check:
```javascript
// In PrintPreviewDialog iframe
document.body.innerText;
```
- [ ] Contains invoice ID (e.g., "INV-001")
- [ ] Contains customer name in Arabic
- [ ] Contains all line items
- [ ] Contains subtotal, tax, and total
- [ ] Numbers are formatted correctly

### Step 3: RTL Text Validation
In DevTools Inspector:
- [ ] Root HTML has `dir="rtl"`
- [ ] Customer name displays right-to-left
- [ ] Item names display right-to-left
- [ ] Arabic text is not reversed

### Step 4: Size Selector Test
- [ ] Click Size dropdown
- [ ] Select "A4" - preview adjusts
- [ ] Select "80×297mm" - preview adjusts for thermal
- [ ] Preview remains readable at all sizes

### Step 5: PDF Export Test
- [ ] Click "Save as PDF"
- [ ] PDF downloads successfully
- [ ] Open PDF in reader
- [ ] Verify:
  - [ ] All content visible
  - [ ] Text is sharp (not blurry)
  - [ ] Arabic flows right-to-left
  - [ ] Numbers are correct
  - [ ] Layout matches selected size

### Step 6: Browser Print Test
- [ ] Click "Browser Dialog"
- [ ] System print dialog opens
- [ ] Preview shows:
  - [ ] Correct number of pages
  - [ ] Content centered
  - [ ] Proper margins
  - [ ] No overlapping elements

---

## 3. Receipt Printing Validation

### Step 1: Display Test
- [ ] Complete a transaction
- [ ] Click print receipt
- [ ] PrintPreviewDialog opens

### Step 2: Content Validation
DevTools Inspector check:
- [ ] Shop name in Arabic at top
- [ ] Date and time visible
- [ ] All items listed with quantities and prices
- [ ] Subtotal, tax, total calculated correctly
- [ ] Payment method shown (e.g., "نقد")

### Step 3: Thermal Format Validation
- [ ] Select "80×297mm" size
- [ ] In preview, verify:
  - [ ] Content fits within 80mm width
  - [ ] No horizontal scrollbar needed
  - [ ] Text is readable
  - [ ] Dashed separators visible

### Step 4: PDF Export and Inspection
- [ ] Click "Save as PDF"
- [ ] Open PDF
- [ ] Verify looks like a receipt:
  - [ ] Narrow width (thermal format)
  - [ ] Header with shop name
  - [ ] Body with items
  - [ ] Footer with totals

---

## 4. Barcode Label Validation

### Step 4.1: Standard Sizes Test
In inventory or products section:
- [ ] Click print barcode button

**4×6 inches (Standard Thermal)**
- [ ] Select "4×6 بوصة" from size dropdown
- [ ] In preview, verify:
  - [ ] Barcode visible and clear
  - [ ] Item name in Arabic visible
  - [ ] Price displayed
  - [ ] Fits on standard thermal label

**2.5×3.5 inches (Small)**
- [ ] Select this size
- [ ] All content still readable
- [ ] Barcode proportions correct

**A4 Sheet**
- [ ] Select this size
- [ ] Multiple labels visible on page
- [ ] Each label clearly separated

### Step 4.2: Barcode Scannability Test
1. Export 4×6 label as PDF
2. Visit: https://onlinebarcodereader.com
3. Upload PDF
4. Click "Scan"
5. Verify:
   - [ ] Barcode recognized
   - [ ] Correct barcode number displayed
   - [ ] Format recognized (CODE128, EAN, etc.)

### Step 4.3: Multiple Labels Test
- [ ] Set quantity to 5
- [ ] Click preview
- [ ] Verify 5 complete labels shown
- [ ] Save as PDF and count labels (should be 5)
- [ ] Each label has correct item info

### Step 4.4: A4 Multi-Label Test
- [ ] Set quantity to 50
- [ ] Select "A4" size
- [ ] Save as PDF
- [ ] Open PDF and verify:
  - [ ] All 50 labels present
  - [ ] Proper grid layout
  - [ ] No labels cut off
  - [ ] Spacing allows for cutting/peeling

---

## 5. Print Preview Dialog Validation

### Step 5.1: UI Elements Test
- [ ] Title displays correctly
- [ ] Iframe shows preview
- [ ] Size selector dropdown visible
- [ ] Print button visible
- [ ] Save PDF button visible
- [ ] Close button visible (X icon)

### Step 5.2: Interaction Test
- [ ] Size dropdown opens and closes
- [ ] Size selection changes preview
- [ ] Buttons are clickable
- [ ] Close button works (dismisses dialog)

### Step 5.3: Accessibility Test
- [ ] Tab key navigates through buttons
- [ ] Enter key activates buttons
- [ ] Dialog can be closed with Escape key
- [ ] Focus is visible (not hidden)

---

## 6. Edge Cases Validation

### Test 6.1: Long Item Names
```
Item: "منتج بطول اسم طويل جداً يحتوي على كلمات عديدة جداً"
```
- [ ] Text wraps properly
- [ ] No overflow or cutoff
- [ ] Label still readable
- [ ] PDF exports correctly

### Test 6.2: Many Items (20+)
- [ ] Create invoice with 20+ items
- [ ] Preview shows all items
- [ ] PDF has multiple pages if needed
- [ ] Page breaks are clean
- [ ] No data loss

### Test 6.3: High-Precision Prices
```
Price: 1,999.99 SAR
```
- [ ] Displays with thousand separator
- [ ] Decimal places show correctly
- [ ] Totals calculate accurately
- [ ] Currency symbol positioned correctly

### Test 6.4: Zero/Null Values
- [ ] Invoice with no tax (tax = 0)
- [ ] Receipt with single item
- [ ] Label with empty description field
- [ ] All should render without errors

---

## 7. Windows CMD Flash Fix Validation

### Step 7.1: Visual Inspection (Windows Only)
When printing:
- [ ] No Command Prompt window flashes
- [ ] No PowerShell window appears
- [ ] Print happens silently in background
- [ ] No system sounds trigger

### Step 7.2: Verify Fix Applied
Check `src-tauri/src/services/print_queue.rs`:
```rust
#[cfg(target_os = "windows")]
{
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    let mut child = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
```
- [ ] `-WindowStyle Hidden` present
- [ ] `CREATE_NO_WINDOW` flag used
- [ ] Code compiled successfully

---

## 8. Arabic RTL Support Validation

### Test 8.1: Text Direction
For all document types:
- [ ] Arabic text flows right-to-left
- [ ] Numbers in Arabic context
- [ ] Mixed Arabic/English text aligned correctly
- [ ] Not reversed or mirrored

### Test 8.2: In Different Sizes
- [ ] Invoice A4 → Arabic RTL ✓
- [ ] Receipt 80mm → Arabic RTL ✓
- [ ] Label 4×6 → Arabic RTL ✓
- [ ] Label A4 → Arabic RTL ✓

### Test 8.3: PDF Quality
- [ ] Open exported PDF
- [ ] Arabic text readable
- [ ] Not corrupted or garbled
- [ ] Font renders properly

---

## 9. Browser Compatibility

### Chrome/Edge
- [ ] Preview loads in iframe
- [ ] All buttons work
- [ ] PDF downloads
- [ ] Print dialog works

### Firefox
- [ ] Preview renders correctly
- [ ] Size selector functional
- [ ] PDF export successful
- [ ] Print dialog works

### Safari (Mac)
- [ ] Dialog displays
- [ ] Print functionality available
- [ ] PDF option works

---

## 10. Final Sign-Off

### Pre-Production Checklist
- [ ] All 44 unit tests pass
- [ ] Invoice printing works end-to-end
- [ ] Receipt printing works in thermal format
- [ ] Barcode labels are scannable
- [ ] PDF export works for all types
- [ ] Browser print dialog works
- [ ] Arabic RTL rendering correct
- [ ] No console errors in DevTools
- [ ] Windows: No CMD flash
- [ ] Edge cases handled gracefully

### Ready for Production?
- [ ] **YES** - All items checked ✓
- [ ] **NO** - Review failing items above

### Validation Date: __________
### Validated By: __________
### Notes: __________

---

## Reporting Issues

If tests fail or validation doesn't pass:

1. **Note the specific issue**
2. **Check console for errors**: F12 → Console
3. **Review corresponding test file**
4. **Check HTML structure**: F12 → Inspector
5. **Verify dimensions**: Size selector working?
6. **Test in different browser**

Common issues and solutions:
- [ ] Preview blank → Check HTML content passed
- [ ] Arabic reversed → Add `dir="rtl"` to parent
- [ ] PDF doesn't save → Check browser file permissions
- [ ] Barcode doesn't scan → Verify barcode number and size
- [ ] Print dialog doesn't open → Check browser compatibility


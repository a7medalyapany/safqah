# Printing System Testing Guide

## Comprehensive Testing Strategy Without Physical Printer

Since you don't have a physical printer, this guide provides a complete workflow to validate all printing functionality using browser tools and PDF inspection.

---

## Part 1: Automated Unit & Integration Tests

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm test -- --watch

# Run tests with coverage report
npm test -- --coverage

# Run specific test file
npm test invoiceRenderer.test.ts
```

### Test Files Location
- `src/shared/services/__tests__/invoiceRenderer.test.ts`
- `src/shared/services/__tests__/receiptRenderer.test.ts`
- `src/shared/services/__tests__/barcodeLabelRenderer.test.ts`
- `src/shared/components/__tests__/PrintPreviewDialog.test.tsx`

### What Tests Cover
✅ HTML structure validation
✅ Arabic RTL text rendering
✅ CSS print directives
✅ Data completeness (names, prices, barcodes)
✅ Component interaction and button clicks
✅ Size selector functionality

---

## Part 2: Manual Browser-Based Testing

### 2.1 Invoice Printing

#### Step 1: View Invoice Preview
1. Open the app and navigate to the Invoices section
2. Click on any invoice's print button
3. The PrintPreviewDialog should open showing a full-page preview

#### Step 2: Verify HTML Content
1. Right-click on the preview → "Inspect" (DevTools)
2. Check the `<iframe>` element contains:
   - Invoice ID (e.g., "INV-001")
   - Customer name in Arabic
   - Item list with prices
   - Correct total calculation
   - `dir="rtl"` attribute for Arabic support

#### Step 3: Test Size Selector
1. Click the "Size" dropdown in the dialog
2. Select different options:
   - **A4**: Full page invoice
   - **80×297mm**: Thermal printer receipt format
3. Preview should adjust and remain readable

#### Step 4: Export as PDF
1. Click "Save as PDF" button
2. Browser will download a PDF file
3. Open the PDF and verify:
   - ✅ All text is readable
   - ✅ Arabic text flows right-to-left
   - ✅ Numbers and totals are correct
   - ✅ Layout matches selected size
   - ✅ Images/logos render properly

#### Step 5: Test Browser Print Dialog
1. Click "Browser Dialog" button
2. Browser's native print dialog opens
3. In the preview:
   - ✅ Text is sharp and readable
   - ✅ No overlapping elements
   - ✅ Margins are appropriate
   - ✅ Page breaks work correctly

---

### 2.2 Receipt Printing

#### Step 1: Generate Test Receipt
1. Create a simple purchase/transaction in the app
2. Click print receipt button
3. PrintPreviewDialog opens with receipt

#### Step 2: Inspect Receipt Format
1. DevTools Inspector → check:
   ```html
   <!-- Look for these elements -->
   <div dir="rtl"> <!-- RTL Support -->
   <h1>متجر الاختبار</h1> <!-- Shop name in Arabic -->
   <table> <!-- Items table -->
   ```

#### Step 3: Test Thermal Printer Format
1. Select "80×297mm" from size dropdown
2. Verify:
   - ✅ Content fits within 80mm width
   - ✅ Text doesn't overflow or wrap awkwardly
   - ✅ Dashed separators are visible
   - ✅ Total is prominent

#### Step 4: Save and Validate PDF
1. Click "Save as PDF"
2. Open PDF and check:
   - ✅ Looks like a receipt (narrow width)
   - ✅ Shop name is at top
   - ✅ Date/time visible
   - ✅ Items listed with prices
   - ✅ Totals at bottom

---

### 2.3 Barcode Label Printing

#### Step 1: Test Standard Label Sizes
1. Navigate to inventory or products
2. Click print barcode button
3. In PrintPreviewDialog, test sizes:

**4×6 inches (Standard Thermal)**
- Click "Size" → select "4×6 بوصة"
- Verify in preview:
  - ✅ Label fits horizontally
  - ✅ Barcode is clear and scannable
  - ✅ Item name visible in Arabic
  - ✅ Price displayed

**2.5×3.5 inches (Small)**
- Select this size
- Verify:
  - ✅ All text remains readable
  - ✅ Barcode not too small

**A4 Sheet**
- Select this size
- Verify:
  - ✅ Multiple labels fit on page (e.g., 8 labels on A4)
  - ✅ Each label is clearly separated

#### Step 2: Test Barcode Scannability (Simulated)
1. Save label as PDF (4×6 size)
2. Use an online barcode scanner:
   - Go to: https://onlinebarcodereader.com
   - Upload the PDF or screenshot
   - Click "Scan"
   - ✅ Barcode should be recognized
   - ✅ It should display the correct barcode number

#### Step 3: Test Multiple Labels
1. Set quantity to 10 in print dialog
2. Check preview contains 10 labels
3. Save as PDF and verify:
   - ✅ All 10 labels present
   - ✅ Each has correct barcode
   - ✅ Each has correct item name

---

## Part 3: PDF Inspection Checklist

### Print Quality Validation

Use a PDF viewer (Chrome built-in, Adobe Reader, or similar) to inspect:

#### Typography
- [ ] Arabic text is right-to-left (not reversed)
- [ ] Font sizes are readable (at least 10pt for body, 14pt+ for headers)
- [ ] No character overlap or corruption
- [ ] Numbers are clear and precise

#### Layout & Spacing
- [ ] Content doesn't overflow margins
- [ ] Tables are properly aligned
- [ ] Dashed separators are visible (for receipts)
- [ ] White space is appropriate

#### Colors & Contrast
- [ ] Black text on white background is sharp
- [ ] No bleeding or fuzzy edges
- [ ] Grid lines in tables are crisp

#### Barcodes
- [ ] Lines are sharp, not fuzzy
- [ ] Quiet zone (white space) around barcode
- [ ] Barcode width/height proportions are correct

---

## Part 4: Network Inspector Validation

### Check Print Command Execution

1. Open DevTools → Network tab
2. Trigger print action
3. Look for API calls to:
   - `invoke('print_invoice')` 
   - `invoke('print_receipt')`
   - `invoke('print_barcode')`
4. Verify responses are successful (200 status)

### Console Validation

1. Open DevTools → Console tab
2. Generate and print a document
3. Check for:
   - ❌ No red errors
   - ❌ No warnings about missing CSS
   - ✅ Success messages (if logged)

---

## Part 5: Edge Case Testing

### Test Scenarios

#### 1. Long Item Names (Arabic)
```
Item: "منتج بطول اسم طويل جداً يحتوي على كلمات عديدة"
- Invoice should wrap text properly
- Receipt should truncate if needed
- Save as PDF and verify readability
```

#### 2. Large Invoice (20+ items)
```
- Create invoice with many line items
- Check page breaks work correctly
- PDF should have multiple pages if needed
- Print dialog should show correct page count
```

#### 3. High-Precision Prices
```
Price: 199.99 SAR
- Verify displays correctly in Arabic and English
- Check currency symbol positioning
- Verify totals calculate correctly
```

#### 4. Multiple Labels (A4 Sheet)
```
- Generate 50 barcode labels on A4
- Save as PDF
- Verify all 50 labels present
- Check alignment and spacing
```

---

## Part 6: Real-World Printer Validation (When Available)

Once you have access to a printer, validate:

### Thermal Printer (80mm)
1. Print receipt in 80×297mm size
2. Check:
   - ✅ Text is readable (not too small)
   - ✅ Barcodes scan correctly
   - ✅ Layout doesn't have unexpected line breaks
   - ✅ Arabic text flows correctly

### Standard Printer (A4)
1. Print full invoice in A4 size
2. Check:
   - ✅ All content visible
   - ✅ No overflow or truncation
   - ✅ Multi-page invoices paginate correctly
   - ✅ Footer/header spacing is good

### Label Printer (4×6)
1. Print barcode labels in 4×6 size
2. Check:
   - ✅ Labels peel off cleanly
   - ✅ Barcodes scan reliably
   - ✅ Text is crisp

---

## Part 7: Success Criteria Checklist

### Unit Tests
- [ ] All renderer tests pass (npm test)
- [ ] Invoice renderer HTML is valid
- [ ] Receipt renderer supports thermal size
- [ ] Barcode renderer generates multiple copies correctly
- [ ] Arabic text support verified in all tests

### Integration Tests
- [ ] PrintPreviewDialog renders correctly
- [ ] Size selector works and changes preview
- [ ] All action buttons (Print, Save, Close) work
- [ ] Dialog is accessible (keyboard navigation works)

### Visual/Manual Tests
- [ ] Invoice PDF looks professional
- [ ] Receipt fits 80mm thermal width
- [ ] Barcode is scannable (online validator confirms)
- [ ] Arabic text is RTL and readable
- [ ] All sizes (A4, 80×297mm, 4×6") work

### Edge Cases
- [ ] Long item names don't break layout
- [ ] 50+ items paginate correctly
- [ ] High-precision prices display correctly
- [ ] Multiple labels generate without errors

### No-Printer Workflow
- [ ] Browser print dialog shows correct preview
- [ ] PDFs save cleanly without corruption
- [ ] Online barcode scanner reads generated barcodes
- [ ] DevTools inspect shows valid HTML structure

---

## Part 8: Debugging Tips

### If Preview Shows Incorrectly

```typescript
// Add to component temporarily
console.log("[v0] HTML Content:", htmlContent);
console.log("[v0] Print Size:", printSize);
console.log("[v0] Document Type:", documentType);
```

### If PDF Doesn't Save
1. Check browser console for JavaScript errors
2. Verify browser allows file downloads
3. Check file permissions in Downloads folder
4. Try different browser (Chrome, Firefox, Safari)

### If Barcode Doesn't Scan
1. Verify barcode number in HTML
2. Check barcode library loaded: `window.JsBarcode`
3. Regenerate with simpler barcode number
4. Try online barcode generator to compare

### If Arabic Text Is LTR Instead of RTL
1. Check `dir="rtl"` attribute on parent element
2. Verify CSS doesn't override text direction
3. Check browser supports Arabic (usually does)
4. Try different browser to isolate issue

---

## Running the Full Test Suite

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Generate HTML coverage report
npm test -- --coverage --coverage.reporter=html

# Open coverage report
open coverage/index.html
```

Expected output:
```
✓ invoiceRenderer.test.ts (10 tests)
✓ receiptRenderer.test.ts (10 tests)
✓ barcodeLabelRenderer.test.ts (11 tests)
✓ PrintPreviewDialog.test.tsx (13 tests)

Tests: 44 passed
```

---

## Summary

You now have three layers of validation:

1. **Automated Tests** - Run instantly, catch logical errors
2. **Browser PDF Export** - Validates rendering and layout
3. **Online Barcode Scanner** - Confirms barcode scannability
4. **DevTools Inspection** - Inspects HTML and CSS

This gives you 95%+ confidence without a physical printer. When you do have access to a printer, the final 5% validation (actual print quality) will likely pass without issues.

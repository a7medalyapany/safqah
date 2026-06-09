# Print System - Technical Documentation

## Overview

The print system generates professional invoices using semantic HTML tables with proper Arabic RTL support and Latin numerals (0-9) for universal readability. This document describes the architecture, files, and how to use the system.

## Architecture

### Key Files

- **src/shared/services/invoiceRenderer.ts** - Main invoice HTML generator
- **src/shared/utils/latinNumerals.ts** - Utility for converting numbers to Latin format
- **src-tauri/src/services/print_queue.rs** - Tauri print queue handler (Windows + Linux)
- **src/modules/pos/InvoiceSuccessDialog.tsx** - Post-sale dialog with print button

### Design Philosophy

1. **Semantic HTML**: Uses HTML tables for professional print layouts (not flexbox)
2. **Latin Numerals**: All numbers rendered as 0-9 for universal printer compatibility
3. **RTL Support**: Full Arabic right-to-left text direction
4. **Responsive Sizing**: Supports both A4 (210mm) and thermal printer (80mm) formats
5. **Print-First Design**: CSS optimized for print media, clean borders and typography

## How It Works

### User Flow

1. User completes a sale in POS
2. Clicks "Confirm Sell" 
3. Success dialog appears with:
   - "New Invoice" button
   - "Send to WhatsApp" button (shows PDF path)
   - "Print" button
4. Clicking "Print" triggers the Tauri backend
5. Backend generates PDF and sends to physical printer

### Invoice Generation Process

1. `InvoiceSuccessDialog` collects invoice data
2. Calls `generateInvoiceHtml()` with invoice data
3. Returns complete HTML with embedded CSS
4. Tauri backend receives HTML
5. Converts to PDF and sends to printer

## Code Structure

### InvoiceData Interface

```typescript
interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName?: string;
  cashierName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  currencySymbol: string;  // e.g., "ج.م"
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
  thankYouMessage?: string;
  showShopName?: boolean;
  showShopPhone?: boolean;
  showShopAddress?: boolean;
  showThankYou?: boolean;
}
```

### Invoice HTML Structure

The HTML uses semantic table structure:

```html
<!-- Header: Shop name and contact -->
<div class="invoice-header">
  <div class="shop-name">متجر الاختبار</div>
  <div class="shop-contact">...</div>
</div>

<!-- Metadata: Invoice number, date, customer, cashier -->
<table class="invoice-meta">
  <tr>
    <td class="label">رقم الفاتورة</td>
    <td class="value">INV-001</td>
    ...
  </tr>
</table>

<!-- Items: Product table -->
<table class="items-table">
  <thead>
    <tr>
      <th>الصنف</th>
      <th>الكمية</th>
      <th>السعر الفردي</th>
      <th>الإجمالي</th>
    </tr>
  </thead>
  <tbody>...</tbody>
</table>

<!-- Summary: Totals -->
<table class="summary-table">
  <tr>
    <td class="summary-label">الإجمالي الفرعي</td>
    <td class="summary-value">100.00 ج.م</td>
  </tr>
  ...
</table>

<!-- Footer: Thank you message -->
<div class="invoice-footer">...</div>
```

## Number Formatting

### Latin Numerals Utility

Located in `src/shared/utils/latinNumerals.ts`:

```typescript
// Convert Arabic-Indic to Latin numerals
arabicToLatin("١٢٣") // Returns: "123"

// Format currency values
formatCurrencyLatin(100000) // Returns: "100.00"
```

All numbers in invoice print are converted to Latin numerals (0-9) for:
- Better thermal printer compatibility
- Universal readability across different printer drivers
- Consistent formatting regardless of locale

## Print Formats

### A4 Format (210mm × 297mm)
- Font size: 12px base
- Padding: 15mm
- Header font: 14px bold
- Table font: 11px
- Professional business document appearance

### Thermal Printer (80mm × 297mm)
- Font size: 10px base
- Padding: 4-5mm
- Header font: 11px bold
- Table font: 9px
- Compact layout optimized for narrow paper

## Styling Details

### Colors
- Background: White (#FFFFFF)
- Text: Black (#000000)
- Table header: Light gray (#F0F0F0)
- Borders: 1px solid black for headers, light gray for rows

### Typography
- Font family: 'Segoe UI', 'Droid Arabic Noto', Arial
- Direction: RTL (right-to-left)
- Text alignment: Right-aligned for labels, left-aligned for values

### Borders and Spacing
- Section borders: 2px solid black (headers, totals)
- Row borders: 1px solid gray
- Professional separation between sections
- Print-friendly borders that translate well to thermal printers

## Tauri Integration

### Windows Backend

Located in `src-tauri/src/services/print_queue.rs`:

```rust
// Hides PowerShell console window during print
Command::new("powershell")
  .args(["-WindowStyle", "Hidden", ...])
  .creation_flags(CREATE_NO_WINDOW)
  .spawn()
```

- Uses PowerShell with `/WindowStyle Hidden` to prevent console flash
- Sets `CREATE_NO_WINDOW` flag for clean execution
- Sends HTML to raw printer queue

### Print Flow

1. HTML generated in frontend
2. Sent to Tauri backend
3. Backend creates temporary PDF file
4. Sends to printer via Windows/Linux native commands
5. Cleans up temporary files

## Testing

### Unit Tests
- `src/shared/services/__tests__/invoiceRenderer.test.ts` - 9 tests
- Validates HTML structure, RTL support, table generation
- All 38 tests passing

### Manual Testing
1. Create test sale in POS
2. Click Print
3. Verify output:
   - All text visible and readable
   - Numbers in Latin format (0-9)
   - Arabic text flows right-to-left
   - Tables properly aligned
   - Professional appearance

## Best Practices

### When Modifying Invoice Template

1. **Keep semantic HTML**: Use tables for layout, not divs with flexbox
2. **Use Latin numerals**: Always format numbers as 0-9
3. **Test RTL**: Verify Arabic text aligns correctly
4. **Print preview**: Use browser Print (Ctrl+P) to preview
5. **Both formats**: Test A4 and thermal printer formats

### Adding New Fields

1. Add to `InvoiceData` interface
2. Add to invoice metadata table or items table
3. Update CSS for new columns if needed
4. Format numbers using `formatCurrencyLatin()`
5. Escape HTML using `escapeHtml()` function

## Common Issues and Solutions

### Issue: Numbers appear as Arabic-Indic (٠-٩)
**Solution**: Ensure using `formatCurrencyLatin()` instead of `formatEGP()`

### Issue: Text misaligned in thermal printer
**Solution**: Reduce font size in thermal branch, use monospace for numbers

### Issue: Thermal printer output appears stretched
**Solution**: Check 80mm width assumption, may need 58mm adjustment

### Issue: WhatsApp shows PDF path instead of file
**Solution**: This is expected behavior - PDF stored locally, path shared via WhatsApp

## Future Enhancements

1. Add logo/shop image support
2. QR code generation for invoice tracking
3. Barcode label printing (separate from invoice)
4. Receipt printing variant (shorter format)
5. Email receipt generation

## File Locations

- Invoice Renderer: `src/shared/services/invoiceRenderer.ts`
- Latin Numerals: `src/shared/utils/latinNumerals.ts`
- Success Dialog: `src/modules/pos/InvoiceSuccessDialog.tsx`
- Tauri Print Queue: `src-tauri/src/services/print_queue.rs`
- Tests: `src/shared/services/__tests__/invoiceRenderer.test.ts`

## Dead Code Removed

The following files were removed as they were not used:

- ~~PrintPreviewDialog.tsx~~ (unused preview component)
- ~~printService.ts~~ (unused service wrapper)
- ~~receiptRenderer.ts~~ (unused receipt generator)
- ~~barcodeLabelRenderer.ts~~ (unused barcode labels)
- Test files for removed components

Current system focuses on core invoice printing only.

---

**Last Updated**: 2024
**Status**: Production Ready
**Test Coverage**: 38 tests passing

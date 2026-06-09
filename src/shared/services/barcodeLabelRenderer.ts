/**
 * Barcode Label Renderer Service
 * Generates HTML for barcode labels optimized for thermal printers
 * Standard label sizes: 4×6", 2.5×3.5", and A4 sheet labels
 */

export interface BarcodeLabelData {
  itemName: string;
  barcode: string;
  price: number;
  currencySymbol: string;
  shopName?: string;
  quantity: number;
  labelSize: "4x6" | "2.5x3.5" | "a4";
  showPrice: boolean;
  showShopName: boolean;
}

/**
 * Generate barcode label HTML
 */
export function generateBarcodeLabelHtml(label: BarcodeLabelData): string {
  const sizes = getSizeConfig(label.labelSize);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تسمية باركود</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: ${sizes.pageWidth} ${sizes.pageHeight};
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
    }

    .labels-container {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      gap: ${sizes.gapMm}mm;
      padding: ${sizes.paddingMm}mm;
      align-content: flex-start;
    }

    .label {
      width: ${sizes.labelWidthMm}mm;
      height: ${sizes.labelHeightMm}mm;
      border: 1px solid #999;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: ${sizes.labelPaddingMm}mm;
      text-align: center;
      font-family: 'Droid Arabic Noto', 'Arial Unicode MS', Arial, sans-serif;
      font-size: ${sizes.fontSizePx}px;
      direction: rtl;
      gap: ${sizes.labelGapMm}mm;
    }

    .item-name {
      font-weight: bold;
      width: 100%;
      word-wrap: break-word;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.2;
    }

    .barcode-container {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    svg {
      max-width: 100%;
      height: auto;
    }

    .price {
      font-weight: bold;
      font-size: ${sizes.priceFontSizePx}px;
    }

    .shop-name {
      font-size: ${sizes.shopNameFontSizePx}px;
      color: #666;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
      .labels-container {
        gap: 0;
        padding: 0;
      }
      .label {
        border: 1px dotted #999;
      }
    }
  </style>
</head>
<body>
  <div class="labels-container">
    ${Array.from(
      { length: label.quantity },
      (_, i) => `
    <div class="label" id="label-${i}">
      <div class="item-name">${escapeHtml(label.itemName)}</div>
      <div class="barcode-container">
        <svg id="barcode-${i}"></svg>
      </div>
      ${label.showPrice ? `<div class="price">${formatPrice(label.price, label.currencySymbol)}</div>` : ""}
      ${label.showShopName && label.shopName ? `<div class="shop-name">${escapeHtml(label.shopName)}</div>` : ""}
    </div>
    `
    ).join("")}
  </div>

  <script>
    // Generate barcodes for all labels
    ${Array.from({ length: label.quantity }, (_, i) => {
      return `JsBarcode("#barcode-${i}", "${label.barcode}", {
      format: "CODE128",
      width: 1,
      height: ${sizes.barcodeHeightPx},
      displayValue: true,
      fontSize: ${sizes.barcodeFontSizePx},
      margin: 2
    });`;
    }).join("\n    ")}
  </script>
</body>
</html>`;
}

/**
 * Get size configuration for different label sizes
 */
function getSizeConfig(
  labelSize: "4x6" | "2.5x3.5" | "a4"
): {
  pageWidth: string;
  pageHeight: string;
  labelWidthMm: number;
  labelHeightMm: number;
  labelPaddingMm: number;
  labelGapMm: number;
  paddingMm: number;
  gapMm: number;
  fontSizePx: number;
  priceFontSizePx: number;
  shopNameFontSizePx: number;
  barcodeHeightPx: number;
  barcodeFontSizePx: number;
} {
  // Convert inches to mm: 1 inch = 25.4 mm
  if (labelSize === "4x6") {
    return {
      pageWidth: "152.4mm", // 6 inches
      pageHeight: "101.6mm", // 4 inches
      labelWidthMm: 101.6, // 4 inches
      labelHeightMm: 152.4, // 6 inches (landscape)
      labelPaddingMm: 2,
      labelGapMm: 1.5,
      paddingMm: 2,
      gapMm: 2,
      fontSizePx: 11,
      priceFontSizePx: 13,
      shopNameFontSizePx: 8,
      barcodeHeightPx: 40,
      barcodeFontSizePx: 9,
    };
  }

  if (labelSize === "2.5x3.5") {
    return {
      pageWidth: "88.9mm", // 3.5 inches
      pageHeight: "63.5mm", // 2.5 inches
      labelWidthMm: 63.5, // 2.5 inches
      labelHeightMm: 88.9, // 3.5 inches (landscape)
      labelPaddingMm: 1.5,
      labelGapMm: 1,
      paddingMm: 1,
      gapMm: 1,
      fontSizePx: 8,
      priceFontSizePx: 10,
      shopNameFontSizePx: 6,
      barcodeHeightPx: 25,
      barcodeFontSizePx: 7,
    };
  }

  // A4 sheet labels (for inkjet printers)
  return {
    pageWidth: "210mm",
    pageHeight: "297mm",
    labelWidthMm: 63,
    labelHeightMm: 29.7, // 3 rows per page
    labelPaddingMm: 2,
    labelGapMm: 1,
    paddingMm: 4,
    gapMm: 2,
    fontSizePx: 10,
    priceFontSizePx: 12,
    shopNameFontSizePx: 7,
    barcodeHeightPx: 35,
    barcodeFontSizePx: 8,
  };
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format price with currency symbol
 */
function formatPrice(amount: number, currencySymbol: string): string {
  const piasters = amount % 100;
  const pounds = Math.floor(amount / 100);

  if (piasters === 0) {
    return `${pounds}${currencySymbol}`;
  }

  return `${pounds}.${piasters.toString().padStart(2, "0")}${currencySymbol}`;
}

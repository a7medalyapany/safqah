/**
 * Receipt Renderer Service
 * Generates HTML for receipt printing with thermal printer support
 */

export interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  invoiceNumber: string;
  date: string;
  customerName?: string;
  cashierName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  currencySymbol: string;
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
  thankYouMessage?: string;
  receiptSize: "thermal80" | "thermal58" | "a4";
}

/**
 * Generate receipt HTML optimized for thermal printers (80mm × 297mm standard)
 */
export function generateReceiptHtml(receipt: ReceiptData): string {
  const isA4 = receipt.receiptSize === "a4";
  const pageWidth = isA4 ? "210mm" : "80mm";
  const fontSize = isA4 ? "12px" : "10px";
  const padding = isA4 ? "10mm" : "5mm";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إيصال - ${receipt.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: ${pageWidth} auto;
      margin: 0;
    }

    html, body {
      width: ${pageWidth};
      font-family: 'Droid Arabic Noto', 'Arial Unicode MS', Arial, sans-serif;
      font-size: ${fontSize};
      line-height: 1.3;
      direction: rtl;
      text-align: right;
    }

    .receipt {
      width: 100%;
      padding: ${padding};
      display: flex;
      flex-direction: column;
      gap: 3mm;
    }

    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 3mm;
      margin-bottom: 3mm;
    }

    .shop-name {
      font-size: ${isA4 ? "14px" : "11px"};
      font-weight: bold;
      margin-bottom: 1mm;
    }

    .shop-info {
      font-size: ${isA4 ? "10px" : "9px"};
      color: #333;
      line-height: 1.2;
    }

    .receipt-meta {
      font-size: ${isA4 ? "10px" : "9px"};
      padding: 2mm 0;
      border-bottom: 1px dashed #000;
    }

    .meta-line {
      display: flex;
      justify-content: space-between;
      gap: 5mm;
      margin-bottom: 1mm;
    }

    .meta-line:last-child {
      margin-bottom: 0;
    }

    .meta-label {
      font-weight: bold;
    }

    .items {
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      padding: 2mm 0;
      margin: 2mm 0;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      font-size: ${isA4 ? "9px" : "8px"};
      font-weight: bold;
      padding: 1mm 0;
      border-bottom: 1px solid #ddd;
      margin-bottom: 1mm;
    }

    .item-col-name {
      flex: 1;
    }

    .item-col-qty {
      width: 12%;
      text-align: center;
    }

    .item-col-total {
      width: 25%;
      text-align: left;
    }

    .item {
      display: flex;
      justify-content: space-between;
      font-size: ${isA4 ? "10px" : "9px"};
      padding: 1mm 0;
      gap: 5mm;
    }

    .item-price {
      font-size: ${isA4 ? "9px" : "8px"};
      color: #666;
    }

    .summary {
      margin-top: 2mm;
      font-size: ${isA4 ? "10px" : "9px"};
    }

    .summary-line {
      display: flex;
      justify-content: space-between;
      gap: 5mm;
      padding: 1mm 0;
    }

    .summary-line.total {
      font-weight: bold;
      border-top: 1px solid #000;
      padding: 1mm 0;
      margin: 1mm 0;
    }

    .summary-label {
      flex: 1;
    }

    .summary-value {
      width: 30%;
      text-align: left;
    }

    .footer {
      text-align: center;
      padding-top: 2mm;
      border-top: 1px dashed #000;
      font-size: ${isA4 ? "10px" : "9px"};
      margin-top: 2mm;
    }

    .thank-you {
      margin-bottom: 1mm;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .receipt {
        padding: ${padding};
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div class="header">
      ${receipt.shopName ? `<div class="shop-name">${escapeHtml(receipt.shopName)}</div>` : ""}
      <div class="shop-info">
        ${receipt.shopPhone ? `<div>${escapeHtml(receipt.shopPhone)}</div>` : ""}
        ${receipt.shopAddress ? `<div>${escapeHtml(receipt.shopAddress)}</div>` : ""}
      </div>
    </div>

    <!-- Receipt Metadata -->
    <div class="receipt-meta">
      <div class="meta-line">
        <span><span class="meta-label">رقم الإيصال:</span> ${escapeHtml(receipt.invoiceNumber)}</span>
        <span>${escapeHtml(receipt.date)}</span>
      </div>
      ${receipt.customerName ? `<div class="meta-line"><span><span class="meta-label">العميل:</span> ${escapeHtml(receipt.customerName)}</span></div>` : ""}
      ${receipt.cashierName ? `<div class="meta-line"><span><span class="meta-label">الكاشير:</span> ${escapeHtml(receipt.cashierName)}</span></div>` : ""}
    </div>

    <!-- Items -->
    <div class="items">
      <div class="item-header">
        <span class="item-col-name">الصنف</span>
        <span class="item-col-qty">الكمية</span>
        <span class="item-col-total">المبلغ</span>
      </div>
      ${receipt.items
        .map(
          (item) => `
        <div class="item">
          <div class="item-col-name">
            <div>${escapeHtml(item.name)}</div>
            <div class="item-price">${formatPrice(item.unitPrice, receipt.currencySymbol)} × ${item.qty}</div>
          </div>
          <div class="item-col-total">${formatPrice(item.total, receipt.currencySymbol)}</div>
        </div>
      `
        )
        .join("")}
    </div>

    <!-- Summary -->
    <div class="summary">
      <div class="summary-line">
        <span class="summary-label">الإجمالي الفرعي</span>
        <span class="summary-value">${formatPrice(receipt.subtotal, receipt.currencySymbol)}</span>
      </div>
      ${
        receipt.discount > 0
          ? `<div class="summary-line">
        <span class="summary-label">الخصم</span>
        <span class="summary-value">-${formatPrice(receipt.discount, receipt.currencySymbol)}</span>
      </div>`
          : ""
      }
      <div class="summary-line total">
        <span class="summary-label">الإجمالي</span>
        <span class="summary-value">${formatPrice(receipt.total, receipt.currencySymbol)}</span>
      </div>
      ${
        receipt.paidAmount > 0 && receipt.paidAmount < receipt.total
          ? `<div class="summary-line">
        <span class="summary-label">المتبقي</span>
        <span class="summary-value">${formatPrice(receipt.total - receipt.paidAmount, receipt.currencySymbol)}</span>
      </div>`
          : ""
      }
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="thank-you">${escapeHtml(receipt.thankYouMessage || "شكراً لك")}</div>
      <div>نتطلع لخدمتك مجدداً</div>
    </div>
  </div>
</body>
</html>`;
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

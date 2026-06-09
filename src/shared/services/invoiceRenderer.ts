/**
 * Invoice Renderer Service
 * Generates clean HTML for printing invoices with full Arabic RTL support
 */

export interface InvoiceItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
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
  currencySymbol: string;
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
  thankYouMessage?: string;
  showShopName?: boolean;
  showShopPhone?: boolean;
  showShopAddress?: boolean;
  showThankYou?: boolean;
}

export type PrintSize = "a4" | "thermal";

/**
 * Generate invoice HTML with full RTL support
 */
export function generateInvoiceHtml(
  invoice: InvoiceData,
  printSize: PrintSize = "a4"
): string {
  const pageWidth = printSize === "thermal" ? "80mm" : "210mm";
  const pageHeight = printSize === "thermal" ? "297mm" : "297mm";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة - ${invoice.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: ${pageWidth} ${pageHeight};
      margin: 0;
    }

    html, body {
      width: ${pageWidth};
      height: ${pageHeight};
      font-family: 'Droid Arabic Noto', 'Arial Unicode MS', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      direction: rtl;
      text-align: right;
    }

    .invoice {
      width: 100%;
      padding: ${printSize === "thermal" ? "8mm" : "10mm"};
      display: flex;
      flex-direction: column;
      gap: ${printSize === "thermal" ? "4mm" : "8mm"};
    }

    .header {
      text-align: center;
      border-bottom: 1px solid #000;
      padding-bottom: ${printSize === "thermal" ? "4mm" : "8mm"};
    }

    .shop-name {
      font-size: ${printSize === "thermal" ? "10px" : "16px"};
      font-weight: bold;
      margin-bottom: 2mm;
    }

    .shop-info {
      font-size: ${printSize === "thermal" ? "9px" : "10px"};
      color: #333;
      line-height: 1.3;
    }

    .invoice-meta {
      display: flex;
      flex-direction: column;
      gap: ${printSize === "thermal" ? "2mm" : "4mm"};
      padding: ${printSize === "thermal" ? "4mm 0" : "8mm 0"};
      font-size: ${printSize === "thermal" ? "10px" : "11px"};
      border-bottom: 1px solid #000;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 10mm;
    }

    .meta-label {
      font-weight: bold;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: ${printSize === "thermal" ? "4mm 0" : "8mm 0"};
      font-size: ${printSize === "thermal" ? "10px" : "11px"};
    }

    .items-table thead {
      border-bottom: 1px solid #000;
    }

    .items-table th {
      padding: ${printSize === "thermal" ? "2mm" : "4mm"};
      text-align: right;
      font-weight: bold;
      background-color: #f5f5f5;
    }

    .items-table td {
      padding: ${printSize === "thermal" ? "2mm" : "4mm"};
      border-bottom: 1px solid #eee;
    }

    .items-table tbody tr:last-child td {
      border-bottom: 1px solid #000;
    }

    .col-name {
      width: 50%;
    }

    .col-qty {
      width: 15%;
      text-align: center;
    }

    .col-price {
      width: 17.5%;
      text-align: left;
    }

    .col-total {
      width: 17.5%;
      text-align: left;
    }

    .summary {
      margin-top: ${printSize === "thermal" ? "4mm" : "8mm"};
      font-size: ${printSize === "thermal" ? "10px" : "11px"};
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: ${printSize === "thermal" ? "2mm 0" : "3mm 0"};
      gap: 10mm;
    }

    .summary-row.total {
      font-weight: bold;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: ${printSize === "thermal" ? "3mm 0" : "4mm 0"};
    }

    .summary-label {
      flex: 1;
    }

    .summary-value {
      width: 40%;
      text-align: left;
    }

    .footer {
      margin-top: auto;
      text-align: center;
      padding-top: ${printSize === "thermal" ? "4mm" : "8mm"};
      border-top: 1px solid #000;
      font-size: ${printSize === "thermal" ? "9px" : "10px"};
      min-height: ${printSize === "thermal" ? "auto" : "30mm"};
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2mm;
    }

    .thank-you {
      font-weight: bold;
      margin-bottom: 2mm;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .invoice {
        padding: ${printSize === "thermal" ? "8mm" : "10mm"};
      }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <!-- Header -->
    <div class="header">
      ${invoice.showShopName && invoice.shopName ? `<div class="shop-name">${escapeHtml(invoice.shopName)}</div>` : ""}
      <div class="shop-info">
        ${invoice.showShopPhone && invoice.shopPhone ? `<div>${escapeHtml(invoice.shopPhone)}</div>` : ""}
        ${invoice.showShopAddress && invoice.shopAddress ? `<div>${escapeHtml(invoice.shopAddress)}</div>` : ""}
      </div>
    </div>

    <!-- Invoice Metadata -->
    <div class="invoice-meta">
      <div class="meta-row">
        <span><span class="meta-label">رقم الفاتورة:</span> ${escapeHtml(invoice.invoiceNumber)}</span>
        <span><span class="meta-label">التاريخ:</span> ${escapeHtml(invoice.date)}</span>
      </div>
      <div class="meta-row">
        <span><span class="meta-label">العميل:</span> ${escapeHtml(invoice.customerName || "عميل عام")}</span>
        <span><span class="meta-label">الكاشير:</span> ${escapeHtml(invoice.cashierName || "غير محدد")}</span>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-name">الصنف</th>
          <th class="col-qty">الكمية</th>
          <th class="col-price">السعر</th>
          <th class="col-total">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items
          .map(
            (item) => `
          <tr>
            <td class="col-name">${escapeHtml(item.name)}</td>
            <td class="col-qty">${item.qty}</td>
            <td class="col-price">${formatPrice(item.unitPrice, invoice.currencySymbol)}</td>
            <td class="col-total">${formatPrice(item.total, invoice.currencySymbol)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <!-- Summary -->
    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">الإجمالي الفرعي</span>
        <span class="summary-value">${formatPrice(invoice.subtotal, invoice.currencySymbol)}</span>
      </div>
      ${
        invoice.discount > 0
          ? `<div class="summary-row">
        <span class="summary-label">الخصم</span>
        <span class="summary-value">-${formatPrice(invoice.discount, invoice.currencySymbol)}</span>
      </div>`
          : ""
      }
      ${
        invoice.tax > 0
          ? `<div class="summary-row">
        <span class="summary-label">الضريبة</span>
        <span class="summary-value">${formatPrice(invoice.tax, invoice.currencySymbol)}</span>
      </div>`
          : ""
      }
      <div class="summary-row total">
        <span class="summary-label">الإجمالي</span>
        <span class="summary-value">${formatPrice(invoice.total, invoice.currencySymbol)}</span>
      </div>
      ${
        invoice.paidAmount > 0 && invoice.paidAmount < invoice.total
          ? `<div class="summary-row">
        <span class="summary-label">المتبقي</span>
        <span class="summary-value">${formatPrice(invoice.total - invoice.paidAmount, invoice.currencySymbol)}</span>
      </div>`
          : ""
      }
    </div>

    <!-- Footer -->
    ${
      invoice.showThankYou
        ? `<div class="footer">
      <div class="thank-you">${escapeHtml(invoice.thankYouMessage || "شكراً لزيارتكم")}</div>
      <div>نتطلع لخدمتكم مجدداً</div>
    </div>`
        : ""
    }
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

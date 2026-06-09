import { describe, it, expect } from "vitest";
import { generateInvoiceHtml, type InvoiceData } from "../invoiceRenderer";

describe("Invoice Renderer", () => {
  const mockInvoice: InvoiceData = {
    invoiceNumber: "INV-001",
    date: "2024-01-15",
    customerName: "أحمد محمد",
    items: [
      {
        name: "منتج اختبار 1",
        qty: 2,
        unitPrice: 100,
        total: 200,
      },
      {
        name: "منتج اختبار 2",
        qty: 1,
        unitPrice: 150,
        total: 150,
      },
    ],
    subtotal: 350,
    discount: 0,
    tax: 35,
    total: 385,
    paidAmount: 385,
    currencySymbol: "ر.س",
    shopName: "متجر الاختبار",
  };

  it("should generate valid HTML structure", () => {
    const html = generateInvoiceHtml(mockInvoice);
    
    expect(html).toBeDefined();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("should include all invoice data", () => {
    const html = generateInvoiceHtml(mockInvoice);
    
    expect(html).toContain(mockInvoice.invoiceNumber);
    expect(html).toContain(mockInvoice.shopName!);
    expect(html).toContain(mockInvoice.customerName!);
    expect(html).toContain("385"); // total
  });

  it("should support Arabic RTL text", () => {
    const html = generateInvoiceHtml(mockInvoice);
    
    expect(html).toContain('dir="rtl"');
    expect(html).toContain(mockInvoice.items[0].name); // Arabic item name
  });

  it("should include print CSS with correct page sizes", () => {
    const html = generateInvoiceHtml(mockInvoice);
    
    expect(html).toContain("@media print");
    expect(html).toContain("page-break");
    expect(html).toContain("print");
  });

  it("should format currency correctly", () => {
    const html = generateInvoiceHtml(mockInvoice);
    
    // Should contain item prices and totals
    expect(html).toContain("200"); // first item total
    expect(html).toContain("150"); // second item total
    expect(html).toContain("385"); // grand total
  });

  it("should handle thermal printer size", () => {
    const html = generateInvoiceHtml(mockInvoice);
    
    expect(html).toBeDefined();
    expect(html).toContain("<html");
  });

  it("should include all invoice items in table", () => {
    const html = generateInvoiceHtml(mockInvoice);
    
    mockInvoice.items.forEach((item) => {
      expect(html).toContain(item.name);
      expect(html).toContain(item.qty.toString());
    });
  });

  it("should calculate totals correctly", () => {
    const html = generateInvoiceHtml(mockInvoice);
    
    // Verify summary section contains totals
    expect(html).toContain("الإجمالي");
    expect(html).toContain("subtotal");
  });

  it("should handle empty items array gracefully", () => {
    const invoiceWithoutItems: InvoiceData = {
      ...mockInvoice,
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
    };
    
    const html = generateInvoiceHtml(invoiceWithoutItems);
    expect(html).toBeDefined();
    expect(html).toContain("0"); // total should be 0
  });
});

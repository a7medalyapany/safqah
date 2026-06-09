import { describe, it, expect } from "vitest";
import { generateReceiptHtml, type ReceiptData } from "../receiptRenderer";

describe("Receipt Renderer", () => {
  const mockReceipt: ReceiptData = {
    receiptNumber: "RCP-001",
    date: "2024-01-15",
    time: "14:30",
    items: [
      {
        name: "قطعة كيك الشوكولاتة",
        qty: 1,
        price: 50,
        total: 50,
      },
      {
        name: "قهوة عربية",
        qty: 2,
        price: 25,
        total: 50,
      },
    ],
    subtotal: 100,
    tax: 10,
    total: 110,
    paymentMethod: "نقد",
    shopName: "مقهى البيت",
  };

  it("should generate valid HTML structure", () => {
    const html = generateReceiptHtml(mockReceipt);
    
    expect(html).toBeDefined();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("should include receipt header with shop name", () => {
    const html = generateReceiptHtml(mockReceipt);
    
    expect(html).toContain(mockReceipt.shopName);
    expect(html).toContain(mockReceipt.date);
  });

  it("should support Arabic RTL text", () => {
    const html = generateReceiptHtml(mockReceipt);
    
    expect(html).toContain('dir="rtl"');
    expect(html).toContain(mockReceipt.items[0].name);
  });

  it("should include print CSS styles", () => {
    const html = generateReceiptHtml(mockReceipt);
    
    expect(html).toContain("@media print");
    expect(html).toContain("<style>");
  });

  it("should include all receipt items", () => {
    const html = generateReceiptHtml(mockReceipt);
    
    mockReceipt.items.forEach((item) => {
      expect(html).toContain(item.name);
      expect(html).toContain(item.qty.toString());
    });
  });

  it("should calculate and display totals", () => {
    const html = generateReceiptHtml(mockReceipt);
    
    // Verify structure contains summary section
    expect(html).toContain("summary");
    expect(html).toContain("الإجمالي");
  });
});

import { describe, it, expect } from "vitest";
import { generateBarcodeLabelHtml, type BarcodeLabelData } from "../barcodeLabelRenderer";

describe("Barcode Label Renderer", () => {
  const mockLabel: BarcodeLabelData = {
    sku: "SKU-001",
    itemName: "تي شيرت أحمر",
    barcode: "8693702356124",
    price: 199.99,
    quantity: 50,
    shopName: "متجر الملابس",
  };

  it("should generate valid HTML structure", () => {
    const html = generateBarcodeLabelHtml(mockLabel);
    
    expect(html).toBeDefined();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
  });

  it("should include barcode data", () => {
    const html = generateBarcodeLabelHtml(mockLabel);
    
    expect(html).toContain(mockLabel.barcode);
    expect(html).toContain(mockLabel.sku);
  });

  it("should include item information in Arabic", () => {
    const html = generateBarcodeLabelHtml(mockLabel);
    
    expect(html).toContain(mockLabel.itemName);
    expect(html).toContain("199.99");
  });

  it("should support Arabic RTL text", () => {
    const html = generateBarcodeLabelHtml(mockLabel);
    
    expect(html).toContain('dir="rtl"');
  });

  it("should include print CSS for thermal labels", () => {
    const html = generateBarcodeLabelHtml(mockLabel);
    
    expect(html).toContain("@media print");
    expect(html).toContain("<style>");
  });

  it("should include shop name on label", () => {
    const html = generateBarcodeLabelHtml(mockLabel);
    
    expect(html).toContain(mockLabel.shopName);
  });
});

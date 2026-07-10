import { describe, expect, it } from "vitest";

import { toItemFormValues, toItemPayload } from "@/modules/items/utils";
import type { Item, ItemFormValues } from "@/modules/items/types";

const baseItem: Item = {
  id: 1,
  barcode: "622300000001",
  name_ar: "كابل نحاس",
  name_en: null,
  category_id: 3,
  supplier_id: null,
  buy_price_millieme: 12_500,
  sell_price_millieme: 15_000,
  color: null,
  size: null,
  unit: "متر",
  min_stock: 5,
  current_stock: 40,
  image_path: null,
  is_active: 1,
  created_at: "2026-01-01 00:00:00",
  updated_at: "2026-01-01 00:00:00",
};

describe("toItemFormValues", () => {
  it("renders milliemes as trimmed decimal strings", () => {
    const values = toItemFormValues(baseItem);

    expect(values.buy_price).toBe("12.5");
    expect(values.sell_price).toBe("15");
    expect(values.current_stock).toBe("40");
    expect(values.category_id).toBe("3");
  });

  it("returns sensible defaults for a new item", () => {
    const values = toItemFormValues(null);

    expect(values.name_ar).toBe("");
    expect(values.buy_price).toBe("");
    expect(values.current_stock).toBe("0");
    expect(values.unit).toBe("قطعة");
  });
});

describe("toItemPayload", () => {
  const formValues: ItemFormValues = {
    name_ar: " كابل نحاس ",
    barcode: " 622300000001 ",
    category_id: "3",
    buy_price: "12.5",
    sell_price: "15",
    current_stock: "40",
    min_stock: "5",
    color: "  ",
    size: "",
    unit: " متر ",
  };

  it("trims strings and converts prices back to milliemes", () => {
    const payload = toItemPayload(formValues);

    expect(payload.name_ar).toBe("كابل نحاس");
    expect(payload.barcode).toBe("622300000001");
    expect(payload.buy_price_millieme).toBe(12_500);
    expect(payload.sell_price_millieme).toBe(15_000);
    expect(payload.category_id).toBe(3);
    expect(payload.unit).toBe("متر");
  });

  it("nulls empty optional fields and defaults blank numbers to zero", () => {
    const payload = toItemPayload({
      ...formValues,
      barcode: "  ",
      category_id: "",
      color: "",
      current_stock: "",
      min_stock: " ",
    });

    expect(payload.barcode).toBeNull();
    expect(payload.category_id).toBeNull();
    expect(payload.color).toBeNull();
    expect(payload.current_stock).toBe(0);
    expect(payload.min_stock).toBe(0);
  });

  it("round-trips an item through form values without losing money precision", () => {
    const payload = toItemPayload(toItemFormValues(baseItem));

    expect(payload.buy_price_millieme).toBe(baseItem.buy_price_millieme);
    expect(payload.sell_price_millieme).toBe(baseItem.sell_price_millieme);
  });
});

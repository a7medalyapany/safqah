import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { invoke } from "@/shared/utils/invoke";
import { listPrinters } from "@/modules/settings/api";

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [shopNameTouched, setShopNameTouched] = useState(false);

  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [receiptSize, setReceiptSize] = useState<"80mm" | "58mm">("80mm");

  const [seedChoice, setSeedChoice] = useState<"yes" | "no">("no");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void listPrinters()
      .then((list) => setPrinters(list ?? []))
      .catch(() => setPrinters([]));
  }, []);

  const shopNameValid = useMemo(() => shopName.trim().length > 0, [shopName]);

  const nextFromStep1 = async () => {
    setShopNameTouched(true);
    if (!shopNameValid) return;

    await invoke<boolean>("update_settings", {
      updates: {
        shop_name: shopName.trim(),
        shop_phone: phone.trim(),
        shop_address: address.trim(),
      },
    });

    setStep(2);
  };

  const nextFromStep2 = async () => {
    await invoke<boolean>("update_settings", {
      updates: {
        default_printer: selectedPrinter,
        receipt_size: receiptSize,
      },
    });

    setStep(3);
  };

  const finish = async () => {
    setLoading(true);

    try {
      if (seedChoice === "yes") {
        await invoke<boolean>("seed_sample_data");
      }

      await invoke<boolean>("complete_setup");

      toast.success("تم الإعداد بنجاح — مرحباً بك في صفقة! 🎉");
      onComplete();
    } catch (error) {
      // invoke wrapper already toasts
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="flex items-center justify-center h-screen bg-background p-4"
    >
      <Card className="max-w-xl rounded-2xl shadow-lg bg-white p-8 w-full">
        <div className="flex flex-col gap-6">
          {/* Progress dots */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 w-full">
                <div className="flex items-center w-full gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${step >= 1 ? "bg-primary" : "border border-gray-300"}`}
                  />
                  <div
                    className={`flex-1 h-0.5 ${step > 1 ? "bg-green-400" : "bg-gray-200"}`}
                  />
                  <div
                    className={`w-3 h-3 rounded-full ${step >= 2 ? "bg-primary" : "border border-gray-300"}`}
                  />
                  <div
                    className={`flex-1 h-0.5 ${step > 2 ? "bg-green-400" : "bg-gray-200"}`}
                  />
                  <div
                    className={`w-3 h-3 rounded-full ${step >= 3 ? "bg-primary" : "border border-gray-300"}`}
                  />
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground text-right mt-2">
              الخطوة {step} من 3
            </div>
          </div>

          {step === 1 && (
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl">🏪</div>
              <h1 className="text-2xl font-bold text-center">
                مرحباً بك في صفقة
              </h1>
              <p className="text-center text-muted-foreground">
                نظام نقطة البيع لمحلات الأدوات الكهربائية
              </p>

              <div className="w-full border-t border-border my-4" />

              <div className="w-full">
                <label className="block text-sm font-medium mb-1 text-right">
                  اسم المحل <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="مثال: محل الكهرباء المتحدة"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  onBlur={() => setShopNameTouched(true)}
                />
                {shopNameTouched && !shopNameValid && (
                  <div className="text-sm text-destructive mt-1">
                    اسم المحل مطلوب
                  </div>
                )}
              </div>

              <div className="w-full">
                <label className="block text-sm font-medium mb-1 text-right">
                  رقم الهاتف
                </label>
                <Input
                  placeholder="01xxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="w-full">
                <label className="block text-sm font-medium mb-1 text-right">
                  العنوان
                </label>
                <Input
                  placeholder="مثال: 15 شارع النصر، المنصورة"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="w-full flex justify-between">
                <div />
                <Button onClick={nextFromStep1} disabled={!shopNameValid}>
                  التالي ←
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl">🖨️</div>
              <h2 className="text-xl font-semibold">إعداد الطابعة</h2>
              <p className="text-muted-foreground">
                يمكن تعديل هذا لاحقاً من الإعدادات
              </p>

              <div className="w-full mt-2">
                <label className="block text-sm font-medium mb-1 text-right">
                  الطابعة الافتراضية
                </label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                >
                  <option value="">-- بدون طابعة الآن --</option>
                  {printers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full flex gap-4 mt-2">
                <div
                  onClick={() => setReceiptSize("80mm")}
                  className={`p-4 rounded-lg w-1/2 border ${receiptSize === "80mm" ? "border-primary" : "border-gray-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">عرض 80 مم</div>
                      <div className="text-sm text-muted-foreground">
                        الحجم القياسي الأكثر شيوعاً
                      </div>
                    </div>
                    {receiptSize === "80mm" && (
                      <div className="text-green-500">✓</div>
                    )}
                  </div>
                </div>

                <div
                  onClick={() => setReceiptSize("58mm")}
                  className={`p-4 rounded-lg w-1/2 border ${receiptSize === "58mm" ? "border-primary" : "border-gray-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">عرض 58 مم</div>
                      <div className="text-sm text-muted-foreground">
                        للطابعات الصغيرة
                      </div>
                    </div>
                    {receiptSize === "58mm" && (
                      <div className="text-green-500">✓</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  ← السابق
                </Button>
                <Button onClick={nextFromStep2}>التالي ←</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl">📦</div>
              <h2 className="text-xl font-semibold">
                هل تريد إضافة بيانات تجريبية؟
              </h2>
              <p className="text-muted-foreground text-center">
                تساعدك على تجربة البرنامج فوراً قبل إدخال بياناتك الحقيقية
              </p>

              <div className="w-full flex flex-col gap-3 mt-2">
                <div
                  onClick={() => setSeedChoice("yes")}
                  className={`p-4 rounded-lg border ${seedChoice === "yes" ? "border-emerald-500" : "border-gray-200"}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">
                        نعم، أضف بيانات تجريبية
                      </div>
                      <div className="text-sm text-muted-foreground">
                        سيتم إضافة: 7 تصنيفات كهربائية + 10 أصناف شائعة (كابلات،
                        قواطع، إضاءة LED، برايز، أدوات) + عميل تجريبي + مورد
                        تجريبي
                      </div>
                    </div>
                    {seedChoice === "yes" ? (
                      <div className="text-emerald-600">✓</div>
                    ) : null}
                  </div>
                </div>

                <div
                  onClick={() => setSeedChoice("no")}
                  className={`p-4 rounded-lg border ${seedChoice === "no" ? "border-primary" : "border-gray-200"}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">لا، سأبدأ من الصفر</div>
                      <div className="text-sm text-muted-foreground">
                        أضف أصنافك ومورديك وعملاءك بنفسك
                      </div>
                    </div>
                    {seedChoice === "no" ? (
                      <div className="text-primary">📁</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="w-full flex justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setStep(2)}
                  disabled={loading}
                >
                  ← السابق
                </Button>
                <Button onClick={finish} disabled={loading}>
                  {loading ? "جارٍ..." : "إنهاء الإعداد ✓"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type AppErrorShape = {
  code: string;
  message_ar: string;
  message_en: string;
};

function App() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    invoke<{ ok: boolean; message: string }>("ping")
      .then((result) => {
        console.log("ping()", result);
      })
      .catch((error) => {
        console.error("ping() failed", error);
      });

    invoke("force_error")
      .then((result) => {
        console.log("force_error() unexpectedly succeeded", result);
      })
      .catch((error) => {
        const appError =
          typeof error === "string"
            ? (() => {
                try {
                  return JSON.parse(error) as AppErrorShape;
                } catch {
                  return {
                    code: "UNKNOWN",
                    message_ar: error,
                    message_en: error,
                  } satisfies AppErrorShape;
                }
              })()
            : (error as AppErrorShape);

        console.log("force_error() AppError", appError);
        console.log({
          code: appError.code,
          message_ar: appError.message_ar,
          message_en: appError.message_en,
        });
      });
  }, []);

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-background px-4 py-8 text-right text-foreground sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center justify-center">
        <Card className="w-full shadow-sm">
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-2xl">إدارة الأصناف</CardTitle>
              <Badge variant="secondary">RTL</Badge>
            </div>
            <CardDescription className="text-base">
              اختبار بصري سريع للتأكد من أن Tailwind v4 و shadcn/ui يعملان
              بشكل صحيح داخل واجهة عربية باتجاه من اليمين إلى اليسار.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Input
              dir="rtl"
              placeholder="ابحث بالاسم أو الباركود..."
              className="text-right"
            />

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge variant="outline">جاهز للاختبار</Badge>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button type="button">إضافة صنف جديد</Button>
                </DialogTrigger>

                <DialogContent dir="rtl" className="text-right sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>تفاصيل الصنف</DialogTitle>
                    <DialogDescription>
                      هذا مربع حوار عربي للتأكد من أن التباعد والمحاذاة
                      واتجاه العرض يعملون بشكل صحيح داخل المكونات الجاهزة.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-7">
                    عند فتح هذه النافذة يجب أن يبقى النص بمحاذاة يمينية وأن
                    يظهر المحتوى باتجاه RTL بدون أي أخطاء في وحدة التحكم.
                  </div>

                  <DialogFooter className="justify-start sm:justify-start">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        إغلاق
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default App;

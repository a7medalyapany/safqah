import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseAppError } from "@/modules/items/utils";
import { useAuthStore } from "@/store/authSlice";

export function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!username.trim() || !password.trim()) {
      setErrorMessage("اسم المستخدم وكلمة المرور مطلوبة");
      return;
    }

    try {
      setIsSubmitting(true);
      await login(username, password);
    } catch (error) {
      const appError = parseAppError(error);
      setErrorMessage(
        appError.code === "INVALID_CREDENTIALS"
          ? "اسم المستخدم أو كلمة المرور غير صحيحة"
          : appError.message_ar,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(2,132,199,0.12),transparent_30%),linear-gradient(180deg,#f8fafc,#eef2ff)] px-4 py-10">
      <div className="absolute inset-0 -z-10 opacity-70 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-size-[32px_32px]" />

      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card/95 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.32em] text-muted-foreground">
            نظام نقطة البيع
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            تسجيل الدخول
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            أدخل بياناتك للوصول إلى النظام.
          </p>
        </div>

        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <label className="space-y-2 text-right">
            <span className="block text-sm font-medium text-foreground">
              اسم المستخدم
            </span>
            <Input
              ref={usernameRef}
              dir="rtl"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label className="space-y-2 text-right">
            <span className="block text-sm font-medium text-foreground">
              كلمة المرور
            </span>
            <Input
              dir="rtl"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {errorMessage ? (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "جاري التحقق..." : "تسجيل الدخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}

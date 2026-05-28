import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Pencil, Plus, PowerOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseAppError } from "@/modules/items/utils";
import { SectionCard } from "@/shared/components/SectionCard";
import { cn } from "@/lib/utils";

type Role = "admin" | "cashier" | "accountant";

type User = {
  id: number;
  name: string;
  username: string;
  role: Role;
  is_active: number;
  created_at: string;
};

type UserFormValues = {
  name: string;
  username: string;
  password: string;
  role: Role;
};

const roleLabels: Record<Role, string> = {
  admin: "مدير",
  cashier: "كاشير",
  accountant: "محاسب",
};

const roleBadgeClasses: Record<Role, string> = {
  admin: "bg-violet-100 text-violet-800 hover:bg-violet-100",
  cashier: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  accountant: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
};

const initialValues: UserFormValues = {
  name: "",
  username: "",
  password: "",
  role: "cashier",
};

export default function UsersManagement() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => invoke<User[]>("list_users"),
  });

  useEffect(() => {
    if (usersQuery.error) {
      toast.error(parseAppError(usersQuery.error).message_ar);
    }
  }, [usersQuery.error]);

  const handleAdd = () => {
    setEditingUser(null);
    setOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setOpen(true);
  };

  const handleDialogChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setEditingUser(null);
    }
  };

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => invoke<boolean>("deactivate_user", { id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("تم تعطيل المستخدم بنجاح");
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-5 shadow-sm">
        <div className="absolute inset-y-0 start-0 w-40 bg-gradient-to-l from-primary/10 to-transparent" />
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          الإعدادات
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          إدارة المستخدمين
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          أنشئ حسابات جديدة، عدل الأدوار، وعطّل المستخدمين غير النشطين من هنا.
        </p>
      </div>

      <SectionCard
        title="المستخدمون"
        action={
          <Button onClick={handleAdd}>
            <Plus />
            مستخدم جديد
          </Button>
        }
        withHeaderBorder
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-right">
            <thead>
              <tr className="text-sm text-muted-foreground">
                <th className="border-b px-4 py-3 font-medium">الاسم</th>
                <th className="border-b px-4 py-3 font-medium">اسم المستخدم</th>
                <th className="border-b px-4 py-3 font-medium">الدور</th>
                <th className="border-b px-4 py-3 font-medium">الحالة</th>
                <th className="border-b px-4 py-3 font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={5}
                  >
                    جاري تحميل المستخدمين...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={5}
                  >
                    لا توجد مستخدمون بعد.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isActive = user.is_active === 1;
                  const isCurrentUser = false;

                  return (
                    <tr key={user.id} className="border-b last:border-b-0">
                      <td className="px-4 py-4 font-medium">{user.name}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {user.username}
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={roleBadgeClasses[user.role]}>
                          {roleLabels[user.role]}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={isActive ? "secondary" : "destructive"}
                          className={cn(
                            isActive
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                              : undefined,
                          )}
                        >
                          {isActive ? "نشط" : "غير نشط"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            <Pencil />
                            تعديل
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (isCurrentUser) {
                                toast.error("لا يمكن تعطيل المستخدم الحالي");
                                return;
                              }

                              const confirmed = window.confirm(
                                `هل تريد تعطيل المستخدم ${user.name}؟`,
                              );

                              if (confirmed) {
                                deactivateMutation.mutate(user.id);
                              }
                            }}
                            disabled={!isActive || deactivateMutation.isPending}
                          >
                            {deactivateMutation.isPending ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <PowerOff />
                            )}
                            تعطيل
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <UserFormDialog
        open={open}
        onOpenChange={handleDialogChange}
        user={editingUser}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ["users"] });
        }}
      />
    </div>
  );
}

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess: () => Promise<void>;
};

function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserFormDialogProps) {
  const [values, setValues] = useState<UserFormValues>(initialValues);
  const isEdit = Boolean(user);

  useEffect(() => {
    if (open) {
      setValues(
        user
          ? {
              name: user.name,
              username: user.username,
              password: "",
              role: user.role,
            }
          : initialValues,
      );
    }
  }, [open, user]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: values.name.trim(),
        username: values.username.trim(),
        password: values.password.trim() || null,
        role: values.role,
      };

      if (isEdit && user) {
        return invoke<User>("update_user", {
          id: user.id,
          payload,
        });
      }

      return invoke<User>("create_user", { payload });
    },
    onSuccess: async () => {
      await onSuccess();
      toast.success(
        isEdit ? "تم تحديث المستخدم بنجاح" : "تم إنشاء المستخدم بنجاح",
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const handleChange = (field: keyof UserFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!values.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }

    if (!values.username.trim()) {
      toast.error("اسم المستخدم مطلوب");
      return;
    }

    if (!isEdit || values.password.trim()) {
      if (values.password.trim().length < 6) {
        toast.error("كلمة المرور يجب ألا تقل عن 6 أحرف");
        return;
      }
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>{isEdit ? "تعديل مستخدم" : "إضافة مستخدم"}</DialogTitle>
          <DialogDescription>
            أدخل بيانات المستخدم ثم احفظ التغييرات.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="الاسم *"
              value={values.name}
              onChange={(value) => handleChange("name", value)}
            />
            <Field
              label="اسم المستخدم *"
              value={values.username}
              onChange={(value) => handleChange("username", value)}
            />
            <Field
              label={isEdit ? "كلمة المرور (اختياري)" : "كلمة المرور *"}
              type="password"
              value={values.password}
              onChange={(value) => handleChange("password", value)}
              className="md:col-span-2"
            />
            <label className="space-y-2 text-right md:col-span-2">
              <span className="block text-sm font-medium text-foreground">
                الدور *
              </span>
              <select
                dir="rtl"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={values.role}
                onChange={(event) =>
                  handleChange("role", event.target.value as Role)
                }
              >
                <option value="admin">مدير</option>
                <option value="cashier">كاشير</option>
                <option value="accountant">محاسب</option>
              </select>
            </label>
          </div>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button
              type="submit"
              className="min-w-28"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {isEdit ? "حفظ التعديلات" : "إضافة المستخدم"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  className?: string;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  className,
}: FieldProps) {
  return (
    <label className={cn("space-y-2 text-right", className)}>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <Input
        dir="rtl"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

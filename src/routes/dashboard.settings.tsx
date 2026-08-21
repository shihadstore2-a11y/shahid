import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConsentSettings } from "@/components/consent-settings";
import { BadgesList } from "@/components/badges-list";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  formatSaudiPhoneDisplay,
  normalizeSaudiPhone,
  validateSaudiPhone,
  SAUDI_PHONE_ERROR,
  SAUDI_PHONE_PLACEHOLDER,
} from "@/lib/phone";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — رِفد" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      // Show stored value in pretty form if normalizable, else raw
      setWhatsapp(profile.whatsapp ? formatSaudiPhoneDisplay(profile.whatsapp) : "");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    if (whatsapp.trim() && !validateSaudiPhone(whatsapp)) {
      toast.error(SAUDI_PHONE_ERROR);
      return;
    }
    const normalizedWhatsapp = whatsapp.trim() ? normalizeSaudiPhone(whatsapp) : null;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          whatsapp: normalizedWhatsapp,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("تم حفظ الإعدادات");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <p className="text-xs font-bold text-primary">المرحلة 5 من الخطة · التقدم 100%</p>
      <h1 className="mt-1 text-2xl font-extrabold">إعدادات حسابك</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        أدر بياناتك الأساسية. واتساب اختياري للحساب، ويُطلب فقط عند طلب اشتراك أو متابعة تنبيه مهم.
      </p>

      <div className="mt-6 max-w-2xl space-y-4">
        {/* معلومات الحساب */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <h3 className="mb-4 font-bold">معلومات الحساب</h3>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                className="mt-1 bg-muted"
                type="email"
                value={user?.email ?? ""}
                disabled
                readOnly
              />
              <p className="mt-1 text-xs text-muted-foreground">
                لا يمكن تغيير البريد من هنا
              </p>
            </div>
            <div>
              <Label htmlFor="fullName">الاسم الكامل</Label>
              <Input
                id="fullName"
                className="mt-1"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="اسمك"
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="whatsapp">
                رقم واتساب <span className="text-muted-foreground">(اختياري)</span>
              </Label>
              <Input
                id="whatsapp"
                className="mt-1 ltr"
                dir="ltr"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder={SAUDI_PHONE_PLACEHOLDER}
                maxLength={20}
                inputMode="tel"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                يساعدنا في التواصل عند طلب الاشتراك والتنبيهات المهمة، وليس شرطاً لدخول لوحة التحكم.
              </p>
            </div>
          </div>
          <Button
            onClick={save}
            disabled={saving}
            className="mt-5 gradient-primary text-primary-foreground"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                حفظ التعديلات
              </>
            )}
          </Button>
        </div>

        {/* شارات First-Win */}
        <BadgesList />

        {/* إعدادات التواصل والتسويق (PDPL) */}
        <ConsentSettings />
      </div>
    </DashboardShell>
  );
}

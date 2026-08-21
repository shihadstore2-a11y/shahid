import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Wand2,
  Image as ImageIcon,
  Clapperboard,
  ImagePlus,
  Library,
  LayoutGrid,
  Megaphone,
  Store,
  BarChart3,
  CreditCard,
  Settings,
  Sparkles,
  LogOut,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Mail,
  Inbox,
  Coins,
  Database,
  Video,
  SlidersHorizontal,
  FolderKanban,
  ShieldAlert,
  Moon,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getNewContactCount } from "@/server/admin-contact-submissions";
import { CreditsBar } from "@/components/credits-bar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { FirstWinToast } from "@/components/first-win-toast";

type DashboardNavPath =
  | "/dashboard"
  | "/dashboard/campaign-studio"
  | "/dashboard/generate-text"
  | "/dashboard/generate-image"
  | "/dashboard/generate-video"
  | "/dashboard/edit-image"
  | "/dashboard/templates"
  | "/dashboard/library"
  | "/dashboard/store-profile"
  | "/dashboard/usage"
  | "/dashboard/credits"
  | "/dashboard/billing"
  | "/dashboard/settings";

type NavItem = {
  to: DashboardNavPath;
  label: string;
  icon: LucideIcon;
};

const NAV_GROUPS: readonly { label: string; items: readonly NavItem[] }[] = [
  {
    label: "ابدأ",
    items: [
      { to: "/dashboard", label: "نظرة عامة", icon: LayoutDashboard },
      { to: "/dashboard/campaign-studio", label: "استوديو الحملات", icon: Megaphone },
    ],
  },
  {
    label: "أدوات الإنشاء",
    items: [
      { to: "/dashboard/generate-text", label: "اكتب نصاً يبيع", icon: Wand2 },
      { to: "/dashboard/generate-image", label: "صمّم صورة إعلان", icon: ImageIcon },
      { to: "/dashboard/generate-video", label: "أنشئ فيديو قصير", icon: Clapperboard },
      { to: "/dashboard/edit-image", label: "حسّن صورة منتج", icon: ImagePlus },
    ],
  },
  {
    label: "الأصول والهوية",
    items: [
      { to: "/dashboard/templates", label: "معرض القوالب", icon: LayoutGrid },
      { to: "/dashboard/library", label: "مكتبتي", icon: Library },
      { to: "/dashboard/store-profile", label: "ذاكرة المتجر", icon: Store },
    ],
  },
  {
    label: "الحساب",
    items: [
      { to: "/dashboard/usage", label: "الاستخدام والرصيد", icon: BarChart3 },
      { to: "/dashboard/credits", label: "نقاط الفيديو", icon: Coins },
      { to: "/dashboard/billing", label: "الاشتراك والفواتير", icon: CreditCard },
      { to: "/dashboard/settings", label: "الإعدادات", icon: Settings },
    ],
  },
] as const;

const NAV: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

const ADMIN_NAV = [
  { to: "/admin/analytics", label: "تحليلات الأدمن", icon: TrendingUp },
  { to: "/admin/subscriptions", label: "إدارة الاشتراكات", icon: ShieldCheck },
  { to: "/admin/video-jobs", label: "إدارة الفيديو", icon: Video },
  { to: "/admin/video-providers", label: "مزودو الفيديو", icon: SlidersHorizontal },
  { to: "/admin/campaign-packs", label: "إدارة الحملات", icon: FolderKanban },
  { to: "/admin/abuse-monitor", label: "مراقبة الإساءة", icon: ShieldAlert },
  { to: "/admin/credits", label: "شحن نقاط الفيديو", icon: Coins },
  { to: "/admin/credit-ledger", label: "دفتر نقاط الفيديو", icon: BarChart3 },
  { to: "/admin/reconcile", label: "مزامنة الاستخدام", icon: Database },
  { to: "/admin/contact-submissions", label: "رسائل التواصل", icon: Inbox, badgeKey: "contact" as const },
  { to: "/admin/email-monitor", label: "مراقبة البريد", icon: Mail },
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const isMobile = useIsMobile();
  const fetchNewContacts = useServerFn(getNewContactCount);
  const [newContactCount, setNewContactCount] = useState(0);

  // حماية: غير المسجلين يُحوَّلون إلى /auth
  useEffect(() => {
    if (!loading && !user) {
      const redirect = `${location.pathname}${location.searchStr}${location.hash}`;
      void navigate({ to: "/auth", search: { redirect } as never, replace: true });
    }
  }, [loading, user, navigate, location.pathname, location.searchStr, location.hash]);

  // عدّاد رسائل التواصل الجديدة (للأدمن فقط)
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    const tick = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const r = await fetchNewContacts({ headers: { Authorization: `Bearer ${session.access_token}` } });
        if (alive) setNewContactCount(r.count);
      } catch {
        // silent
      }
    };
    void tick();
    const id = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isAdmin, fetchNewContacts]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("تم تسجيل الخروج");
      void navigate({ to: "/" });
    } catch {
      toast.error("فشل تسجيل الخروج");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const redirect = `${location.pathname}${location.searchStr}${location.hash}`;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-soft">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
          <h1 className="text-lg font-extrabold text-foreground">يلزم تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-muted-foreground">سيتم تحويلك لصفحة الدخول، ويمكنك المتابعة يدوياً إذا تأخر التحويل.</p>
          <Button asChild className="mt-4 w-full">
            <Link to="/auth" search={{ redirect } as never}>تسجيل الدخول</Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayName = profile?.full_name || profile?.store_name || user.email?.split("@")[0] || "مستخدم";
  const initial = displayName.charAt(0).toUpperCase();
  const desktopShellClass =
    "sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-sidebar-border bg-sidebar md:flex";
  const desktopHeaderClass =
    "sticky top-0 z-10 hidden border-b border-border bg-background/80 backdrop-blur md:block";
  const mobileHeaderClass =
    "sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur md:hidden";
  const forcedMobileHeaderClass =
    "sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={isMobile ? "hidden" : desktopShellClass}>
        <Link to="/" className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>رِفد</span>
        </Link>

        <div className="border-b border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full gradient-primary text-sm font-bold text-primary-foreground">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                  activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                  activeOptions={{ exact: item.to === "/dashboard" }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          {isAdmin && (
            <>
              <div className="mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-gold/80">
                الإدارة
              </div>
              {ADMIN_NAV.map((item) => {
                const showBadge =
                  "badgeKey" in item && item.badgeKey === "contact" && newContactCount > 0;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gold hover:bg-gold/10"
                    activeProps={{ className: "bg-gold/15 text-gold" }}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                        {newContactCount > 99 ? "99+" : newContactCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={toggle}
            className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        {/* Desktop top bar — يحوي شريط الرصيد */}
        <header className={isMobile ? "hidden" : desktopHeaderClass}>
          <div className="flex items-center justify-end gap-3 px-6 py-3">
            <CreditsBar />
          </div>
        </header>

        {/* Mobile top bar */}
        <header className={isMobile ? forcedMobileHeaderClass : mobileHeaderClass}>
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <Link to="/" className="flex items-center gap-2 font-bold">
              <Sparkles className="h-4 w-4 text-primary" /> رِفد
            </Link>
            <div className="flex items-center gap-2">
              <CreditsBar />
              <button
                onClick={toggle}
                aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
                className="rounded-md p-2 text-muted-foreground hover:bg-secondary"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                onClick={handleLogout}
                aria-label="تسجيل الخروج"
                className="rounded-md p-2 text-muted-foreground hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-2 py-2">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
                activeProps={{ className: "bg-secondary text-foreground" }}
                activeOptions={{ exact: item.to === "/dashboard" }}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && ADMIN_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="shrink-0 rounded-md px-3 py-1.5 text-xs font-bold text-gold hover:bg-gold/10"
                activeProps={{ className: "bg-gold/15 text-gold" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        <FirstWinToast />
      </div>
    </div>
  );
}

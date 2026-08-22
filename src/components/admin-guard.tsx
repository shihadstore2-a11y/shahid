import { useEffect, useState, type ReactNode } from "react";
import { redirect, useLocation, useNavigate, type ParsedLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_AUTH_TIMEOUT_MS = 10_000;

function authTimeout() {
  return new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), ADMIN_AUTH_TIMEOUT_MS);
  });
}

async function hasAdminRole(userId: string) {
  const roleQuery = (async () => {
    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!error && data === true) return true;

      // Fallback: check user_roles directly
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      return !!roleRow;
    } catch {
      return false;
    }
  })();

  return Promise.race([roleQuery, authTimeout().then(() => false)]);
}

export async function adminBeforeLoad({ location }: { location: ParsedLocation }) {
  if (typeof window === "undefined") return;
  try {
    const session = await Promise.race([
      supabase.auth.getSession().then(({ data }) => data.session).catch(() => null),
      authTimeout(),
    ]);

    if (!session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  } catch (err) {
    if (err && typeof err === "object" && "to" in err) {
      throw err;
    }
    // Let AdminGuard handle authorization gracefully in the component tree
  }
}

interface AdminGuardProps {
  children: ReactNode;
  loadingLabel?: string;
}

export function AdminGuard({ children, loadingLabel }: AdminGuardProps) {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [guardTimedOut, setGuardTimedOut] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin !== null) {
      setGuardTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setGuardTimedOut(true), ADMIN_AUTH_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [loading, isAdmin]);

  useEffect(() => {
    if (!guardTimedOut && (loading || isAdmin === null)) return;
    if (!user) {
      if (location.pathname === "/auth") return;
      const redirectPath = `${location.pathname}${location.searchStr}${location.hash}`;
      void navigate({ to: "/auth", search: { redirect: redirectPath } as never });
      return;
    }
    if (isAdmin !== true) {
      if (location.pathname === "/dashboard") return;
      void navigate({ to: "/dashboard" });
    }
  }, [user, isAdmin, loading, guardTimedOut, navigate, location.pathname, location.searchStr, location.hash]);

  if (loading || isAdmin === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {guardTimedOut ? "لم يُحسم التحقق بعد؛ جاري إعادة التوجيه…" : loadingLabel ?? "جاري التحقق من الصلاحيات…"}
          </p>
        </div>
      </div>
    );
  }

  if (!user || isAdmin === false) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h2 className="mb-2 text-lg font-bold text-foreground">
            صلاحية غير كافية
          </h2>
          <p className="text-sm text-muted-foreground">
            هذه الصفحة متاحة لمسؤولي المنصة فقط. ستتم إعادة توجيهك…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

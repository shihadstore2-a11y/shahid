import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  store_name: string | null;
  product_type: string | null;
  audience: string | null;
  tone: string | null;
  brand_color: string | null;
  brand_personality: string | null;
  unique_selling_point: string | null;
  banned_phrases: string[] | null;
  shipping_policy: string | null;
  exchange_policy: string | null;
  faq_notes: string | null;
  high_margin_products: string[] | null;
  cta_style: string | null;
  seasonal_priorities: string[] | null;
  compliance_notes: string | null;
  whatsapp: string | null;
  plan: "free" | "starter" | "growth" | "pro" | "business";
  onboarded: boolean;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /**
   * هل المستخدم الحالي يحمل دور "admin"؟
   * يُحمَّل مرة واحدة عند تسجيل الدخول ويُشارَك بين جميع المكونات،
   * تجنباً لاستعلامات user_roles المكررة (سابقاً 6 طلبات/ثانية).
   * null أثناء التحميل، true/false بعد التحقق.
   */
  isAdmin: boolean | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_TIMEOUT_MS = 3_500;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // يحتفظ بآخر userId تم تحميل بياناته، حتى لا نُكرّر استعلامات profiles + user_roles
  // عندما يُطلِق Supabase أحداث متعدّدة (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED…)
  // أو عند إعادة التهيئة في React StrictMode.
  const loadedUserIdRef = useRef<string | null>(null);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  };

  const loadIsAdmin = async (userId: string) => {
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    setIsAdmin(error ? false : data === true);
  };

  const loadUserData = async (userId: string, force = false) => {
    if (!force && loadedUserIdRef.current === userId) return;
    loadedUserIdRef.current = userId;
    // نشغّل البروفايل والدور بالتوازي — استعلامان فقط لكل جلسة بدلاً من تكرارهما في كل مكوّن.
    await Promise.race([
      Promise.allSettled([loadProfile(userId), loadIsAdmin(userId)]),
      wait(AUTH_TIMEOUT_MS),
    ]);
    setIsAdmin((current) => current ?? false);
  };

  useEffect(() => {
    // CRITICAL: subscribe BEFORE getSession to avoid missing events
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          // Defer DB call to avoid deadlocks inside the auth callback
          setTimeout(() => {
            void loadUserData(newSession.user.id);
          }, 0);
        } else {
          loadedUserIdRef.current = null;
          setProfile(null);
          setIsAdmin(false);
        }
      }
    );

    void Promise.race([
      supabase.auth.getSession(),
      wait(AUTH_TIMEOUT_MS).then(() => ({ data: { session: null } })),
    ]).then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void loadUserData(s.user.id).finally(() => setLoading(false));
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    loadedUserIdRef.current = null;
    setProfile(null);
    setIsAdmin(false);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

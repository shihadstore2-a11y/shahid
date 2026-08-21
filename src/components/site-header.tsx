import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { RifdLogo } from "@/components/rifd-logo";

const NAV = [
  { to: "/", label: "الرئيسية" },
  { to: "/proof-center", label: "مركز الإثبات" },
  { to: "/library", label: "المكتبة" },
  { to: "/business-solutions", label: "رِفد للأعمال" },
  { to: "/vs-chatgpt", label: "vs ChatGPT" },
  { to: "/pricing", label: "الأسعار" },
  { to: "/about", label: "من نحن" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:h-17 sm:gap-3">
          <Link to="/" className="flex min-w-0 flex-1 items-center font-bold md:flex-none" aria-label="رِفد للتقنية">
            <span className="sm:hidden">
              <RifdLogo size="sm" showDescriptor={false} />
            </span>
            <span className="hidden sm:inline-flex">
              <RifdLogo size="md" showDescriptor />
            </span>
          </Link>

        <nav className="hidden items-center gap-0.5 xl:flex xl:gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-2.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:px-3 lg:text-sm"
              activeProps={{ className: "bg-secondary text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="تبديل الوضع"
            className="hidden sm:inline-flex"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button asChild size="sm" className="h-9 px-3 text-xs shadow-elegant xl:hidden">
            <Link to="/onboarding">ابدأ مجاناً</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex">
            <Link to="/auth">تسجيل دخول</Link>
          </Button>
          <Button asChild size="sm" className="hidden xl:inline-flex shadow-elegant">
            <Link to="/onboarding">ابدأ مجاناً</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 xl:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="القائمة"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "border-t border-border bg-background/95 backdrop-blur-md xl:hidden",
          open ? "block" : "hidden"
        )}
      >
        <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2 border-t border-border pt-3">
            <Button variant="outline" size="icon" onClick={toggle} aria-label="تبديل الوضع" className="shrink-0">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link to="/auth" onClick={() => setOpen(false)}>تسجيل دخول</Link>
            </Button>
            <Button asChild size="sm" className="flex-1">
              <Link to="/onboarding" onClick={() => setOpen(false)}>ابدأ مجاناً</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

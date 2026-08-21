import { Link } from "@tanstack/react-router";
import { Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { RifdLogo } from "@/components/rifd-logo";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="inline-flex items-center font-bold" aria-label="رِفد للتقنية">
              <RifdLogo size="md" showDescriptor />
            </Link>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
              رِفد للتقنية: منصة سعودية للمتاجر تقدّم محتوى، صور، وحملات ذكية للسوق السعودي، مع مسار مؤسسي مخصص عند الحاجة للوكالات والمؤسسات.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/5 px-3 py-1.5 text-[11px] font-bold text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              خصوصية واضحة وسياسات وصول محددة
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-bold text-foreground">المنتج</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/library" className="text-muted-foreground hover:text-foreground">المكتبة</Link></li>
              <li><Link to="/proof-center" className="text-muted-foreground hover:text-foreground">مركز الإثبات</Link></li>
              <li><Link to="/pricing" className="text-muted-foreground hover:text-foreground">الأسعار</Link></li>
              <li><Link to="/business-solutions" className="text-muted-foreground hover:text-foreground">رِفد للأعمال</Link></li>
              <li><Link to="/vs-chatgpt" className="text-muted-foreground hover:text-foreground">رِفد vs ChatGPT</Link></li>
              <li><Link to="/onboarding" className="text-muted-foreground hover:text-foreground">جرّب مجاناً</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-bold text-foreground">الشركة والتواصل</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="text-muted-foreground hover:text-foreground">من نحن</Link></li>
              <li><Link to="/contact" className="text-muted-foreground hover:text-foreground">تواصل معنا</Link></li>
              <li><Link to="/legal/privacy" className="text-muted-foreground hover:text-foreground">سياسة الخصوصية</Link></li>
              <li><Link to="/legal/terms" className="text-muted-foreground hover:text-foreground">الشروط والأحكام</Link></li>
              <li><Link to="/legal/refund" className="text-muted-foreground hover:text-foreground">سياسة الاسترجاع</Link></li>
              <li>
                <a href="mailto:hello@rifd.site" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>hello@rifd.site</span>
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/966582286215"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>واتساب الدعم</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {year} رِفد للتقنية — مسجَّلة في المملكة العربية السعودية. جميع الحقوق محفوظة.</span>
          <span className="flex items-center gap-2">
            صُنع بحب 🇸🇦 في الرياض
          </span>
        </div>
      </div>
    </footer>
  );
}

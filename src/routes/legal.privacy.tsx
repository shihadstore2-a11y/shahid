import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { ShieldCheck, Mail, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — رِفد للتقنية" },
      {
        name: "description",
        content:
          "سياسة خصوصية رِفد للتقنية وفق نظام حماية البيانات الشخصية السعودي (PDPL). كيف نجمع بياناتك ونحميها ومن يطّلع عليها وحقوقك الكاملة.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">سياسة الخصوصية</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              آخر تحديث: 21 أبريل 2026 — متوافقة مع نظام حماية البيانات الشخصية السعودي (PDPL)
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-8 text-[15px] leading-[1.85] text-muted-foreground">
          {/* Intro */}
          <section className="rounded-xl border border-border bg-card p-5">
            <p className="text-foreground">
              نحن في <strong>رِفد للتقنية</strong> (يُشار إليها بـ"رِفد"، "نحن"، "خدمتنا") نلتزم بحماية
              خصوصية مستخدمينا وفق نظام حماية البيانات الشخصية الصادر بالمرسوم الملكي رقم
              (م/19) وتاريخ 9/2/1443هـ ولائحته التنفيذية. توضّح هذه السياسة طبيعة البيانات
              الشخصية التي نجمعها، أغراض المعالجة، الأساس النظامي، حقوقك بصفتك صاحب
              البيانات، وآليات ممارستها.
            </p>
          </section>

          {/* 1. Identity */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">1. هوية المتحكم في البيانات</h2>
            <ul className="list-disc space-y-1 pr-5">
                <li>الاسم التجاري: رِفد للتقنية</li>
              <li>المقر: المملكة العربية السعودية — الرياض</li>
              <li>البريد الرسمي: <a className="text-primary hover:underline" href="mailto:hello@rifd.site">hello@rifd.site</a></li>
              <li>قنوات التواصل بشأن الخصوصية: <a className="text-primary hover:underline" href="mailto:privacy@rifd.site">privacy@rifd.site</a></li>
            </ul>
          </section>

          {/* 2. Data we collect */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">2. البيانات التي نجمعها</h2>
            <p>نجمع الحد الأدنى الضروري من البيانات لتقديم الخدمة وتحسينها، وتشمل:</p>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                <h3 className="font-bold text-foreground">أ. بيانات الحساب</h3>
                <p className="mt-1 text-sm">الاسم الكامل، البريد الإلكتروني، بيانات الجلسة المُدارة، رقم الجوال (اختياري للتفعيل).</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                <h3 className="font-bold text-foreground">ب. بيانات ملف المتجر</h3>
                <p className="mt-1 text-sm">اسم المتجر، نوع المنتجات، الجمهور المستهدف، نبرة الخطاب، لون العلامة — وتُستخدم حصراً لتخصيص المحتوى المُولَّد لك.</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                <h3 className="font-bold text-foreground">ج. بيانات الاستخدام والمحتوى</h3>
                <p className="mt-1 text-sm">المُدخلات التي ترسلها لنماذج الذكاء الاصطناعي، النتائج المُولَّدة، عدد عمليات التوليد، التواريخ. تبقى ملكاً لك ولا تُشارَك مع أي طرف خارجي لأغراض تسويقية.</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                <h3 className="font-bold text-foreground">د. البيانات التقنية</h3>
                <p className="mt-1 text-sm">عنوان IP (مجزَّأ لأغراض الحماية من الإساءة)، نوع المتصفح، نظام التشغيل، صفحات التصفح. تُحفظ لفترة محدودة لأغراض الأمان والتحليل المُجمَّع.</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                <h3 className="font-bold text-foreground">هـ. بيانات الدفع</h3>
                <p className="mt-1 text-sm">عند رفع إيصال تحويل بنكي: صورة الإيصال، اسم البنك، تاريخ التحويل. لا نُخزِّن أرقام بطاقات أو معلومات مصرفية حسّاسة.</p>
              </div>
            </div>
          </section>

          {/* 3. Legal basis */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">3. الأساس النظامي للمعالجة</h2>
            <p>نعالج بياناتك استناداً إلى أحد الأسس التالية المنصوص عليها في المادة (5) من نظام PDPL:</p>
            <ul className="mt-2 list-disc space-y-1 pr-5">
              <li><strong>تنفيذ العقد:</strong> لتقديم الخدمة المتفق عليها (إنشاء الحساب، توليد المحتوى، تفعيل الاشتراك).</li>
              <li><strong>المصلحة المشروعة:</strong> للأمان، منع الاحتيال، تحليل الأداء المُجمَّع.</li>
              <li><strong>الموافقة:</strong> للرسائل التسويقية الاختيارية (يمكن سحبها في أي وقت).</li>
              <li><strong>الالتزام النظامي:</strong> الاحتفاظ بسجلات الفوترة والضرائب وفق الأنظمة السعودية.</li>
            </ul>
          </section>

          {/* 4. Subprocessors */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">4. المعالجون الفرعيون والتحويل خارج المملكة</h2>
            <p>
              نستعين بمزوّدي خدمات تقنية محدودين لتشغيل المنصة. هؤلاء المعالجون مرتبطون
              بنا باتفاقيات معالجة بيانات (DPA) تُلزمهم بالحفاظ على سرية بياناتك:
            </p>
            <div className="mt-3 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-foreground">
                  <tr>
                    <th className="p-3 text-right font-bold">المعالج</th>
                    <th className="p-3 text-right font-bold">الغرض</th>
                    <th className="p-3 text-right font-bold">موقع الخوادم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-3">Lovable Cloud</td>
                    <td className="p-3">البنية الخلفية، قاعدة البيانات، والتخزين</td>
                    <td className="p-3">مناطق تشغيل آمنة بحسب مزوّد الخدمة</td>
                  </tr>
                  <tr>
                    <td className="p-3">Cloudflare</td>
                    <td className="p-3">استضافة وشبكة توصيل</td>
                    <td className="p-3">عالمي (Edge)</td>
                  </tr>
                  <tr>
                    <td className="p-3">Lovable AI Gateway</td>
                    <td className="p-3">معالجة طلبات الذكاء الاصطناعي</td>
                    <td className="p-3">الاتحاد الأوروبي / الولايات المتحدة</td>
                  </tr>
                  <tr>
                    <td className="p-3">مزود البريد المعاملاتي</td>
                    <td className="p-3">إرسال رسائل الحساب والفواتير والتنبيهات</td>
                    <td className="p-3">بحسب إعدادات مزود البريد</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm">
              قد يستلزم تشغيل الخدمة نقل بياناتك خارج المملكة العربية السعودية. نضمن أن
              يكون النقل وفق الضمانات المنصوص عليها في المادتين (29) و(30) من نظام PDPL،
              ولن يُنقَل أي بيان شخصي إلى دولة لا توفّر مستوى حماية كافياً دون موافقتك
              الصريحة أو وجود ضمانات تعاقدية ملزمة.
            </p>
          </section>

          {/* 5. Retention */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">5. مدة الاحتفاظ بالبيانات</h2>
            <ul className="list-disc space-y-1 pr-5">
              <li><strong>بيانات الحساب:</strong> طوال فترة نشاط الحساب + 12 شهراً بعد الإغلاق.</li>
              <li><strong>المحتوى المُولَّد:</strong> طوال فترة الاشتراك، ويُحذَف خلال 30 يوماً من طلب الحذف.</li>
              <li><strong>سجلات الفوترة:</strong> 10 سنوات وفق متطلبات هيئة الزكاة والضريبة والجمارك.</li>
              <li><strong>السجلات التقنية:</strong> 90 يوماً بحدّ أقصى.</li>
            </ul>
          </section>

          {/* 6. Rights */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">6. حقوقك بصفتك صاحب البيانات</h2>
            <p>تكفل لك المادة (4) من نظام PDPL الحقوق التالية، ويمكنك ممارستها مجاناً في أي وقت:</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ["حق العلم", "معرفة الأساس والغرض من جمع بياناتك"],
                ["حق الوصول", "الحصول على نسخة من بياناتك"],
                ["حق التصحيح", "تعديل البيانات غير الدقيقة"],
                ["حق الإتلاف", "طلب حذف بياناتك"],
                ["حق نقل البيانات", "استلامها بصيغة قابلة للقراءة الآلية"],
                ["حق الاعتراض", "على المعالجة لأغراض التسويق المباشر"],
              ].map(([t, d]) => (
                <div key={t} className="rounded-lg border border-border/60 bg-card/40 p-3">
                  <div className="text-sm font-bold text-foreground">{t}</div>
                  <div className="mt-0.5 text-xs">{d}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm">
              لممارسة أيٍّ من هذه الحقوق، راسلنا على
              {" "}<a className="text-primary hover:underline" href="mailto:privacy@rifd.site">privacy@rifd.site</a>{" "}
              وسنرد خلال 30 يوماً كحدّ أقصى.
            </p>
          </section>

          {/* 7. Security */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">7. الإجراءات الأمنية</h2>
            <ul className="list-disc space-y-1 pr-5">
              <li>تأمين الاتصال أثناء النقل واستخدام تخزين مُدار بمعايير حماية حديثة.</li>
              <li>سياسات وصول صارمة على مستوى البيانات بحيث يرى كل مستخدم بياناته فقط.</li>
              <li>إدارة كلمات المرور والجلسات عبر نظام مصادقة مُدار دون تخزين كلمات مرور قابلة للقراءة.</li>
              <li>سجلات تدقيق (Audit Log) على العمليات الإدارية الحسّاسة.</li>
              <li>مراقبة DLQ وتنبيهات Telegram للأعطال خلال دقائق.</li>
            </ul>
          </section>

          {/* 8. Cookies */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">8. ملفات تعريف الارتباط (Cookies)</h2>
            <p>
              نستخدم cookies تقنية ضرورية للجلسات (sb-access-token) وأخرى تحليلية مُجمَّعة
              لقياس الأداء. لن نُفعِّل cookies تتبّع تسويقي إلا بموافقتك الصريحة عبر
              شريط الموافقة الظاهر عند أول زيارة.
            </p>
          </section>

          {/* 9. Minors */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">9. خصوصية القاصرين</h2>
            <p>
              الخدمة موجَّهة لأصحاب الأعمال البالغين (18 عاماً فأكثر). لا نجمع عمداً بيانات
              من القاصرين، وإذا اكتشفنا ذلك سنحذف الحساب فوراً.
            </p>
          </section>

          {/* 10. Updates */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">10. التحديثات على هذه السياسة</h2>
            <p>
              قد نُحدِّث هذه السياسة من حين لآخر. أي تغيير جوهري سيُعلَن عبر البريد
              الإلكتروني قبل 14 يوماً من سريانه. تاريخ آخر تحديث مدوَّن أعلى الصفحة.
            </p>
          </section>

          {/* 11. Complaints */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">11. آلية تقديم الشكاوى</h2>
            <p>
              إذا رأيت أن معالجتنا لبياناتك تخالف الأنظمة، يحق لك:
            </p>
            <ol className="mt-2 list-decimal space-y-1 pr-5">
              <li>التواصل معنا أولاً على <a className="text-primary hover:underline" href="mailto:privacy@rifd.site">privacy@rifd.site</a> وسنبذل قصارى جهدنا لحل المسألة خلال 30 يوماً.</li>
              <li>إذا لم تُحَلّ، يمكنك تقديم شكوى رسمية للهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) عبر <a className="text-primary hover:underline" href="https://sdaia.gov.sa" target="_blank" rel="noreferrer noopener">sdaia.gov.sa</a>.</li>
            </ol>
          </section>

          {/* Contact CTA */}
          <section className="rounded-2xl border border-primary/20 bg-secondary/40 p-6">
            <h2 className="text-lg font-bold text-foreground">تواصل مع مسؤول الخصوصية</h2>
            <p className="mt-2 text-sm">
              لأي استفسار يخص هذه السياسة أو طلب ممارسة حقوقك:
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="mailto:privacy@rifd.site"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                <Mail className="h-4 w-4" />
                privacy@rifd.site
              </a>
              <a
                href="https://wa.me/966582286215"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary"
              >
                <MessageCircle className="h-4 w-4" />
                واتساب الدعم
              </a>
            </div>
          </section>
        </div>
      </article>
    </MarketingLayout>
  );
}

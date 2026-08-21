import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { Scale, Mail, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "الشروط والأحكام — رِفد للتقنية" },
      {
        name: "description",
        content:
          "شروط استخدام منصة رِفد للتقنية: التسجيل، الفوترة، الملكية الفكرية للمحتوى المُولَّد، الاستخدام المقبول، الإلغاء، وحلّ النزاعات.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">الشروط والأحكام</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              آخر تحديث: 21 أبريل 2026 — تخضع لأنظمة المملكة العربية السعودية
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-8 text-[15px] leading-[1.85] text-muted-foreground">
          <section className="rounded-xl border border-border bg-card p-5">
            <p className="text-foreground">
              باستخدامك لمنصة <strong>رِفد للتقنية</strong> (الموقع: rifd.site) فإنك تقرّ
              بأنك قرأت هذه الشروط وفهمتها ووافقت على الالتزام بها. إذا لم توافق على
              أي بند منها، يجب عليك التوقف عن استخدام الخدمة فوراً.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">1. تعريف الخدمة</h2>
            <p>
              "رِفد" منصة سعودية تعتمد على نماذج الذكاء الاصطناعي لتوليد محتوى تسويقي
              (نصوص وصور) لأصحاب المتاجر الإلكترونية، بما في ذلك أوصاف المنتجات،
              المنشورات الاجتماعية، إعلانات التسويق، وصور المنتجات.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">2. التسجيل وأهلية الاستخدام</h2>
            <ul className="list-disc space-y-1 pr-5">
              <li>يجب أن يكون عمرك 18 عاماً فأكثر، أو لديك تفويض قانوني لإدارة نشاط تجاري.</li>
              <li>تتعهد بتقديم بيانات صحيحة وحديثة عند التسجيل، وتحديثها عند تغيُّرها.</li>
              <li>أنت مسؤول عن سرية بيانات الدخول، وعن جميع الأنشطة التي تتم عبر حسابك.</li>
              <li>يحق لرِفد رفض أو إلغاء أي طلب تسجيل دون إبداء أسباب.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">3. الاشتراك والفوترة</h2>
            <ul className="list-disc space-y-1 pr-5">
              <li>تتوفر خطط مجانية ومدفوعة (شهرية وسنوية)، وأسعارها معلنة على صفحة الأسعار وقد تُعدَّل بإشعار مسبق 14 يوماً.</li>
              <li>يتم الدفع حالياً عبر التحويل البنكي ورفع إيصال الدفع. التفعيل خلال 24 ساعة كحدّ أقصى من التحقق من الإيصال.</li>
              <li>الاشتراك يتجدد تلقائياً ما لم تُلغِه قبل نهاية الفترة الحالية.</li>
              <li>تُصدر فواتير ضريبية متوافقة مع نظام ضريبة القيمة المضافة السعودي.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">4. الملكية الفكرية للمحتوى المُولَّد</h2>
            <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-foreground">
              <p>
                <strong>المحتوى الذي تولِّده عبر رِفد ملكٌ كامل لك.</strong> يحق لك استخدامه
                لأغراض تجارية وغير تجارية بدون أي قيود أو رسوم إضافية، ولك الحق في
                تعديله ونشره بالطريقة التي تراها مناسبة.
              </p>
            </div>
            <ul className="mt-3 list-disc space-y-1 pr-5">
              <li>تحتفظ رِفد بحقوق الملكية الفكرية للمنصة نفسها (الواجهة، القوالب، الكود، العلامة التجارية).</li>
              <li>المحتوى المُولَّد بالذكاء الاصطناعي قد يحتوي على أوجه تشابه عرضية مع محتوى آخر؛ تتحمل وحدك مسؤولية مراجعته قبل النشر.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">5. الاستخدام المقبول</h2>
            <p>تتعهد بعدم استخدام رِفد لأيٍّ مما يلي:</p>
            <ul className="mt-2 list-disc space-y-1 pr-5">
              <li>توليد محتوى مخالف لأنظمة المملكة العربية السعودية أو الآداب العامة.</li>
              <li>توليد محتوى يحرّض على العنف، الكراهية، التمييز، أو يُسيء للأديان.</li>
              <li>توليد محتوى احتيالي أو مضلِّل أو ينتهك حقوق الملكية الفكرية للغير.</li>
              <li>محاولة الوصول غير المصرّح به للأنظمة، أو إجراء هجمات DDoS، أو الـscraping الآلي.</li>
              <li>إعادة بيع الخدمة أو إنشاء منتج منافس باستخدام مخرجاتها.</li>
              <li>تجاوز حصص الاستخدام بطرق احتيالية (إنشاء حسابات وهمية متعددة).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">6. تعليق الحساب وإنهاؤه</h2>
            <p>
              يحق لرِفد تعليق أو إنهاء حسابك فوراً ودون إشعار مسبق في حال انتهاك أي بند
              من شروط الاستخدام، مع الاحتفاظ بحقها في المطالبة بالتعويض عن الأضرار.
              في حالات الانتهاك غير الجسيم، نُرسل إشعاراً بمهلة 7 أيام للتصحيح.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">7. الإلغاء وسياسة الاسترجاع</h2>
            <ul className="list-disc space-y-1 pr-5">
              <li>يحق لك إلغاء اشتراكك في أي وقت من لوحة التحكم → الفوترة، دون رسوم.</li>
              <li>سياسة الاسترجاع الكاملة منشورة في صفحة <a className="text-primary hover:underline" href="/legal/refund">سياسة الاسترجاع</a>.</li>
              <li>عند الإلغاء، تستمر خدمتك حتى نهاية الفترة المدفوعة، ثم يتحوّل الحساب للخطة المجانية.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">8. إخلاء المسؤولية</h2>
            <ul className="list-disc space-y-1 pr-5">
              <li>تُقدَّم الخدمة "كما هي" دون ضمانات صريحة أو ضمنية تتعلق بالملاءمة لغرض معيّن.</li>
              <li>المحتوى المُولَّد بالذكاء الاصطناعي قد يحتوي على أخطاء أو معلومات غير دقيقة؛ مسؤولية المراجعة قبل النشر تقع عليك.</li>
              <li>لا نضمن توفّر الخدمة 100% من الوقت، وقد تحدث صيانات مجدولة يُعلَن عنها مسبقاً.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">9. تحديد المسؤولية</h2>
            <p>
              في الحدود القصوى التي يسمح بها النظام، لا تتحمل رِفد أي مسؤولية عن أضرار
              غير مباشرة أو تبعية أو خسارة أرباح أو سمعة ناتجة عن استخدام الخدمة.
              المسؤولية الإجمالية لرِفد لا تتجاوز قيمة المبالغ المدفوعة منك خلال
              الـ12 شهراً السابقة لتاريخ الحادثة.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">10. تعديل الشروط</h2>
            <p>
              يحق لرِفد تعديل هذه الشروط في أي وقت. التعديلات الجوهرية تُعلَن عبر
              البريد الإلكتروني قبل 14 يوماً من سريانها. استمرارك في استخدام الخدمة
              بعد التعديل يُعدّ موافقة عليه.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">11. القانون الواجب التطبيق وحلّ النزاعات</h2>
            <p>
              تخضع هذه الشروط لأنظمة المملكة العربية السعودية وتُفسَّر وفقاً لها. أي نزاع
              ينشأ عن استخدام الخدمة يُحَلّ ودياً أولاً، فإن تعذَّر فمحاكم مدينة الرياض
              هي المحكمة المختصة. ويحق للأطراف اللجوء للتحكيم وفق نظام التحكيم السعودي
              متى اتُّفق على ذلك كتابياً.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">12. الفصل والتنازل</h2>
            <p>
              إذا اعتُبر أي بند من هذه الشروط باطلاً أو غير قابل للتنفيذ، تظل بقية البنود
              سارية المفعول. عدم ممارسة رِفد لأيٍّ من حقوقها لا يُعدّ تنازلاً عنها.
            </p>
          </section>

          <section className="rounded-2xl border border-primary/20 bg-secondary/40 p-6">
            <h2 className="text-lg font-bold text-foreground">للتواصل بشأن هذه الشروط</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="mailto:hello@rifd.site"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                <Mail className="h-4 w-4" />
                hello@rifd.site
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

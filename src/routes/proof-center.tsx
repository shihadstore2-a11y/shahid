import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Clapperboard,
  Compass,
  MessageSquareQuote,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
} from "lucide-react";
import { MarketingLayout } from "@/components/marketing-layout";
import { ProofCenterOperationalProof } from "@/components/proof-center-operational-proof";
import { Button } from "@/components/ui/button";

type InternalRoute =
  | "/onboarding"
  | "/pricing"
  | "/business-solutions"
  | "/for-perfumes-beauty"
  | "/for-abayas-fashion"
  | "/for-gifts-sweets-coffee"
  | "/for-electronics-accessories"
  | "/for-kids-baby"
  | "/for-home-decor";

const decisionFramework = [
  {
    title: "1) افهم نقطة التحول",
    description: "ابدأ من الفرق بين طلب عام وبين حزمة تشغيل مترابطة تقود النص والصورة والـ CTA بنفس الزاوية.",
  },
  {
    title: "2) اختر الإثبات الأقرب لقطاعك",
    description: "لا تتعامل مع الصفحة كعرض عام؛ استخدم المثال الأقرب لمتجرك حتى تحكم على صلاحية المنطق البيعي فعلاً.",
  },
  {
    title: "3) انتقل للمسار الصحيح",
    description: "بعد وضوح الإثبات، خذ القرار المناسب: تجربة، باقة، صفحة قطاعية، أو مسار أعمال إذا كان احتياجك مؤسسياً.",
  },
];

const beforeAfter = [
  {
    title: "قبل: طلب مبعثر",
    items: [
      "أبغى بوست عن عرض جديد للعطور.",
      "أحتاج صورة مناسبة لكن ما أعرف الاتجاه.",
      "ودي بريل قصير بس ما عندي زاوية واضحة.",
    ],
  },
  {
    title: "بعد: حزمة تشغيل أولية",
    items: [
      "منشور رئيسي بنبرة تخدم دافع الشراء الحقيقي.",
      "هوكات بديلة + CTA أوضح + اتجاه بصري متسق.",
      "فكرة Reel قصيرة تنطلق من نفس الرسالة بدل فكرة منفصلة.",
    ],
  },
];

const proofPackets: Array<{
  title: string;
  studio: { product: string; audience: string; offer: string; goal: "launch" | "clearance" | "upsell" | "leads" | "competitive" | "winback"; channel: "instagram" | "snapchat" | "tiktok" | "whatsapp" };
  problem: string;
  output: string;
  outcome: string;
  href: InternalRoute;
  icon: typeof Sparkles;
}> = [
  {
    title: "العطور والجمال",
    studio: { product: "عطر شرقي فاخر 100مل بثبات عالٍ", audience: "نساء ورجال يبحثون عن هدية راقية وانطباع أول قوي", offer: "إطلاق مجموعة جديدة مع عرض أول دفعة", goal: "launch", channel: "instagram" },
    problem: "المحتوى يبقى غالباً عند كلمات مثل الفخامة والجودة دون بيع الإحساس والانطباع الأول.",
    output: "الإثبات هنا يربط الرسالة بالتجربة والثقة في الاختيار، ثم يترجمها إلى محتوى وصورة وReel متناسقين.",
    outcome: "العميلة ترى سبب الشراء بشكل أوضح: الانطباع، الثبات، والملاءمة — لا مجرد وصف المنتج.",
    href: "/for-perfumes-beauty",
    icon: Sparkles,
  },
  {
    title: "الأزياء والعبايات",
    studio: { product: "عباية عملية بتفاصيل أنيقة ومناسبة للدوام والمناسبات", audience: "نساء يبحثن عن إطلالة محتشمة وراقية وسهلة التنسيق", offer: "تشكيلة موسمية جديدة بكميات محدودة", goal: "clearance", channel: "instagram" },
    problem: "التسويق يكرر الخامة واللون بينما قرار الشراء الحقيقي يرتبط بالظهور والاستخدام والمناسبة.",
    output: "المخرج الجيد هنا يبيع المشهد النهائي: كيف تبدو القطعة، متى تُلبس، ولماذا تبدو اختياراً مناسباً.",
    outcome: "القيمة ترتفع لأن الرسالة تبرر الشراء بالهوية والاستخدام لا بالخصم فقط.",
    href: "/for-abayas-fashion",
    icon: Store,
  },
  {
    title: "الهدايا والحلويات والقهوة",
    studio: { product: "بوكس ضيافة فاخر يجمع قهوة وحلوى بتغليف جاهز للإهداء", audience: "عملاء يبحثون عن هدية أنيقة أو ضيافة زيارة سريعة", offer: "حجز مسبق لموسم الزيارات والمناسبات", goal: "leads", channel: "whatsapp" },
    problem: "إظهار المنتج وحده لا يكفي لأن الشراء هنا تحركه المناسبة واللحظة الاجتماعية أكثر من الصنف بحد ذاته.",
    output: "الإثبات يربط المحتوى بالإهداء والزيارة والضيافة والإطلاق الموسمي مع CTA أقرب للحجز والطلب.",
    outcome: "يصبح القرار أسرع لأن الصفحة تبيع المناسبة التي سيُطلب المنتج لأجلها.",
    href: "/for-gifts-sweets-coffee",
    icon: Briefcase,
  },
  {
    title: "الفرق والوكالات",
    studio: { product: "خدمة إدارة حملات محتوى لعدة متاجر أو عملاء", audience: "وكالات وفرق تسويق تحتاج تسليم أسرع ومنطق حملة موحد", offer: "جلسة تأهيل لمسار رِفد للأعمال", goal: "winback", channel: "whatsapp" },
    problem: "الاحتياج هنا لا يتوقف عند منشور واحد، بل يحتاج منطق تشغيل يمكن تكراره وتسليمه على أكثر من حساب.",
    output: "الإثبات المؤسسي يوضح متى ينتقل الاستخدام من أداة محتوى فردية إلى مسار أعمال أوضح في التأهيل والتسليم.",
    outcome: "الزائر يعرف هل يكفيه المسار الفردي أم أن القرار الصحيح هو التوجه مباشرة إلى رِفد للأعمال.",
    href: "/business-solutions",
    icon: ShieldCheck,
  },
  {
    title: "الإلكترونيات والإكسسوارات",
    studio: { product: "سماعة لاسلكية ببطارية طويلة وعزل ضوضاء للاستخدام اليومي", audience: "طلاب وموظفون يريدون تركيزاً وتنقلاً أسهل", offer: "عرض محدود مع ضمان واستبدال", goal: "competitive", channel: "tiktok" },
    problem: "المحتوى ينحصر كثيراً في سرد المواصفات بينما العميل يحتاج فهماً أسرع للفائدة والثقة وسبب تفضيل هذا المنتج.",
    output: "الإثبات هنا يحول المزايا التقنية إلى منفعة يومية واضحة ويقترح زاوية مقارنة واستخدام تقرّب القرار الشرائي.",
    outcome: "بدلاً من منشور تقني بارد، يرى العميل لماذا هذا الخيار أنسب له ومتى يجب أن يختاره من بين البدائل.",
    href: "/for-electronics-accessories",
    icon: Compass,
  },
  {
    title: "الأطفال والمواليد",
    studio: { product: "طقم مواليد ناعم وآمن للاستخدام اليومي والإهداء", audience: "أمهات وآباء يبحثون عن راحة الطفل وهدية موثوقة", offer: "خصم على أطقم الهدايا الجاهزة", goal: "upsell", channel: "snapchat" },
    problem: "المحتوى اللطيف بصرياً لا يكفي إذا لم يزرع الطمأنينة والثقة ويشرح الراحة الفعلية للأهل.",
    output: "الإثبات يربط المنتج بالاطمئنان والهدية والتنظيم والراحة اليومية بدل الاكتفاء بصور جميلة أو وصف عام.",
    outcome: "يتحول القرار من إعجاب عاطفي عابر إلى قناعة أوضح بأن المنتج مناسب للاستعمال اليومي أو للإهداء.",
    href: "/for-kids-baby",
    icon: BadgeCheck,
  },
  {
    title: "المنزل والديكور",
    studio: { product: "قطعة ديكور تضيف دفئاً وأناقة لركن القهوة أو غرفة المعيشة", audience: "عملاء يهتمون بتنسيق المنزل والمشاهد الجاهزة للتصوير", offer: "تشكيلة محدودة لموسم التجديد المنزلي", goal: "clearance", channel: "instagram" },
    problem: "عرض القطعة منفصلة يضعف البيع لأن العميل يشتري المشهد النهائي للمكان لا اسم القطعة وحده.",
    output: "الإثبات يبيع الأثر البصري داخل المساحة ويحوّل المنتج إلى جزء من جو منزلي متكامل يمكن تخيله فوراً.",
    outcome: "يزداد وضوح القيمة لأن الرسالة لا تتحدث عن القطعة فقط، بل عن شكل الركن أو الغرفة بعد دخولها.",
    href: "/for-home-decor",
    icon: Store,
  },
];

const objections: Array<{
  title: string;
  proof: string;
  answer: string;
  decisionSignal: string;
  next: string;
  ctaLabel: string;
  href: InternalRoute | "#operational-proof";
}> = [
  {
    title: "هل الناتج مجرد نص عام؟",
    proof: "الإثبات هنا لا يعرض منشوراً معزولاً، بل يربطه بهوك وصورة وفكرة Reel وCTA ضمن نفس الحزمة.",
    answer: "هذا يقلل مشكلة المحتوى العام لأن كل عنصر في الحملة يخدم نفس الدافع البيعي بدلاً من العمل كمخرجات منفصلة.",
    decisionSignal: "إذا لاحظت أن أكبر مشكلتك اليوم هي تكرار نصوص عامة لا تُترجم إلى زاوية بيع واحدة، فهذا الاعتراض محسوم لصالح التجربة.",
    next: "ابدأ التجربة المجانية ثم قارن أول مخرج بما تكتبه عادة بنفسك، لأن الفرق الحقيقي يظهر في ترابط الحزمة لا في طول النص فقط.",
    ctaLabel: "ابدأ التجربة المجانية",
    href: "/onboarding" as const,
  },
  {
    title: "هل يصلح فعلاً للسوق السعودي؟",
    proof: "الأمثلة مبنية على قطاعات محلية وسياقات شراء حقيقية مثل الإهداء والفخامة والاستخدام اليومي والموسمية.",
    answer: "التخصيص هنا ليس شكلياً؛ بل يظهر في نبرة الرسالة، والاعتراضات التي يجري الرد عليها، وطريقة دفع القرار الشرائي.",
    decisionSignal: "إذا كنت لا تريد وعوداً عامة، فالحكم الصحيح هنا يكون من الصفحة القطاعية الأقرب لسوقك لا من الصفحة الرئيسية وحدها.",
    next: "انتقل إلى الصفحة القطاعية الأقرب لمتجرك، لأن الحكم الأدق يكون من منطق سوقك لا من مثال بعيد عنك.",
    ctaLabel: "شاهد المثال القطاعي",
    href: "/for-perfumes-beauty" as const,
  },
  {
    title: "هل يوفّر وقتاً حقيقياً؟",
    proof: "القيمة ليست في السرعة وحدها، بل في اختصار ثلاث حلقات دفعة واحدة: الفكرة، الصياغة، والاتجاه البصري الأول.",
    answer: "حين تبدأ من مخرج مترابط، تقل العودة إلى نقطة الصفر وتصبح دورة تجهيز المحتوى الأسبوعية أخف وأكثر اتساقاً.",
    decisionSignal: "إذا كان عنق الزجاجة عندك هو بدء الحملة كل أسبوع من الصفر، فهنا يظهر الأثر التشغيلي الحقيقي لا مجرد فرق في سرعة الكتابة.",
    next: "راجع طبقة الإثبات التشغيلي بالأسفل لتعرف ما الذي يجب أن تراه فعلياً في أول أسبوع، وكيف تنتقل بعدها إلى الباقة المناسبة.",
    ctaLabel: "تابع إلى الإثبات التشغيلي",
    href: "#operational-proof" as const,
  },
  {
    title: "هل يناسب الفرق والوكالات؟",
    proof: "إذا كان احتياجك يتجاوز متجراً واحداً أو يحتاج تأهيلاً وتسليماً أوضح، فالمسار الفردي وحده لن يغطي هذا العمق.",
    answer: "هنا يظهر رِفد للأعمال كامتداد مؤسسي، لا كنسخة أكبر فقط من نفس التجربة الفردية.",
    decisionSignal: "إذا كان قرارك يتضمن فريقاً أو أكثر من عميل أو أكثر من متجر، فالمقارنة الصحيحة تصبح بين مسارين تشغيليين لا بين باقتين فقط.",
    next: "إذا كنت تدير فريقاً أو عدة حسابات، فالمسار الصحيح هو رِفد للأعمال لأن قرارك تشغيلي قبل أن يكون مجرد قرار تجربة.",
    ctaLabel: "اذهب إلى رِفد للأعمال",
    href: "/business-solutions" as const,
  },
];

const purchaseDecisionChecklist = [
  {
    title: "احسم أولاً: هل تريد إثبات الفكرة أم تشغيلها؟",
    description: "إذا كنت تريد فقط معرفة هل المخرج أوضح من طريقتك الحالية، فالتجربة هي القرار الصحيح. أما إذا اقتنعت بالفعل وتبحث عن روتين أسبوعي مستمر، فانتقل للباقات.",
  },
  {
    title: "ميّز بين احتياج متجر واحد واحتياج فريق",
    description: "كلما دخلت متطلبات تأهيل وتسليم أو تعدد حسابات، خرج القرار من باقة فردية إلى مسار أعمال مؤسسي أوضح.",
  },
  {
    title: "لا تساوِ بين جودة النص وحدها وجودة الحملة",
    description: "معيار الحكم هنا ليس هل المنشور جميل فقط، بل هل خرجت مع زاوية بيع وصورة وReel وCTA تعمل كحزمة قرار واحدة.",
  },
];

const fitGuidance = [
  {
    title: "مناسب لك إذا...",
    points: [
      "تريد بداية حملة أسرع بدل البدء من صفحة فارغة كل مرة.",
      "تحتاج محتوى أوضح لقطاع محدد لا صياغة عامة قابلة للنسخ على أي متجر.",
      "تريد ربط النص والصورة والـ Reel بنفس الزاوية من أول محاولة.",
    ],
  },
  {
    title: "ليس الخيار الأدق الآن إذا...",
    points: [
      "كنت تبحث عن تشغيل مؤسسي كامل قبل اختبار منطق الحملة نفسه.",
      "كنت تتوقع أن يغنيك عن فهم عرضك وموسميتك وجمهورك دون إدخال واضح.",
      "كنت تريد مسار تسليم وتأهيل فرق قبل المرور برِفد للأعمال.",
    ],
  },
];

const subscriptionPaths: Array<{ title: string; description: string; proof: string; href: InternalRoute; label: string }> = [
  {
    title: "ابدأ مجاناً إذا كان هدفك إثبات الفكرة",
    description: "هذا هو المسار الأنسب عندما تريد اختبار منطق رِفد على متجر واحد والتأكد أن المخرج أوضح من طريقتك الحالية قبل أي التزام.",
    proof: "يناسب من يريد الحكم على الترابط بين النص والصورة والزاوية البيعية من أول تجربة.",
    href: "/onboarding",
    label: "اختبره مجاناً أولاً",
  },
  {
    title: "اذهب إلى احترافي إذا كان لديك تشغيل مستمر",
    description: "عندما يصبح المطلوب أسبوعياً ومتكرراً، فالقيمة لا تعود في منشور واحد بل في تحويل الإثبات إلى روتين محتوى مستمر وواضح.",
    proof: "هذا هو الامتداد الطبيعي إذا اقتنعت بالإثبات وتريد استخدامه داخل دورة المحتوى الشهرية لمتجرك.",
    href: "/pricing",
    label: "قارن باقة احترافي",
  },
  {
    title: "اذهب إلى رِفد للأعمال إذا كان القرار مؤسسياً",
    description: "إذا كنت تدير فريقاً أو عدة متاجر أو تحتاج مسار تأهيل وتسليم أوضح، فالمقارنة الصحيحة ليست بين منشور وآخر بل بين نظامي تشغيل.",
    proof: "هنا يصبح رِفد للأعمال هو المسار المنطقي لأن احتياجك تجاوز الاستخدام الفردي فعلاً.",
    href: "/business-solutions",
    label: "انتقل إلى رِفد للأعمال",
  },
];

const proofRoutes = [
  {
    title: "أريد أن أعرف إن كان منطق رِفد يناسب متجري",
    detail: "ابدأ من قبل/بعد ثم انتقل إلى المثال القطاعي الأقرب لك.",
    icon: Compass,
  },
  {
    title: "أريد أن أفهم أين يظهر الأثر داخل التشغيل",
    detail: "اقرأ النتائج التشغيلية ثم عد إلى قرار التجربة أو الباقة.",
    icon: RouteIcon,
  },
  {
    title: "أريد أن أعرف هل أحتاج المسار الفردي أم المؤسسي",
    detail: "استخدم قسم الملاءمة ثم احسم بين رِفد العادي ورِفد للأعمال.",
    icon: Target,
  },
];

const decisionPaths: Array<{ title: string; description: string; href: InternalRoute; label: string }> = [
  {
    title: "عندي متجر وأريد إثباتاً سريعاً",
    description: "ابدأ بالتجربة المجانية ثم ارجع إلى هذه الصفحة إذا أردت مقارنة النتيجة بما رأيته هنا.",
    href: "/onboarding",
    label: "ابدأ التجربة المجانية",
  },
  {
    title: "أريد مثالاً أقرب لقطاعي",
    description: "اختر الصفحة القطاعية الأقرب لتعرف كيف تتغير الرسالة والاعتراضات من سوق إلى آخر.",
    href: "/for-perfumes-beauty",
    label: "شاهد مثالاً قطاعياً",
  },
  {
    title: "أقارن قبل قرار الاشتراك",
    description: "راجع الباقات بعد فهم الإثبات حتى يكون قرارك مبنياً على قيمة واضحة لا على السعر وحده.",
    href: "/pricing",
    label: "قارن الباقات",
  },
  {
    title: "أدير فريقاً أو أكثر من عميل",
    description: "إذا كان قرارك مؤسسياً أو تشغيلياً، اذهب إلى رِفد للأعمال لأن مسارك مختلف عن المتجر الفردي.",
    href: "/business-solutions",
    label: "اذهب إلى رِفد للأعمال",
  },
];

function InternalLink({ href, children }: { href: InternalRoute; children: ReactNode }) {
  return <Link to={href}>{children}</Link>;
}

function isInternalRoute(href: InternalRoute | "#operational-proof"): href is InternalRoute {
  return !href.startsWith("#");
}

export const Route = createFileRoute("/proof-center")({
  head: () => ({
    meta: [
      { title: "Proof Center — مركز إثبات رِفد للمتاجر السعودية" },
      {
        name: "description",
        content:
          "مركز إثبات رِفد: قبل/بعد، أمثلة قطاعية، اعتراضات شراء، ومسارات قرار واضحة توضّح كيف يخدم المتاجر السعودية عملياً.",
      },
      { property: "og:title", content: "Proof Center — مركز إثبات رِفد" },
      {
        property: "og:description",
        content: "شاهد الفرق بين الطلب العام وحزمة تشغيل مترابطة، ثم اختر المسار الأنسب لمتجرك أو فريقك.",
      },
      { name: "twitter:title", content: "Proof Center — مركز إثبات رِفد" },
      { name: "twitter:description", content: "قبل/بعد، أمثلة قطاعية، اعتراضات شراء، ومسارات قرار واضحة." },
    ],
    links: [{ rel: "canonical", href: "https://rifd.site/proof-center" }],
  }),
  component: ProofCenterPage,
});

function ProofCenterPage() {
  return (
    <MarketingLayout>
      <section className="gradient-hero border-b border-border py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
            <BadgeCheck className="h-3.5 w-3.5" />
            مركز الإثبات المعتمد في V8
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-extrabold leading-tight sm:text-5xl">
            لا نكتفي بقول إن رِفد مناسب للسوق السعودي — <span className="text-gradient-primary">نثبت ذلك بالأمثلة.</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            هذه الصفحة ليست معرضاً عاماً؛ بل نظام قرار يوضح كيف ينتقل المتجر من طلب مبسط إلى حزمة تشغيل أقرب للنشر، ثم يوجهك إلى الخطوة الصحيحة التالية.
          </p>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-4 md:grid-cols-3">
            {decisionFramework.map((layer) => (
              <article key={layer.title} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <h2 className="text-base font-extrabold">{layer.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{layer.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {proofRoutes.map((item) => (
              <article key={item.title} className="rounded-xl border border-primary/15 bg-primary/5 p-5 shadow-soft">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background text-primary shadow-soft">
                  <item.icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-base font-extrabold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {beforeAfter.map((column, index) => (
              <article
                key={column.title}
                className={`rounded-2xl border p-6 shadow-elegant ${
                  index === 0 ? "border-border bg-card" : "border-primary/20 bg-secondary/35"
                }`}
              >
                <div className="flex items-center gap-2 text-primary">
                  <MessageSquareQuote className="h-5 w-5" />
                  <h2 className="text-xl font-extrabold">{column.title}</h2>
                </div>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground">
                  {column.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-primary/15 bg-primary/5 p-6 shadow-soft">
            <h2 className="text-xl font-extrabold">ما الذي يثبته هذا القسم فعلياً؟</h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">
              يثبت أن الفارق ليس في تحسين الجمل فقط، بل في نقل المتجر من طلب مبعثر إلى نقطة انطلاق قابلة للنشر: وعد أوضح، زاوية بيع واحدة، واقتراحات بصرية مرتبطة بنفس الهدف.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/30 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              إثبات حسب <span className="text-gradient-primary">القطاع</span> لا بنسخة عامة واحدة
            </h2>
            <p className="mt-3 text-muted-foreground">
              كل قطاع يشتري بطريقة مختلفة، لذلك يجب أن يظهر الإثبات بنفس منطق السوق الذي يخاطبه.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {proofPackets.map((item) => (
              <article key={item.title} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-extrabold">{item.title}</h3>
                <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                  <p><span className="font-bold text-foreground">المشكلة:</span> {item.problem}</p>
                  <p><span className="font-bold text-foreground">المخرج:</span> {item.output}</p>
                  <p><span className="font-bold text-foreground">ما الذي يتغير فعلياً:</span> {item.outcome}</p>
                </div>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <InternalLink href={item.href}>شاهد المثال الأقرب</InternalLink>
                </Button>
                <Button asChild className="mt-2 w-full gradient-primary text-primary-foreground shadow-elegant">
                  <Link to="/dashboard/campaign-studio" search={item.studio}>حوّله إلى حملة جاهزة</Link>
                </Button>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-elegant">
            <div className="flex items-center gap-2 text-primary">
              <Clapperboard className="h-5 w-5" />
              <h2 className="text-2xl font-extrabold">اعتراضات الشراء الأساسية — والرد العملي على كل واحد</h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {objections.map((item) => (
                <article key={item.title} className="rounded-xl border border-border bg-secondary/30 p-4">
                  <h3 className="text-base font-extrabold">{item.title}</h3>
                  <div className="mt-3 rounded-lg border border-border bg-background/80 px-3 py-3 text-sm leading-6 text-muted-foreground">
                    <span className="font-extrabold text-foreground">الإثبات داخل الصفحة:</span> {item.proof}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
                  <div className="mt-3 rounded-lg border border-gold/30 bg-gold/10 px-3 py-3 text-sm leading-6 text-foreground/85">
                    <span className="font-extrabold text-foreground">إشارة القرار:</span> {item.decisionSignal}
                  </div>
                  <div className="mt-3 rounded-lg border border-primary/15 bg-background/80 px-3 py-3 text-sm leading-6 text-foreground/80">
                    <span className="font-extrabold text-primary">الخطوة المنطقية التالية:</span> {item.next}
                  </div>
                  <Button asChild variant="outline" className="mt-4 w-full">
                    {isInternalRoute(item.href) ? (
                      <InternalLink href={item.href}>{item.ctaLabel}</InternalLink>
                    ) : (
                      <a href={item.href}>{item.ctaLabel}</a>
                    )}
                  </Button>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-soft">
            <div className="flex items-center gap-2 text-primary">
              <Target className="h-5 w-5" />
              <h2 className="text-2xl font-extrabold">كيف تحسم قرارك خلال 90 ثانية؟</h2>
            </div>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">
              هذا القسم يختصر جوهر PRF-50: لا نعرض الإثبات فقط، بل نحوّله إلى منطق قرار سريع حتى لا يخرج الزائر مقتنعاً ومعلّقاً بين عدة مسارات.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {purchaseDecisionChecklist.map((item) => (
                <article key={item.title} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                  <h3 className="text-base font-extrabold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>
          </div>

          <ProofCenterOperationalProof />

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {fitGuidance.map((group, index) => (
              <article
                key={group.title}
                className={`rounded-2xl border p-6 shadow-soft ${
                  index === 0 ? "border-primary/20 bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2 text-primary">
                  {index === 0 ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                  <h2 className="text-xl font-extrabold text-foreground">{group.title}</h2>
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                  {group.points.map((point) => (
                    <li key={point}>• {point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-3">
            {subscriptionPaths.map((item) => (
              <article key={item.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="text-lg font-extrabold">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                <div className="mt-4 rounded-lg border border-primary/15 bg-primary/5 px-3 py-3 text-sm leading-6 text-foreground/80">
                  <span className="font-extrabold text-primary">لماذا هذا هو المسار الصحيح:</span> {item.proof}
                </div>
                <Button asChild className="mt-4 w-full" variant="outline">
                  <InternalLink href={item.href}>{item.label}</InternalLink>
                </Button>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-primary/20 bg-secondary/30 p-6 pb-28 shadow-elegant lg:pb-20">
            <h2 className="text-2xl font-extrabold">إذا اقتنعت، ما هو المسار الصحيح بعد هذه الصفحة؟</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              هذه النقطة هي جوهر PRF-50: لا نترك الزائر مقتنعاً فقط، بل نربطه مباشرة بالخطوة التالية المنطقية بحسب حجم احتياجه ونوع قراره.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {decisionPaths.map((item) => (
                <article key={item.title} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-base font-extrabold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  <Button asChild variant="outline" className="mt-4 w-full">
                    <InternalLink href={item.href}>{item.label}</InternalLink>
                  </Button>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="gradient-primary text-primary-foreground shadow-elegant">
              <Link to="/onboarding">
                ابدأ التجربة المجانية
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/for-perfumes-beauty">شاهد صفحة قطاعية كمثال</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/pricing">قارن الباقات</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

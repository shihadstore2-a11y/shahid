type MemoryList = string[] | null | undefined;

export function toCleanList(value: MemoryList): string[] {
  return (value ?? []).map((item) => item.trim()).filter(Boolean);
}

export function joinMemoryList(value: MemoryList, fallback = "غير محدد"): string {
  const list = toCleanList(value);
  return list.length ? list.join("، ") : fallback;
}

export function hasMeaningfulValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function inferTemplateMode(template: string) {
  const t = template.toLowerCase();

  if (t.includes("تيك توك") || t.includes("ريل") || t.includes("فيديو") || t.includes("سناب")) {
    return "video" as const;
  }
  if (t.includes("إعلان") || t.includes("اعلان") || t.includes("ad") || t.includes("meta")) {
    return "ad" as const;
  }
  if (t.includes("وصف") || t.includes("منتج") || t.includes("صفحة")) {
    return "product" as const;
  }
  if (t.includes("إيميل") || t.includes("بريد") || t.includes("email")) {
    return "email" as const;
  }
  if (t.includes("هاشتاق") || t.includes("إنستقرام") || t.includes("انستقرام") || t.includes("كابشن") || t.includes("منشور")) {
    return "social" as const;
  }

  return "general" as const;
}

export function templateOutputRules(template: string): string[] {
  const mode = inferTemplateMode(template);

  switch (mode) {
    case "ad":
      return [
        "قدّم الناتج في صياغة إعلانية جاهزة للنشر لا في شكل شرح.",
        "اجعل الفائدة الأساسية والتميّز البيعي ظاهرين من أول سطر.",
        "اختم بدعوة واضحة لاتخاذ إجراء بصياغة مختصرة ومقنعة.",
      ];
    case "video":
      return [
        "ابنِ الناتج كافتتاحية قوية ثم تسلسل سريع سهل التصوير أو التنفيذ.",
        "اجعل أول سطر Hook حاداً يوقف التمرير فوراً.",
        "اختم بجملة CTA قصيرة قابلة للقراءة على الشاشة أو النطق الصوتي.",
      ];
    case "product":
      return [
        "ركّز على الفوائد العملية والتحويل لا على الوصف الإنشائي فقط.",
        "عالج الاعتراضات المتوقعة مثل الشحن أو الاستبدال أو الملاءمة متى كان ذلك مناسباً.",
        "استخدم نقاط تميز واضحة وقابلة للتصديق بعيداً عن المبالغات العامة.",
      ];
    case "email":
      return [
        "حافظ على افتتاحية واضحة وسهلة الفهم مع قيمة مباشرة من أول سطر.",
        "قسّم الرسالة إلى فقرات قصيرة قابلة للقراءة على الجوال.",
        "اختم بزر أو CTA لفظي واحد وواضح فقط.",
      ];
    case "social":
      return [
        "اجعل الناتج قابلاً للنسخ والنشر فوراً دون شرح إضافي.",
        "ابدأ بهوك سريع ثم انتقل للفائدة ثم CTA.",
        "إن كانت المنصة اجتماعية، استخدم نبرة حيوية ومختصرة وسهلة المشاركة.",
      ];
    default:
      return [
        "قدّم الناتج بصياغة جاهزة للاستخدام مباشرة.",
        "ركّز على الوضوح والإقناع والملاءمة للسوق السعودي.",
      ];
  }
}
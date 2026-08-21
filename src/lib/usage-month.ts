/**
 * يُرجع شهر الاستخدام الحالي بصيغة YYYY-MM وفق توقيت الرياض (Asia/Riyadh, UTC+3).
 * سبب الاستخدام: حصص الاشتراك يجب أن تنعكس على بداية ونهاية الشهر بحسب توقيت
 * المستخدم الفعلي، وليس UTC، حتى لا يحدث فرق 3 ساعات في آخر/أول كل شهر.
 *
 * يُستخدم في كل من العميل والخادم — نفس الدالة بنفس النتيجة لضمان توافق
 * المفتاح المخزّن في usage_logs.month.
 */
export function currentRiyadhMonth(): string {
  // en-CA يعطي تنسيق YYYY-MM-DD مرتب بصرف النظر عن locale المستخدم
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

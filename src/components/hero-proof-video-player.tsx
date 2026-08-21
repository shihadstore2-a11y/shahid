export function HeroProofVideoPlayer() {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-elegant">
      <div className="flex items-center justify-between border-b border-border bg-secondary/45 px-4 py-3">
        <div>
          <div className="text-xs font-bold text-primary">فيديو الإثبات الفعلي</div>
          <div className="mt-1 text-sm font-extrabold">هذا هو المخرج الحيّ لا الوصف النظري</div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-[11px] font-bold text-success">
          <span className="h-2 w-2 rounded-full bg-success" />
          قابل للتشغيل
        </div>
      </div>

      <div className="relative aspect-[4/5] bg-background">
        <video
          className="h-full w-full object-cover"
          src="/rifd-promo.mp4"
          controls
          loop
          muted
          playsInline
          preload="none"
          poster="/og-image.jpg"
          aria-label="فيديو إثبات رِفد الذي يوضح كيف يتحول الوصف إلى حملة مترابطة"
        >
          متصفحك لا يدعم تشغيل الفيديو.
        </video>
      </div>

      <div className="grid gap-3 border-t border-border bg-background/80 px-4 py-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card px-3 py-3">
          <div className="text-[11px] font-bold text-primary">المدخل</div>
          <div className="mt-1 text-sm font-bold text-foreground">وصف متجر + جمهور + زاوية بيع</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-3">
          <div className="text-[11px] font-bold text-primary">المخرج</div>
          <div className="mt-1 text-sm font-bold text-foreground">نص + صورة + فكرة ريلز + CTA</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-3">
          <div className="text-[11px] font-bold text-primary">حالة V8</div>
          <div className="mt-1 text-sm font-bold text-foreground">مرحلة Visual Proof أغلقت فعلياً مع أصل قابل للمشاهدة</div>
        </div>
      </div>
    </div>
  );
}
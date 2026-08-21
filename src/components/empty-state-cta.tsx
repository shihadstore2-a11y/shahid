/**
 * Empty State CTA — مكوّن موحّد للصفحات الفارغة في الداشبورد.
 * يدعم RTL + Dark/Light + Mobile/Tablet/Desktop.
 */
import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  secondary?: ReactNode;
};

export function EmptyStateCTA({ icon: Icon, title, description, ctaLabel, ctaTo, secondary }: Props) {
  return (
    <div
      dir="rtl"
      className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-gradient-to-b from-muted/30 to-background px-6 py-12 text-center sm:py-16"
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-7" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-bold sm:text-xl">{title}</h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <Button asChild size="lg" className="gap-2">
          <Link to={ctaTo as never}>
            {ctaLabel}
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        {secondary}
      </div>
    </div>
  );
}

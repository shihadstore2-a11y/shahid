type RifdLogoProps = {
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  showDescriptor?: boolean;
  size?: "sm" | "md";
};

const SIZE_MAP = {
  sm: {
    wrapper: "gap-2.5",
    iconBox: "h-9 w-9 rounded-xl",
    icon: "h-9 w-9",
    word: "text-lg",
    descriptor: "text-[11px]",
  },
  md: {
    wrapper: "gap-2.5",
    iconBox: "h-10 w-10 rounded-xl sm:h-11 sm:w-11",
    icon: "h-10 w-10 sm:h-11 sm:w-11",
    word: "text-lg sm:text-xl",
    descriptor: "text-xs",
  },
} as const;

export function RifdLogo({
  className = "",
  iconClassName = "",
  labelClassName = "",
  showDescriptor = true,
  size = "md",
}: RifdLogoProps) {
  const styles = SIZE_MAP[size];

  return (
    <span className={`flex min-w-0 items-center font-bold ${styles.wrapper} ${className}`}>
      <span
        className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-primary text-primary-foreground shadow-elegant ring-1 ring-border/40 ${styles.iconBox} ${iconClassName}`}
        aria-hidden
      >
        <span className="pointer-events-none absolute inset-[8%] rounded-[inherit] border border-primary-foreground/10" />
        <svg
          viewBox="0 0 48 48"
          className={styles.icon}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="6" y="6" width="36" height="36" rx="12" fill="currentColor" opacity="0.12" />
          <circle cx="15" cy="24" r="3.6" fill="currentColor" />
          <path
            d="M18.5 24H24.8C28.15 24 30.9 21.25 30.9 17.9V16.7"
            stroke="currentColor"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18.5 24H24.8C28.15 24 30.9 26.75 30.9 30.1V31.3"
            stroke="currentColor"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18.5 24H30.4"
            stroke="currentColor"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="31" y="11" width="6.5" height="6.5" rx="2.15" fill="currentColor" />
          <rect x="31" y="20.75" width="6.5" height="6.5" rx="2.15" fill="#C9A961" />
          <rect x="31" y="30.5" width="6.5" height="6.5" rx="2.15" fill="currentColor" />
        </svg>
      </span>

      <span className={`min-w-0 leading-none ${labelClassName}`}>
        <span className={`block font-extrabold text-foreground ${styles.word}`}>رِفد</span>
        {showDescriptor && (
          <span className={`mt-0.5 block font-semibold tracking-[0.08em] text-muted-foreground/90 ${styles.descriptor}`}>
            للتقنية
          </span>
        )}
      </span>
    </span>
  );
}
import { cn } from "@/lib/utils";

export function BedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* headboard */}
      <rect x="2" y="4" width="4" height="18" rx="1.5" fill="currentColor" />
      {/* pillow */}
      <rect x="7.5" y="9" width="9" height="4.5" rx="1.25" fill="currentColor" opacity="0.55" />
      {/* mattress */}
      <rect x="6" y="14" width="32" height="6" rx="2" fill="currentColor" />
      {/* base line */}
      <rect x="6" y="20.5" width="32" height="2" rx="1" fill="currentColor" opacity="0.45" />
      {/* legs */}
      <rect x="7" y="22.5" width="2.5" height="3.5" rx="0.75" fill="currentColor" />
      <rect x="34.5" y="22.5" width="2.5" height="3.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}

export function Logo({ className, textClassName }: { className?: string; textClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BedIcon className="h-6 w-auto text-primary" />
      <span className={cn("font-display font-bold tracking-tight text-foreground text-lg", textClassName)}>
        SiteStayApp
      </span>
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-display font-bold text-primary",
        className,
      )}
    >
      SS
    </span>
  );
}
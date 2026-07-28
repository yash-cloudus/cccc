import { cn } from "@/lib/utils";

/** Coloured square with the admin's first letter (Design-Spec AvatarInitial). */
export function AvatarInitial({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--brand-tint)] text-[13px] font-extrabold text-[var(--brand)]",
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

import { cn } from "@/lib/utils";

/**
 * A person's photo, or their first letter when there is none.
 *
 * Only the family head is asked for a photo, and only since today — so every
 * screen that shows one also has to render the families that have none. Doing
 * that in one place keeps the queue, the family list and the detail pages from
 * each inventing their own placeholder.
 */
export function PersonAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const base = cn(
    "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-tint)] text-[13px] font-extrabold text-[var(--brand)]",
    className,
  );
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={name} className={cn(base, "object-cover")} />;
  }
  return <span className={base}>{name.trim().charAt(0).toUpperCase() || "?"}</span>;
}

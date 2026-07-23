/** Small color helpers for per-community theming (server-safe, no deps). */

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(n: number): string {
  return clampByte(n).toString(16).padStart(2, "0");
}

/** Shade a hex color. amount < 0 darkens, amount > 0 lightens (range -1..1). */
export function shade(hex: string, amount: number): string {
  const h = (hex || "#000000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const f = (c: number) => (amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  return `#${toHex(f(r))}${toHex(f(g))}${toHex(f(b))}`;
}

/**
 * Build the CSS custom properties that drive both the member site and the
 * community admin panel from a community's brand colors.
 */
export function communityThemeVars(
  primary: string,
  secondary: string,
): Record<string, string> {
  const p = primary || "#a62a38";
  const s = secondary || "#e0a64b";
  return {
    "--samaj-primary": p,
    "--samaj-primary-dark": shade(p, -0.18),
    "--samaj-primary-deep": shade(p, -0.34),
    "--samaj-gold": s,
    "--samaj-gold-light": shade(s, 0.35),
    "--samaj-amber": s,
    "--primary": p,
    "--ring": p,
    "--accent-foreground": p,
  } as Record<string, string>;
}

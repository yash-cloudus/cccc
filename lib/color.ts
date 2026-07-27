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

/** "#a62a38" -> "166 42 56", for `rgb(var(--x) / <alpha>)` composition. */
export function rgbChannels(hex: string): string {
  const h = (hex || "#000000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(" ");
}

/**
 * Build the CSS custom properties that drive the member site, the community
 * admin panel and every brand-tinted surface from a community's two colors.
 *
 * The shade amounts mirror the prototype's `theme.js` palette map 1:1, so a
 * re-themed community lands on the same colors the HTML prototype produces.
 */
export function communityThemeVars(
  primary: string,
  secondary: string,
): Record<string, string> {
  const p = primary || "#a62a38";
  const s = secondary || "#e0a64b";
  return {
    // ── primary ramp ────────────────────────────────────────────────
    "--brand": p,
    "--brand-rgb": rgbChannels(p),
    "--brand-hover": shade(p, -0.12), //  #7e1f2b
    "--brand-dark": shade(p, -0.16), //   #851f2b
    "--brand-deep": shade(p, -0.32), //   #6e1824
    "--brand-light": shade(p, 0.12), //   #c24450
    "--brand-line": shade(p, 0.7), //     #e1bfc3
    "--brand-border": shade(p, 0.72), //  #f0d2d6
    "--brand-tint": shade(p, 0.9), //     #fbebec / #fbedee
    "--brand-tint-soft": shade(p, 0.94), //#fdf4f5

    // ── secondary (gold) ramp ───────────────────────────────────────
    "--gold": s,
    "--gold-dark": shade(s, -0.18), //    #d98a1e
    "--gold-light": shade(s, 0.34), //    #f3d488
    "--gold-border": shade(s, 0.5), //    #eed8a8
    "--gold-tint": shade(s, 0.82), //     #fcefd6

    // ── composed surfaces ───────────────────────────────────────────
    "--brand-gradient": `linear-gradient(160deg, ${p} 0%, ${shade(p, -0.16)} 62%, ${shade(p, -0.32)} 100%)`,
    "--brand-btn-gradient": `linear-gradient(135deg, ${p}, ${shade(p, -0.16)})`,
    "--gold-gradient": `linear-gradient(150deg, ${shade(s, 0.34)}, ${s})`,
    "--gold-icon-gradient": `linear-gradient(150deg, ${s}, ${shade(s, -0.18)})`,

    // ── shadcn bridge (keeps ui/* primitives on-brand) ──────────────
    "--primary": p,
    "--ring": p,
    "--accent": shade(p, 0.9),
    "--accent-foreground": p,

    // ── legacy aliases: pre-existing `--samaj-*` consumers ──────────
    "--samaj-primary": p,
    "--samaj-primary-dark": shade(p, -0.16),
    "--samaj-primary-deep": shade(p, -0.32),
    "--samaj-gold": s,
    "--samaj-gold-light": shade(s, 0.34),
    "--samaj-amber": s,
  } as Record<string, string>;
}

/**
 * Main Admin (platform) scope.
 *
 * `.platform-scope` (app/globals.css) remaps the brand tokens to the indigo
 * platform accent (Design-Spec §7: "Main Admin uses an indigo accent to
 * distinguish platform-level UI"). Shared components rendered inside this
 * layout pick that up automatically — no per-component branching.
 *
 * Community-owned colors shown on this screen (the app cards, the colour
 * picker swatches) come from data via inline styles, so they are unaffected.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <div className="platform-scope min-h-dvh">{children}</div>;
}

"use client";

import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/app-shell";
import { BottomNav } from "@/components/layout/bottom-nav";

/**
 * Standard member screen: sticky header (supplied by the page) → page content
 * → fixed bottom navigation.
 *
 * The page itself scrolls — there is no inner scroll box — so the sticky
 * header and fixed nav behave the way they do on any normal website.
 */
export function AppScreen({
  children,
  showNav = true,
}: {
  children: React.ReactNode;
  showNav?: boolean;
}) {
  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="flex flex-1 flex-col"
      >
        {children}
      </motion.div>

      {/* Spacer so content can scroll clear of the fixed nav. */}
      {showNav && <div className="h-[var(--bottomnav-h)] flex-none" />}
      {showNav && <BottomNav />}
    </AppShell>
  );
}

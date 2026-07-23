"use client";

import { motion } from "framer-motion";
import { PhoneShell } from "@/components/layout/phone-shell";
import { BottomNav } from "@/components/layout/bottom-nav";

export function AppScreen({
  children,
  showNav = true,
  framed = true,
}: {
  children: React.ReactNode;
  showNav?: boolean;
  framed?: boolean;
}) {
  return (
    <PhoneShell framed={framed}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="relative flex min-h-0 flex-1 flex-col"
      >
        <div className="appscroll min-h-0 flex-1 overflow-y-auto bg-[var(--samaj-bg)]">
          {children}
        </div>
        {showNav && <div className="h-[72px]" />}
        {showNav && <BottomNav />}
      </motion.div>
    </PhoneShell>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";

/** Skip the admin chrome on /admin/login so login is full-screen. */
export function AdminShellGate({
  children,
  ...shell
}: React.ComponentProps<typeof AdminShell>) {
  const pathname = usePathname();
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return <>{children}</>;
  }
  return <AdminShell {...shell}>{children}</AdminShell>;
}

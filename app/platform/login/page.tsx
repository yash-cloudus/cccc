"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Loader2 } from "lucide-react";
import { ROOT_DOMAIN } from "@/lib/constants";

export default function PlatformLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/platform-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Login failed");
        return;
      }
      router.push(params.get("next") || "/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#12141A] to-[#22252B] p-4 font-[family-name:var(--font-manrope),sans-serif]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#5865F2] to-[#3D4CE0] text-white">
            <LayoutGrid className="size-5" strokeWidth={2} />
          </span>
          <div>
            <div className="text-[15px] font-extrabold text-[#22252B]">Main Admin</div>
            <div className="text-[11.5px] font-semibold text-[#8E93A0]">{ROOT_DOMAIN}</div>
          </div>
        </div>

        <h1 className="text-xl font-extrabold text-[#22252B]">Sign in</h1>
        <p className="mt-1 text-[13px] text-[#8E93A0]">Platform owner access to manage all communities.</p>

        {error && (
          <div className="mt-4 rounded-[11px] border border-[#F1C4C4] bg-[#FCECEC] px-3.5 py-2.5 text-[13px] font-semibold text-[#B0303A]">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-3.5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#8E93A0]">Username</span>
            <input
              className="mafld"
              value={username}
              autoFocus
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              placeholder="cloudus"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#8E93A0]">Password</span>
            <input
              className="mafld"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#5865F2] to-[#3D4CE0] text-[14px] font-extrabold text-white disabled:opacity-70"
          >
            {loading && <Loader2 className="size-[18px] animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronLeft, Loader2 } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { formatTimeAgo, pickText } from "@/lib/format";
import { cn } from "@/lib/utils";

type NotifRow = {
  id: string;
  isRead: boolean;
  sentAt: string;
  notification: {
    titleEn: string;
    titleGu: string | null;
    bodyEn: string;
    bodyGu: string | null;
    createdAt: string;
    linkUrl: string | null;
  };
};

export default function NotificationsPage() {
  const { lang } = useLang();
  const router = useRouter();
  const title = lang === "gu" ? "સૂચનાઓ" : "Notifications";

  const [rows, setRows] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.get<NotifRow[]>("/api/notifications").then((res) => {
      if (!active) return;
      setLoading(false);
      if (res.ok) {
        setRows(res.data);
        if (res.data.some((r) => !r.isRead)) {
          api.patch("/api/notifications", { all: true });
        }
      } else {
        setError(res.error);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppScreen showNav={false}>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[18px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14">
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
          <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">{title}</div>
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/12">
            <Bell className="h-[21px] w-[21px]" strokeWidth={1.7} />
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-[#A62A38]" />
          </div>
        ) : error ? (
          <p className="py-16 text-center text-[13.5px] text-[#B0303A]">{error}</p>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[#938C80]">
            {lang === "gu" ? "કોઈ સૂચના નથી." : "No notifications yet."}
          </p>
        ) : (
          rows.map((n) => (
            <div
              key={n.id}
              className={cn(
                "samaj-card mb-3 p-4",
                !n.isRead && "border-[#EED8A8] bg-gradient-to-r from-[#FFFBF5] to-white",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#FBEDEE] text-[#A62A38]">
                  <Bell className="h-[18px] w-[18px]" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#2A2320]">
                    {pickText(n.notification.titleGu, n.notification.titleEn, lang)}
                  </div>
                  <div className="mt-1 text-[13px] leading-relaxed text-[#57524A]">
                    {pickText(n.notification.bodyGu, n.notification.bodyEn, lang)}
                  </div>
                  <div className="mt-2 text-[11px] font-medium text-[#938C80]">
                    {formatTimeAgo(n.sentAt || n.notification.createdAt, lang)}
                  </div>
                </div>
                {!n.isRead && <span className="mt-1 h-2 w-2 rounded-full bg-[#A62A38]" />}
              </div>
            </div>
          ))
        )}
      </div>
    </AppScreen>
  );
}

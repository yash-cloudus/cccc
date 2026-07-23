"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, Megaphone } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { useLang } from "@/providers/lang-provider";

export type AdRow = {
  id: string;
  name: string;
  pitch: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  category: string | null;
};

const AD_GRADIENTS = [
  "linear-gradient(120deg,#7A2E5C,#B0417E)",
  "linear-gradient(120deg,#1F4C6B,#3D7BA0)",
  "linear-gradient(120deg,#B15A16,#E09A3A)",
  "linear-gradient(120deg,#4E7A45,#6BA85E)",
  "linear-gradient(120deg,#8E2230,#B24C3B)",
  "linear-gradient(120deg,#6A4E9C,#8E6FC0)",
];

export function AdsClient({ rows }: { rows: AdRow[] }) {
  const { lang } = useLang();
  const router = useRouter();
  const title = lang === "gu" ? "જાહેરાત બેનર" : "Ad banner";

  return (
    <AppScreen showNav={false}>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[18px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
          <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">
            {title}
          </div>
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/12">
            <Megaphone className="h-[21px] w-[21px]" strokeWidth={1.7} />
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[#938C80]">
            {lang === "gu" ? "હાલમાં કોઈ જાહેરાત નથી." : "No ads right now."}
          </p>
        ) : (
          rows.map((ad, i) => {
            const gradient = AD_GRADIENTS[i % AD_GRADIENTS.length];
            const inner = (
              <div
                className="relative mb-3 flex h-[100px] items-center overflow-hidden rounded-[20px] px-5 text-white"
                style={ad.imageUrl ? undefined : { background: gradient }}
              >
                {ad.imageUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ad.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-black/20" />
                  </>
                )}
                <div className="relative min-w-0">
                  <div className="text-lg font-extrabold">{ad.name}</div>
                  {ad.pitch && <div className="mt-1 truncate text-xs opacity-90">{ad.pitch}</div>}
                  {ad.category && (
                    <div className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                      {ad.category}
                    </div>
                  )}
                </div>
              </div>
            );

            return ad.linkUrl ? (
              <a
                key={ad.id}
                href={ad.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                {inner}
              </a>
            ) : (
              <div key={ad.id}>{inner}</div>
            );
          })
        )}
      </div>
    </AppScreen>
  );
}

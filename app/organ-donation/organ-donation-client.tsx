"use client";

import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import type { OrganModuleSettings } from "@/lib/community-settings";
import type { OrganDonorRow, OrganRequestRow } from "@/lib/organ-donation";
import { cn } from "@/lib/utils";
import { DonorListTab } from "./donor-list-tab";
import { MyListTab } from "./my-list-tab";
import { RegisterTab, type FamilyMemberOption } from "./register-tab";

export type { FamilyMemberOption };

type Tab = "list" | "mine" | "register";

/**
 * The Organ Donation service — three options, mirroring the Results screen.
 *
 * 1. Donor list — browse and call, or raise a request
 * 2. My list    — what this household uploaded, plus the requests it must answer
 * 3. Register   — the donation form
 */
export function OrganDonationClient({
  donors,
  myDonors,
  incoming,
  outgoing,
  members,
  settings,
  signedIn,
  viewerUserId,
  viewerFamilyId,
  initialTab,
}: {
  donors: OrganDonorRow[];
  myDonors: OrganDonorRow[];
  incoming: OrganRequestRow[];
  outgoing: OrganRequestRow[];
  members: FamilyMemberOption[];
  settings: OrganModuleSettings;
  signedIn: boolean;
  viewerUserId: string | null;
  viewerFamilyId: string | null;
  initialTab: Tab;
}) {
  const { lang } = useLang();
  const T = (gu: string, en: string) => (lang === "gu" ? gu : en);
  const [tab, setTab] = useState<Tab>(initialTab);

  const pendingCount = incoming.filter((r) => r.status === "PENDING").length;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "list", label: T("દાતા યાદી", "Donors") },
    { key: "mine", label: T("મારી યાદી", "My list"), badge: pendingCount },
    { key: "register", label: T("ફોર્મ ભરો", "Register") },
  ];

  return (
    <AppScreen>
      <BackHeader
        title={T("અંગદાન", "Organ Donation")}
        subtitle={T("જીવન આપવાનું દાન", "The gift of life")}
        right={
          <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-white/14">
            <HeartHandshake className="h-[21px] w-[21px]" strokeWidth={1.7} />
          </div>
        }
      />

      <div className="samaj-header flex-none px-[18px] pb-4">
        <div className="flex gap-1.5 rounded-[14px] bg-white/12 p-1">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setTab(x.key)}
              className={cn(
                "relative flex-1 cursor-pointer rounded-[11px] py-2.5 text-[12.5px] font-bold transition-colors",
                tab === x.key ? "bg-white text-[var(--brand)]" : "text-white/80",
              )}
            >
              {x.label}
              {x.badge ? (
                <span className="absolute top-1 right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-extrabold text-white">
                  {x.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-8">
        {tab === "list" && (
          <DonorListTab
            donors={donors}
            settings={settings}
            signedIn={signedIn}
            viewerUserId={viewerUserId}
            viewerFamilyId={viewerFamilyId}
            lang={lang}
            T={T}
          />
        )}
        {tab === "mine" && (
          <MyListTab
            myDonors={myDonors}
            incoming={incoming}
            outgoing={outgoing}
            lang={lang}
            T={T}
          />
        )}
        {tab === "register" && (
          <RegisterTab
            members={members}
            canAdd={settings.memberAdd}
            signedIn={signedIn}
            lang={lang}
            T={T}
            onDone={() => setTab("mine")}
          />
        )}
      </div>
    </AppScreen>
  );
}

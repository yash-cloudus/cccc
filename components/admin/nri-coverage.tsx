"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { COUNTRIES, flagUrl } from "@/lib/phone";
import { NRI_COUNTRY_TYPE } from "@/lib/nri";
import { api } from "@/lib/http";
import { useAdminT } from "@/lib/i18n/admin-dictionary";
import { cn } from "@/lib/utils";

type Option = { id: string; parentId: string | null; nameEn: string };

/**
 * Every country the app knows, and which cities this community has under each.
 *
 * A coverage view, not an editor: the question it answers is "how much of the
 * world can our people actually pick, and where do they already live?" — which
 * the masters table cannot show, because it only lists countries somebody has
 * added. Countries come from the same fixed list the phone picker uses, so what
 * is shown here is exactly what the registration form offers.
 */
export function NriCoverage() {
  const { t, tf } = useAdminT();
  const [rows, setRows] = useState<Option[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    // One request for countries and cities together: omitting `parentId`
    // returns every row of the type, which is the whole tree.
    void api
      .get<Option[]>(`/api/admin/dropdowns?type=${NRI_COUNTRY_TYPE}`)
      .then((res) => setRows(res.ok ? res.data : []));
  }, []);

  const { citiesByCountry, cityCount } = useMemo(() => {
    const all = rows ?? [];
    const countryById = new Map(all.filter((r) => !r.parentId).map((r) => [r.id, r.nameEn]));
    const map = new Map<string, string[]>();
    let count = 0;
    for (const r of all) {
      if (!r.parentId) continue;
      const country = countryById.get(r.parentId);
      if (!country) continue;
      map.set(country, [...(map.get(country) ?? []), r.nameEn]);
      count += 1;
    }
    return { citiesByCountry: map, cityCount: count };
  }, [rows]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (citiesByCountry.get(c.name) ?? []).some((city) => city.toLowerCase().includes(needle)),
    );
  }, [q, citiesByCountry]);

  if (rows === null) {
    return (
      <div className="mb-4 flex items-center justify-center rounded-2xl border border-[var(--line-admin)] bg-white py-8">
        <Loader2 className="size-5 animate-spin text-[var(--faint)]" />
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-[var(--line-admin)] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-[12.5px] font-bold text-[var(--ink-dim)]">
          {tf("drop.nriCoverage", {
            countries: String(COUNTRIES.length),
            added: String(citiesByCountry.size),
            cities: String(cityCount),
          })}
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("drop.nriCoverageSearch")}
          className="h-[36px] w-full rounded-[10px] border border-[var(--line-admin)] bg-white px-3 text-[12.5px] outline-none sm:w-[220px]"
        />
      </div>

      <div className="max-h-[420px] overflow-y-auto [scrollbar-width:thin]">
        <div className="grid grid-cols-2 gap-1.5 max-md:grid-cols-1 xl:grid-cols-3">
          {list.map((c) => {
            const cities = citiesByCountry.get(c.name) ?? [];
            return (
              <div
                key={c.iso}
                className={cn(
                  "rounded-[11px] border px-2.5 py-2",
                  cities.length
                    ? "border-[var(--brand)]/30 bg-[var(--brand-tint)]"
                    : "border-[var(--line-admin)] bg-[var(--surface-admin)]",
                )}
              >
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={flagUrl(c.iso)}
                    alt=""
                    width={22}
                    height={16}
                    className="h-4 w-[22px] flex-none rounded-[3px] object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[var(--ink)]">
                    {c.name}
                  </span>
                  <span className="flex-none text-[11.5px] font-semibold text-[var(--faint)]">
                    {c.dial}
                  </span>
                </div>
                {cities.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {cities.map((city) => (
                      <span
                        key={city}
                        className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--brand)]"
                      >
                        {city}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {list.length === 0 && (
          <p className="py-6 text-center text-[12.5px] text-[var(--faint)]">
            {t("drop.nriCoverageNone")}
          </p>
        )}
      </div>
    </div>
  );
}

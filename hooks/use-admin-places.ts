"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";

export type NamedPlace = { id: string; nameEn: string; nameGu: string };

/**
 * Places a member can live in — villages for a Gam community, cities for a
 * Parivar one — plus the "add new" that persists one to the matching master
 * list so the next admin picks it instead of retyping it.
 *
 * The optimistic row goes in first and is swapped for the saved one, so the
 * picker never blanks out while the request is in flight.
 */
export function useAdminPlaces(
  communityType: "PARIVAR" | "GAM",
  villages: NamedPlace[],
  cities: NamedPlace[],
  onError?: (message: string) => void,
) {
  const router = useRouter();
  const [extra, setExtra] = useState<NamedPlace[]>([]);
  const base = communityType === "GAM" ? villages : cities;
  const places = useMemo(() => [...base, ...extra], [base, extra]);

  async function addPlace({ nameEn, nameGu }: { nameEn: string; nameGu: string }) {
    if (places.some((p) => p.nameEn.toLowerCase() === nameEn.toLowerCase())) return;
    setExtra((prev) => [...prev, { id: `pending:${nameEn}`, nameEn, nameGu }]);
    const body = { nameEn, nameGu: nameGu || nameEn };
    const res =
      communityType === "GAM"
        ? await api.post<NamedPlace>("/api/admin/villages", body)
        : await api.post<NamedPlace>("/api/admin/dropdowns", { type: "city", ...body });
    if (!res.ok) {
      setExtra((prev) => prev.filter((p) => p.id !== `pending:${nameEn}`));
      onError?.(res.error);
      return;
    }
    setExtra((prev) =>
      prev.map((p) =>
        p.id === `pending:${nameEn}`
          ? { id: res.data.id, nameEn: res.data.nameEn, nameGu: res.data.nameGu ?? "" }
          : p,
      ),
    );
    router.refresh();
  }

  return { places, addPlace };
}

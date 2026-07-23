"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { pickText } from "@/lib/format";

type Category = { id: string; nameEn: string; nameGu: string | null };

export function AddBusinessClient({ categories }: { categories: Category[] }) {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const [form, setForm] = useState({
    name: "",
    categoryId: categories[0]?.id ?? "",
    address: "",
    phone: "",
    website: "",
    description: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (form.name.trim().length < 2 || !form.phone.trim()) {
      setError(T("નામ (ઓછામાં ઓછા 2 અક્ષર) અને ફોન જરૂરી છે", "Name (min 2 chars) and phone are required"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await api.post("/api/businesses", {
      nameEn: form.name.trim(),
      categoryId: form.categoryId || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      website: form.website.trim() || undefined,
      description: form.description.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(T("ધંધો સબમિટ થયો — એડમિન ચકાસશે", "Business submitted — admin will review"));
    router.push("/business");
    router.refresh();
  }

  return (
    <AppScreen showNav={false}>
      <BackHeader title={T("ધંધો ઉમેરો", "Add business")} subtitle={T("ડિરેક્ટરીમાં લિસ્ટ કરો", "List in directory")} />
      <div className="px-4 py-4 pb-8">
        <Field label={T("ધંધાનું નામ", "Business name")}>
          <input className="samaj-fld" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label={T("શ્રેણી", "Category")}>
          {categories.length === 0 ? (
            <div className="rounded-[13px] border border-dashed border-[#E1DACC] bg-[#FCFAF6] px-3.5 py-3 text-[12.5px] text-[#938C80]">
              {T("કોઈ શ્રેણી ઉપલબ્ધ નથી", "No categories available")}
            </div>
          ) : (
            <select
              className="samaj-fld"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickText(c.nameGu, c.nameEn, lang)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={T("સરનામું", "Address")}>
          <input className="samaj-fld" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label={T("ફોન", "Phone")}>
          <input className="samaj-fld" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="numeric" />
        </Field>
        <Field label={T("વેબસાઈટ", "Website")}>
          <input className="samaj-fld" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} inputMode="url" />
        </Field>
        <Field label={T("વિગત", "Description")}>
          <textarea
            className="samaj-fld min-h-[100px] py-3"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        {error && <p className="mb-3 text-[13px] font-semibold text-[#B0303A]">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-extrabold text-white shadow-[0_12px_24px_-10px_rgba(166,42,56,.6)] disabled:opacity-70"
          style={{ background: "linear-gradient(135deg,#A62A38,#851F2B)" }}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : T("સબમિટ કરો", "Submit")}
        </button>
      </div>
    </AppScreen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1 text-xs font-bold text-[#8B8375]">{label}</div>
      {children}
    </div>
  );
}

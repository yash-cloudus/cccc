"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ImagePlus, Loader2, MapPin, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { SpeechInput, SpeechTextarea } from "@/components/ui/speech-input";
import { useLang } from "@/providers/lang-provider";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { api } from "@/lib/http";
import { pickText } from "@/lib/format";
import { cn } from "@/lib/utils";

type Category = { id: string; nameEn: string; nameGu: string | null };

export type MemberOption = {
  id: string;
  name: string;
  nameEn: string;
  mobile: string;
  relation: string;
};

type Form = {
  memberId: string;
  memberName: string;
  memberSub: string;
  nameEn: string;
  nameGu: string;
  categoryId: string;
  estd: string;
  description: string;
  descriptionGu: string;
  address: string;
  addressGu: string;
  mapUrl: string;
  logoUrl: string;
  instagram: string;
  facebook: string;
  youtube: string;
  phone: string;
  whatsapp: string;
  email: string;
};

const blank = (categoryId: string): Form => ({
  memberId: "",
  memberName: "",
  memberSub: "",
  nameEn: "",
  nameGu: "",
  categoryId,
  estd: "",
  description: "",
  descriptionGu: "",
  address: "",
  addressGu: "",
  mapUrl: "",
  logoUrl: "",
  instagram: "",
  facebook: "",
  youtube: "",
  phone: "",
  whatsapp: "",
  email: "",
});

const YEARS = Array.from({ length: 76 }, (_, i) => String(new Date().getFullYear() - i));

export function AddBusinessClient({
  categories,
  members,
  signedIn,
}: {
  categories: Category[];
  members: MemberOption[];
  signedIn: boolean;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const { fromEn, guInput } = useTranslitSync();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const [form, setForm] = useState<Form>(() => blank(categories[0]?.id ?? ""));
  /** Businesses already saved in this sitting — the "બીજો ધંધો ઉમેરો" list. */
  const [added, setAdded] = useState<{ id: string; name: string; category: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const categoryLabel = (id: string) => {
    const c = categories.find((x) => x.id === id);
    return c ? pickText(c.nameGu, c.nameEn, lang) : "";
  };

  /** Saves the current form; returns true so the caller can reset or finish. */
  async function save(): Promise<boolean> {
    if (!form.memberId) {
      toast.error(T("સભ્ય પસંદ કરો", "Pick a member"));
      return false;
    }
    if (form.nameEn.trim().length < 2 || !form.nameGu.trim()) {
      toast.error(T("ધંધાનું નામ બંને ભાષામાં ભરો", "Enter the business name in both languages"));
      return false;
    }
    if (!form.categoryId) {
      toast.error(T("કેટેગરી પસંદ કરો", "Pick a category"));
      return false;
    }
    if (form.address.trim().length < 3 || !form.addressGu.trim()) {
      toast.error(T("સરનામું બંને ભાષામાં ભરો", "Enter the address in both languages"));
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      toast.error(T("સાચો 10-અંકનો મોબાઈલ ભરો", "Enter a valid 10-digit mobile"));
      return false;
    }
    if (form.whatsapp && !/^[6-9]\d{9}$/.test(form.whatsapp)) {
      toast.error(T("સાચો WhatsApp નંબર ભરો", "Enter a valid WhatsApp number"));
      return false;
    }

    setBusy(true);
    const res = await api.post<{ id: string }>("/api/businesses", {
      memberId: form.memberId,
      nameEn: form.nameEn.trim(),
      nameGu: form.nameGu.trim(),
      categoryId: form.categoryId,
      estd: form.estd || undefined,
      description: form.description.trim() || undefined,
      descriptionGu: form.descriptionGu.trim() || undefined,
      address: form.address.trim(),
      addressGu: form.addressGu.trim(),
      mapUrl: form.mapUrl.trim() || undefined,
      logoUrl: form.logoUrl || undefined,
      instagram: form.instagram.trim() || undefined,
      facebook: form.facebook.trim() || undefined,
      youtube: form.youtube.trim() || undefined,
      phone: form.phone,
      whatsapp: form.whatsapp || undefined,
      email: form.email.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.issues?.map((i) => i.message).filter(Boolean).join(" · ") || res.error);
      return false;
    }
    setAdded((prev) => [
      ...prev,
      {
        id: res.data.id,
        name: form.nameGu.trim() || form.nameEn.trim(),
        category: categoryLabel(form.categoryId),
      },
    ]);
    return true;
  }

  async function addAnother() {
    if (await save()) {
      setForm(blank(categories[0]?.id ?? ""));
      toast.success(T("ધંધો ઉમેરાયો — બીજો ભરો", "Business added — fill the next one"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function submit() {
    if (await save()) setDone(true);
  }

  if (!signedIn) {
    return (
      <AppScreen showNav={false}>
        <BackHeader title={T("ધંધો ઉમેરો", "Add business")} />
        <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
          {T("ધંધો ઉમેરવા લોગિન કરો", "Sign in to add a business")}
        </p>
      </AppScreen>
    );
  }

  if (done) {
    return (
      <AppScreen showNav={false}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex size-[92px] items-center justify-center rounded-full border-2 border-[#B7E6C6] bg-[#E4F5E9] text-[var(--success)]">
            <Check className="size-11" strokeWidth={2.2} />
          </div>
          <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-[21px] font-bold text-[var(--ink)]">
            {added.length > 1
              ? T(`${added.length} ધંધા મોકલાયા`, `${added.length} businesses submitted`)
              : T("ધંધો મોકલાયો", "Business submitted")}
          </div>
          <p className="max-w-[280px] text-[13.5px] leading-relaxed text-[var(--faint)]">
            {T(
              "એડમિન ચકાસણી અને મંજૂરી પછી તમારો ધંધો ડિરેક્ટરીમાં દેખાશે.",
              "Your business appears in the directory once an admin approves it.",
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              router.push("/business");
              router.refresh();
            }}
            className="samaj-btn mt-2 px-6 py-3.5 text-[14.5px]"
          >
            {T("ધંધાની ડિરેક્ટરી", "Business directory")}
          </button>
        </div>
      </AppScreen>
    );
  }

  return (
    <AppScreen showNav={false}>
      <BackHeader title={T("ધંધો ઉમેરો", "Add business")} />

      <div className="px-4 py-4 pb-8">
        {added.length > 0 && (
          <div className="mb-4 rounded-[15px] border-[1.5px] border-[#C4E8CF] bg-[#F0FBF3] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold tracking-wide text-[var(--success)]">
              <Check className="size-4" strokeWidth={2.3} />
              {T("ઉમેરાયેલા", "ADDED")} ({added.length})
            </div>
            {added.map((b) => (
              <div
                key={b.id}
                className="mb-1.5 flex items-center gap-2.5 rounded-[11px] border border-[#DCEEE1] bg-white px-2.5 py-2"
              >
                <span className="flex size-8 flex-none items-center justify-center rounded-[9px] bg-[#EAF6EC] text-[14px] font-extrabold text-[var(--success)]">
                  {b.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[var(--ink)]">
                    {b.name}
                  </span>
                  <span className="block text-[11px] text-[var(--faint)]">{b.category}</span>
                </span>
              </div>
            ))}
            <p className="mt-1 text-[11px] leading-relaxed text-[#6E8A73]">
              {T(
                "આ ધંધા મોકલાઈ ગયા છે. નીચે બીજો ધંધો ભરી શકો છો.",
                "These are submitted. You can fill in another below.",
              )}
            </p>
          </div>
        )}

        <MemberPicker
          members={members}
          value={form.memberId}
          label={form.memberName}
          sub={form.memberSub}
          onChange={(m) =>
            setForm((f) => ({
              ...f,
              memberId: m.id,
              memberName: m.name,
              memberSub: [m.relation, m.mobile].filter(Boolean).join(" · "),
              // A business is normally reached on its owner's own number.
              phone: f.phone || m.mobile,
            }))
          }
        />

        <Field label={`${T("ધંધાનું નામ", "Business name")} *`}>
          <Input
            value={form.nameEn}
            placeholder={T("નામ લખો…", "Enter name…")}
            speech
            onChange={(v) => {
              set("nameEn", v);
              fromEn(v, (gu) => set("nameGu", gu));
            }}
          />
        </Field>
        <Field label={`${T("ધંધાનું નામ", "Business name")} (${T("ગુજરાતી", "Gujarati")}) *`}>
          <Input
            value={form.nameGu}
            placeholder={T("ગુજરાતીમાં…", "In Gujarati…")}
            onChange={(v) => {
              set("nameGu", v);
              guInput(v, (gu) => set("nameGu", gu), "gu");
            }}
          />
        </Field>

        <Field label={`${T("કેટેગરી", "Category")} *`}>
          <NativeSelect
            value={form.categoryId}
            onChange={(v) => set("categoryId", v)}
            options={categories.map((c) => ({
              value: c.id,
              label: pickText(c.nameGu, c.nameEn, lang),
            }))}
            placeholder={T("કેટેગરી પસંદ કરો", "Pick a category")}
          />
        </Field>

        <Field label={T("ક્યારથી (સ્થાપના વર્ષ)", "Since (year established)")}>
          <NativeSelect
            value={form.estd}
            onChange={(v) => set("estd", v)}
            options={YEARS.map((y) => ({ value: y, label: y }))}
            placeholder={T("વર્ષ પસંદ કરો", "Pick a year")}
          />
        </Field>

        <Field label={`${T("ધંધાનું વર્ણન", "Description")} (English)`}>
          <Textarea
            value={form.description}
            placeholder={T("ટૂંકમાં લખો…", "Write briefly…")}
            speech
            onChange={(v) => {
              set("description", v);
              fromEn(v, (gu) => set("descriptionGu", gu));
            }}
          />
        </Field>
        <Field label={`${T("ધંધાનું વર્ણન", "Description")} (${T("ગુજરાતી", "Gujarati")})`}>
          <Textarea
            value={form.descriptionGu}
            placeholder={T("ગુજરાતીમાં…", "In Gujarati…")}
            onChange={(v) => {
              set("descriptionGu", v);
              guInput(v, (gu) => set("descriptionGu", gu), "gu");
            }}
          />
        </Field>

        <Field label={`${T("ધંધાનું સરનામું", "Business address")} (English) *`}>
          <Input
            value={form.address}
            placeholder={T("સરનામું લખો…", "Enter address…")}
            speech
            onChange={(v) => {
              set("address", v);
              fromEn(v, (gu) => set("addressGu", gu));
            }}
          />
        </Field>
        <Field
          label={`${T("ધંધાનું સરનામું", "Business address")} (${T("ગુજરાતી", "Gujarati")}) *`}
        >
          <Input
            value={form.addressGu}
            placeholder={T("ગુજરાતીમાં…", "In Gujarati…")}
            onChange={(v) => {
              set("addressGu", v);
              guInput(v, (gu) => set("addressGu", gu), "gu");
            }}
          />
        </Field>

        <Field
          label={T("નકશા પર સ્થળ (ડિરેક્ટરીમાં દેખાશે)", "Map location (shown in the directory)")}
          hint={T(
            "ડિરેક્ટરીમાં ગ્રાહકોને દિશા-નિર્દેશ (Google Map) બતાવવા માટે.",
            "Used to show customers directions in the directory.",
          )}
        >
          <div className="flex items-center gap-2.5 rounded-[13px] border-[1.5px] border-[var(--line-input)] bg-white px-3.5 py-2.5">
            <span className="flex size-[34px] flex-none items-center justify-center rounded-[10px] bg-[#EAF2E8] text-[var(--success)]">
              <MapPin className="size-[19px]" strokeWidth={1.9} />
            </span>
            <input
              value={form.mapUrl}
              onChange={(e) => set("mapUrl", e.target.value)}
              placeholder={T("નકશા પર સ્થળ પસંદ કરો", "Paste the Google Maps link")}
              className="min-w-0 flex-1 border-none bg-transparent text-[14px] font-semibold text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--faint)]"
            />
            <span className="flex-none text-[11px] font-extrabold whitespace-nowrap text-[#3D7BC4]">
              Google Map
            </span>
          </div>
        </Field>

        <Field label={T("ધંધાનો લોગો", "Business logo")}>
          <ImageUpload
            value={form.logoUrl}
            onChange={(url) => set("logoUrl", url)}
            folder="business-logos"
            label={T("લોગો અપલોડ કરો", "Upload logo")}
            hint={T("tap કરીને પસંદ કરો", "tap to choose")}
            onError={(msg) => toast.error(msg)}
          />
        </Field>

        <SectionHeading>{T("સોશિયલ લિંક (વૈકલ્પિક)", "SOCIAL LINKS (OPTIONAL)")}</SectionHeading>
        <Field label="📷 Instagram">
          <Input
            value={form.instagram}
            placeholder="instagram.com/…"
            onChange={(v) => set("instagram", v)}
          />
        </Field>
        <Field label="📘 Facebook">
          <Input
            value={form.facebook}
            placeholder="facebook.com/…"
            onChange={(v) => set("facebook", v)}
          />
        </Field>
        <Field label="▶️ YouTube">
          <Input
            value={form.youtube}
            placeholder="youtube.com/@…"
            onChange={(v) => set("youtube", v)}
          />
        </Field>

        <SectionHeading>{T("સંપર્ક", "CONTACT")}</SectionHeading>
        <Field label="Mobile 1 *">
          <Input
            value={form.phone}
            placeholder="98765 43210"
            numeric
            onChange={(v) => set("phone", v)}
          />
        </Field>
        <Field label={T("WhatsApp નંબર (વૈકલ્પિક)", "WhatsApp number (optional)")}>
          <Input
            value={form.whatsapp}
            placeholder="98765 43210"
            numeric
            onChange={(v) => set("whatsapp", v)}
          />
        </Field>
        <Field label={T("ઈમેલ (વૈકલ્પિક)", "Email (optional)")}>
          <Input value={form.email} placeholder="name@email.com" onChange={(v) => set("email", v)} />
        </Field>

        <button
          type="button"
          onClick={addAnother}
          disabled={busy}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-[15px] border-[1.5px] border-[var(--brand-line)] bg-white py-3.5 text-[14px] font-extrabold text-[var(--brand)] disabled:opacity-60"
        >
          <Plus className="size-[19px]" strokeWidth={2.3} />
          {T("બીજો ધંધો ઉમેરો", "Add another business")}
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="samaj-btn flex w-full items-center justify-center gap-2 py-4 text-[16px] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Check className="size-5" strokeWidth={2.3} />
              {T("ધંધો સબમિટ", "Submit business")}
            </>
          )}
        </button>
      </div>
    </AppScreen>
  );
}

/* ──────────────────────────── member picker ──────────────────────────── */

function MemberPicker({
  members,
  value,
  label,
  sub,
  onChange,
}: {
  members: MemberOption[];
  value: string;
  label: string;
  sub: string;
  onChange: (m: MemberOption) => void;
}) {
  const { lang } = useLang();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) =>
      [m.name, m.nameEn, m.mobile].some((v) => v?.toLowerCase().includes(needle)),
    );
  }, [members, q]);

  return (
    <div className="relative mb-3">
      <div className="mb-1.5 text-[12px] font-bold text-[var(--ink-mid)]">
        {T("સભ્ય પસંદ કરો", "Select member")} *
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-[13px] border-[1.5px] border-[var(--line-input)] bg-white px-3.5 py-3 text-left"
      >
        {value ? (
          <>
            <span className="flex size-9 flex-none items-center justify-center rounded-[11px] bg-[var(--brand-tint)] text-[14px] font-extrabold text-[var(--brand)]">
              {label.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold text-[var(--ink)]">
                {label}
              </span>
              {sub && <span className="block text-[11.5px] text-[var(--faint)]">{sub}</span>}
            </span>
            <ChevronDown className="size-4 flex-none text-[var(--faint)]" />
          </>
        ) : (
          <>
            <Search className="size-[17px] flex-none text-[var(--brand)]" strokeWidth={2.1} />
            <span className="flex-1 text-[14px] text-[var(--faint)]">
              {T("સભ્ય શોધો અને પસંદ કરો", "Search and select a member")}
            </span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-[14px] border border-[var(--line-soft)] bg-white shadow-[0_16px_34px_-10px_rgba(42,35,32,.4)]">
          <div className="flex items-center gap-2 border-b border-[var(--line-soft)] p-2.5">
            <Search className="size-4 flex-none text-[var(--brand)]" strokeWidth={2.1} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={T("નામ થી શોધો…", "Search by name…")}
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none"
            />
            <button type="button" onClick={() => setOpen(false)} className="flex-none">
              <X className="size-4 text-[var(--faint)]" />
            </button>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-2.5 border-b border-[var(--line-soft)] px-3 py-2.5 text-left last:border-b-0"
              >
                <span className="flex size-8 flex-none items-center justify-center rounded-[9px] bg-[var(--brand-tint)] text-[13px] font-extrabold text-[var(--brand)]">
                  {m.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[var(--ink)]">
                    {m.name}
                  </span>
                  <span className="block text-[11px] text-[var(--faint)]">
                    {[m.relation, m.mobile].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
            {results.length === 0 && (
              <p className="p-4 text-center text-[12.5px] text-[var(--faint)]">
                {T("કોઈ સભ્ય મળ્યો નહીં", "No member found")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── field bits ───────────────────────────── */

const FIELD =
  "w-full rounded-[13px] border-[1.5px] border-[var(--line-input)] bg-white px-3.5 py-3 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--faint)]";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-2.5 text-[12px] font-extrabold tracking-wide text-[var(--muted)] uppercase">
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[12px] font-bold text-[var(--ink-mid)]">{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--faint)]">{hint}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  numeric,
  speech,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  numeric?: boolean;
  speech?: boolean;
}) {
  if (speech)
    return (
      <SpeechInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputClassName={FIELD}
      />
    );
  return (
    <input
      value={value}
      placeholder={placeholder}
      inputMode={numeric ? "numeric" : undefined}
      onChange={(e) =>
        onChange(numeric ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value)
      }
      className={FIELD}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  speech,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  speech?: boolean;
}) {
  if (speech)
    return (
      <SpeechTextarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        textareaClassName={cn(FIELD, "min-h-[70px] resize-none leading-relaxed")}
      />
    );
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(FIELD, "min-h-[70px] resize-none leading-relaxed")}
    />
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(FIELD, "font-semibold")}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Dashed upload tile used by the logo field and the banner screens. */
export function ImageUpload({
  value,
  onChange,
  folder,
  label,
  hint,
  onError,
}: {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  label: string;
  hint: string;
  onError: (msg: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    const res = await api.upload<{ url: string }>("/api/upload", body);
    setBusy(false);
    if (!res.ok) return onError(res.error);
    onChange(res.data.url);
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="flex w-full flex-col items-center gap-1 rounded-[15px] border-[1.5px] border-dashed border-[var(--brand-line)] bg-[var(--brand-tint)] px-4 py-6 text-center"
      >
        {busy ? (
          <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="mb-1 h-14 rounded-[10px] object-contain" />
        ) : (
          <ImagePlus className="size-6 text-[var(--brand)]" strokeWidth={1.6} />
        )}
        <span className="text-[13.5px] font-bold text-[var(--brand)]">
          {value ? `${label} ✓` : label}
        </span>
        <span className="text-[11.5px] text-[#C08A8F]">{hint}</span>
      </button>
    </>
  );
}

/**
 * Gujarati ↔ English helpers for community / person names.
 *
 * Strategy (matches MainAdmin.dc.html prototype):
 *  - EN → GU: phonetic transliteration (names), not meaning-translation
 *  - GU → EN: meaning/script conversion via online API, with local reverse-dict fallback
 */

const DICT_EN_GU: Record<string, string> = {
  shree: "શ્રી",
  shri: "શ્રી",
  sri: "શ્રી",
  samaj: "સમાજ",
  samaaj: "સમાજ",
  gam: "ગામ",
  gaam: "ગામ",
  parivar: "પરિવાર",
  patel: "પટેલ",
  saurashtra: "સૌરાષ્ટ્ર",
  "mota zinzuda": "મોટા ઝીંઝુડા",
  mota: "મોટા",
  zinzuda: "ઝીંઝુડા",
  surat: "સુરત",
  ahmedabad: "અમદાવાદ",
  rajkot: "રાજકોટ",
  vadodara: "વડોદરા",
  bhavnagar: "ભાવનગર",
  jamnagar: "જામનગર",
  gujarat: "ગુજરાત",
  india: "ભારત",
  savaliya: "સાવલિયા",
  nasit: "નસીત",
  desai: "દેસાઈ",
  gajera: "ગજેરા",
};

const DICT_GU_EN: Record<string, string> = Object.fromEntries(
  Object.entries(DICT_EN_GU).map(([en, gu]) => [gu, en.replace(/\b\w/g, (c) => c.toUpperCase())]),
);

const CONS: Record<string, string> = {
  chh: "છ",
  ksh: "ક્ષ",
  kh: "ખ",
  gh: "ઘ",
  ch: "ચ",
  jh: "ઝ",
  th: "થ",
  dh: "ધ",
  ph: "ફ",
  bh: "ભ",
  sh: "શ",
  ng: "ંગ",
  k: "ક",
  g: "ગ",
  j: "જ",
  t: "ત",
  d: "દ",
  n: "ન",
  p: "પ",
  f: "ફ",
  b: "બ",
  m: "મ",
  y: "ય",
  r: "ર",
  l: "લ",
  v: "વ",
  w: "વ",
  s: "સ",
  h: "હ",
  z: "ઝ",
  c: "ક",
  q: "ક",
  x: "ક્સ",
};
const CONS_KEYS = Object.keys(CONS).sort((a, b) => b.length - a.length);

const INDEP: Record<string, string> = {
  aa: "આ",
  ai: "ઐ",
  au: "ઔ",
  ee: "ઈ",
  ii: "ઈ",
  oo: "ઊ",
  uu: "ઊ",
  a: "અ",
  i: "ઇ",
  u: "ઉ",
  e: "એ",
  o: "ઓ",
};
const MATRA: Record<string, string> = {
  aa: "ા",
  ai: "ૈ",
  au: "ૌ",
  ee: "ી",
  ii: "ી",
  oo: "ૂ",
  uu: "ૂ",
  a: "",
  i: "િ",
  u: "ુ",
  e: "ે",
  o: "ો",
};
const VOW_KEYS = Object.keys(INDEP).sort((a, b) => b.length - a.length);

function translitWordLocal(raw: string): string {
  const key = raw.toLowerCase();
  if (DICT_EN_GU[key]) return DICT_EN_GU[key];
  let i = 0;
  let out = "";
  while (i < key.length) {
    const c = CONS_KEYS.find((k) => key.startsWith(k, i));
    if (c) {
      i += c.length;
      const v = VOW_KEYS.find((vk) => key.startsWith(vk, i));
      if (v) {
        out += CONS[c] + MATRA[v];
        i += v.length;
      } else {
        out += CONS[c];
      }
      continue;
    }
    const v = VOW_KEYS.find((vk) => key.startsWith(vk, i));
    if (v) {
      out += INDEP[v];
      i += v.length;
      continue;
    }
    out += raw[i] ?? key[i];
    i++;
  }
  return out;
}

/** Offline EN → GU phonetic transliteration (fallback). */
export function translitEnToGuLocal(input: string): string {
  if (!input.trim()) return "";
  return input
    .split(/(\s+)/)
    .map((seg) => (/^\s+$/.test(seg) ? seg : translitWordLocal(seg)))
    .join("");
}

/** Offline GU → EN via dictionary only (unknown words kept). */
export function translitGuToEnLocal(input: string): string {
  if (!input.trim()) return "";
  // Try multi-word dict keys first
  let text = input.trim();
  for (const [gu, en] of Object.entries(DICT_GU_EN).sort((a, b) => b[0].length - a[0].length)) {
    text = text.split(gu).join(en);
  }
  return text;
}

export function hasGujarati(text: string): boolean {
  return /[\u0A80-\u0AFF]/.test(text);
}

export function hasLatin(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

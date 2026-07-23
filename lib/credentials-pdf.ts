/**
 * Minimal PDF builder (Helvetica) — same approach as reference MainAdmin.dc.html.
 * Non-ASCII chars are replaced with "?" so Type1 fonts stay valid.
 */
function escPdf(s: string) {
  return String(s ?? "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function buildCredentialsPdf(
  title: string,
  rows: Array<[string, string]>,
): string {
  let ops = `BT /F1 22 Tf 60 780 Td (${escPdf(title)}) Tj ET\n`;
  ops += `0.35 0.4 0.88 rg 60 766 475 3 re f 0 0 0 rg\n`;
  let y = 720;
  for (const [label, val] of rows) {
    ops += `BT /F2 10 Tf 0.56 0.58 0.63 rg 60 ${y} Td (${escPdf(String(label).toUpperCase())}) Tj ET\n`;
    ops += `BT /F1 15 Tf 0 0 0 rg 60 ${y - 20} Td (${escPdf(val)}) Tj ET\n`;
    y -= 54;
  }
  ops += `BT /F2 9 Tf 0.56 0.58 0.63 rg 60 60 Td (${escPdf(
    "Please keep these credentials safe. Share only with the Community Admin.",
  )}) Tj ET\n`;

  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${ops.length} >>\nstream\n${ops}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

export function downloadCredentialsPdf(
  fileBase: string,
  rows: Array<[string, string]>,
) {
  const pdf = buildCredentialsPdf("Community Admin Credentials", rows);
  const bytes = Uint8Array.from(pdf, (c) => c.charCodeAt(0) & 0xff);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase.replace(/[^\w.-]+/g, "_") || "community"}_admin_credentials.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

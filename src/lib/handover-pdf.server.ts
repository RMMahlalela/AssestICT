import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fontData from "@/assets/handover-font.ttf?inline";
import type { Handover } from "./handover-record";

export async function generateHandoverPdf(h: Handover) {
  if (h.status !== "Approved") throw new Error("Only approved records have signed PDFs.");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const encodedFont = fontData.split(",")[1];
  if (!encodedFont) throw new Error("PDF font unavailable.");
  const font = await doc.embedFont(Uint8Array.from(atob(encodedFont), c => c.charCodeAt(0)), { subset: true });
  doc.setTitle("Approved asset handover");
  let page = doc.addPage([595, 842]);
  let y = 790;
  const textColor = rgb(0.08, 0.12, 0.17);
  const muted = rgb(0.35, 0.4, 0.45);
  const ensure = (height: number) => { if (y - height < 55) { page = doc.addPage([595, 842]); y = 790; } };
  const wrap = (text: string, width: number, size: number) => {
    const lines: string[] = []; let line = "";
    for (const char of text.replace(/\r/g, "")) {
      if (char === "\n" || font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = char === "\n" ? "" : char; }
      else line += char;
    }
    lines.push(line); return lines;
  };
  const text = (value: string, size = 11) => {
    for (const line of wrap(value, 491, size)) { ensure(size + 7); page.drawText(line, { x: 52, y, font, size, color: textColor }); y -= size + 7; }
  };
  text("ASSET HANDOVER", 22); text("Approved · Digital sign-off", 13); y -= 12;
  text(`Record: ${h.id}`, 9);
  text(`Created: ${h.date}`); text(`Approved: ${h.decisionDate}`); y -= 10;
  text(`Handed over by: ${h.from}`); text(`Email: ${h.fromEmail || "Not provided"}`);
  text(`Received and approved by: ${h.to}`); text(`Email: ${h.email}`); y -= 18;
  const columns = [{ x: 52, width: 246 }, { x: 310, width: 132 }, { x: 454, width: 89 }];
  const heading = () => {
    ensure(35);
    ["Asset", "Serial / tag", "Condition"].forEach((v, i) => { const column = columns[i]; if (column) page.drawText(v, { x: column.x, y, font, size: 10, color: muted }); });
    y -= 22;
  };
  heading();
  for (const a of h.assets) {
    const cells = [a.asset, a.serial || "—", a.condition || "—"].map((v, i) => wrap(v, columns[i]?.width ?? 89, 10));
    const height = Math.max(...cells.map(c => c.length)) * 15 + 16;
    if (y - height < 55) { ensure(height); heading(); }
    page.drawLine({ start: { x: 52, y: y + 7 }, end: { x: 543, y: y + 7 }, thickness: 0.5, color: muted });
    cells.forEach((lines, i) => { const column = columns[i]; if (column) lines.forEach((v, row) => page.drawText(v, { x: column.x, y: y - row * 15 - 7, font, size: 10, color: textColor })); });
    y -= height;
  }
  y -= 12;
  if (h.note) { text("Comment", 13); text(h.note); y -= 10; }
  ensure(125); text("Receiver signature", 13);
  const signature = await doc.embedPng(h.receiverSignature);
  const dims = signature.scale(Math.min(300 / signature.width, 85 / signature.height));
  page.drawImage(signature, { x: 52, y: y - dims.height, width: dims.width, height: dims.height });
  doc.getPages().forEach((p, i) => p.drawText(`${i + 1} / ${doc.getPageCount()}`, { x: 510, y: 28, font, size: 9, color: muted }));
  return { filename: `asset-handover-${h.id}.pdf`, base64: await doc.saveAsBase64(), createdAt: h.decisionDate };
}
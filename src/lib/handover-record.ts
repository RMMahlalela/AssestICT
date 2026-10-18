import { z } from "zod";

export type AssetLine = { asset: string; serial: string; condition: string };
export type Handover = {
  id: string; date: string; from: string; fromEmail?: string; to: string; email: string;
  status: "Pending" | "Approved" | "Rejected"; decisionDate: string;
  receiverSignature: string; note: string; assets: AssetLine[];
  pdf?: { filename: string; base64: string; createdAt: string };
};

export const createSchema = z.object({
  from: z.string().trim().min(1).max(100),
  fromEmail: z.string().trim().email().max(255),
  to: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  assets: z.array(z.object({
    asset: z.string().trim().min(1).max(200),
    serial: z.string().trim().max(100),
    condition: z.string().trim().max(50),
  })).min(1).max(50),
});

export function decisionRecord(h: Handover, decision: "Approved" | "Rejected", signature: string, note: string, date: string): Handover {
  if (h.status !== "Pending") throw new Error("This handover already has a decision.");
  if (decision === "Approved" && !signature) throw new Error("Signature required to approve");
  return { ...h, status: decision, decisionDate: date, receiverSignature: decision === "Approved" ? signature : "", note };
}

export function decisionEmail(h: Handover, recordUrl: string) {
  const recipients = [...new Set([h.email, h.fromEmail].filter((email): email is string => !!email))];
  const body = `Asset handover ${h.status.toLowerCase()}\n\nHanded over by: ${h.from}\nReceived by: ${h.to}\nDecision: ${h.status}\nDate: ${h.decisionDate}\n\n${h.assets.map(a => `- ${a.asset} (${a.serial || "No tag"}) — ${a.condition}`).join("\n")}\n${h.note ? `\nComment: ${h.note}\n` : ""}\n${h.status === "Approved" ? "Download the signed PDF record" : "View the rejection record"}:\n${recordUrl}`;
  return `mailto:${recipients.join(",")}?subject=${encodeURIComponent(`Asset handover — ${h.status}`)}&body=${encodeURIComponent(body)}`;
}
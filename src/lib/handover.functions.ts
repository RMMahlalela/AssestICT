import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSchema, decisionRecord, type Handover } from "./handover-record";
import { generateHandoverPdf } from "./handover-pdf.server";
export type { AssetLine, Handover } from "./handover-record";

const DB = "https://assetsict-11527-default-rtdb.firebaseio.com";

async function db(path: string, init?: RequestInit) {
  const res = await fetch(`${DB}/${path}.json`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Firebase request failed [${res.status}]: ${t}`);
    throw new Error(`Database request failed [${res.status}]`);
  }
  return res.json();
}

const sig = z.string().max(300_000).regex(/^data:image\/png;base64,/);

export const createHandover = createServerFn({ method: "POST" })
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const id = crypto.randomUUID();
    const h: Handover = {
      ...data, id, date: new Date().toISOString(), status: "Pending",
      decisionDate: "", receiverSignature: "", note: "",
    };
    await db(`handovers/${id}`, { method: "PUT", body: JSON.stringify(h) });
    return { id };
  });

export const listHandovers = createServerFn({ method: "GET" }).handler(async () => {
  const data = (await db("handovers")) as Record<string, Handover> | null;
  return Object.values(data ?? {}).map(({ pdf: _pdf, ...h }) => h).sort((a, b) => b.date.localeCompare(a.date));
});

export const getHandover = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => (await db(`handovers/${data.id}`)) as Handover | null);

export const decideHandover = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["Approved", "Rejected"]),
    receiverSignature: sig.or(z.literal("")),
    note: z.string().trim().max(500),
  }).parse(d))
  .handler(async ({ data }) => {
    const response = await fetch(`${DB}/handovers/${data.id}.json`, { headers: { "X-Firebase-ETag": "true" } });
    if (!response.ok) throw new Error("Could not read handover.");
    const h = await response.json() as Handover | null;
    if (!h) throw new Error("Handover not found");
    if (h.status !== "Pending") return { status: h.status };
    const finalRecord = decisionRecord(h, data.decision, data.receiverSignature, data.note, new Date().toISOString());
    if (data.decision === "Approved") finalRecord.pdf = await generateHandoverPdf(finalRecord);
    const etag = response.headers.get("etag");
    if (!etag) throw new Error("Could not safely save the decision.");
    const saved = await fetch(`${DB}/handovers/${data.id}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag },
      body: JSON.stringify(finalRecord),
    });
    if (saved.status === 412) throw new Error("Another decision was already saved. Refresh to see it.");
    if (!saved.ok) throw new Error("Could not save the decision and PDF.");
    return { status: data.decision };
  });

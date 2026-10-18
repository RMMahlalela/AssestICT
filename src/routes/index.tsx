import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createHandover, listHandovers } from "@/lib/handover.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";

const listQuery = queryOptions({ queryKey: ["handovers"], queryFn: () => listHandovers() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Asset Handover — Digital Sign-off" },
      { name: "description", content: "Record asset handovers and get receiver approval by email." },
      { property: "og:title", content: "Asset Handover — Digital Sign-off" },
      { property: "og:description", content: "Record asset handovers and get receiver approval by email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  component: Index,
});

const newAsset = () => ({ asset: "", serial: "", condition: "Good" });
const input = "w-full rounded-md border border-input bg-card px-3 py-2 outline-none focus:ring-2 focus:ring-ring";
const badge: Record<string, string> = {
  Pending: "bg-muted text-muted-foreground",
  Approved: "bg-primary text-primary-foreground",
  Rejected: "bg-destructive text-destructive-foreground",
};

function Index() {
  const qc = useQueryClient();
  const { data: list } = useSuspenseQuery(listQuery);
  const [people, setPeople] = useState({ from: "", fromEmail: "", to: "", email: "" });
  const saveHandover = useServerFn(createHandover);
  const [assets, setAssets] = useState([newAsset()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ link: string; mailto: string } | null>(null);

  const setAsset = (i: number, k: string, v: string) =>
    setAssets(assets.map((a, j) => (j === i ? { ...a, [k]: v } : a)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assets.some((a) => !a.asset.trim())) return setError("Every asset needs a name.");
    if (!people.from || !people.to) return setError("Fill in who hands over and who receives.");
    if (!/^\S+@\S+\.\S+$/.test(people.email)) return setError("Enter a valid receiver email.");
    if (!/^\S+@\S+\.\S+$/.test(people.fromEmail)) return setError("Enter a valid email for the person handing over assets.");
    setBusy(true); setError("");
    try {
      const { id } = await saveHandover({ data: { ...people, assets } });
      const link = `${window.location.origin}/approve/${id}`;
      const body = `Hi ${people.to},\n\n${people.from} has handed over the following asset(s) to you:\n${assets
        .map((a) => `- ${a.asset}${a.serial ? ` (#${a.serial})` : ""} — ${a.condition}`).join("\n")}\n\nPlease review and approve or reject here:\n${link}\n`;
      const mailto = `mailto:${people.email}?subject=${encodeURIComponent("Asset handover — please approve")}&body=${encodeURIComponent(body)}`;
      setSent({ link, mailto });
      window.location.href = mailto;
      setPeople({ from: "", fromEmail: "", to: "", email: "" }); setAssets([newAsset()]);
      qc.invalidateQueries({ queryKey: ["handovers"] });
    } catch {
      setError("Could not save. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Asset Handover</h1>
      <p className="text-muted-foreground">Hand over assets, sign, and send to the receiver for approval.</p>

      <form onSubmit={submit} className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-3">
          <p className="text-sm font-semibold">Assets</p>
          {assets.map((a, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1.3fr_1fr_auto]">
              <input className={input} placeholder="Asset name" value={a.asset} onChange={(e) => setAsset(i, "asset", e.target.value)} />
              <input className={input} placeholder="Serial / tag no." value={a.serial} onChange={(e) => setAsset(i, "serial", e.target.value)} />
              <select className={input} value={a.condition} onChange={(e) => setAsset(i, "condition", e.target.value)}>
                <option>New</option><option>Good</option><option>Fair</option><option>Damaged</option>
              </select>
              <button type="button" aria-label="Remove asset" disabled={assets.length === 1}
                className="rounded-md border border-border px-3 text-muted-foreground disabled:opacity-30"
                onClick={() => setAssets(assets.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => setAssets([...assets, newAsset()])}
            className="rounded-md border border-dashed border-primary px-4 py-2 text-sm font-medium text-primary">
            + Add another asset
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {([["from", "Handed over by"], ["fromEmail", "Handover giver email"], ["to", "Received by"], ["email", "Receiver email"]] as const).map(([k, l]) => (
            <label key={k} className="block text-sm font-medium">{l}
              <input required className={input + " mt-1"} type={k === "email" || k === "fromEmail" ? "email" : "text"} value={people[k]}
                onChange={(e) => setPeople({ ...people, [k]: e.target.value })} />
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button disabled={busy}>{busy ? "Saving…" : "Save & send to receiver"}</Button>
        {sent && (
          <div className="rounded-md bg-muted p-3 text-sm">
            Saved. Your email app should open with the message ready.{" "}
            <a className="text-primary underline" href={sent.mailto}>Open email again</a>
            <p className="mt-1 break-all text-muted-foreground">Approval link: {sent.link}</p>
          </div>
        )}
      </form>

      <h2 className="mt-10 text-xl font-semibold">Handover records ({list.length})</h2>
      <div className="mt-3 space-y-3">
        {list.length === 0 && <p className="text-muted-foreground">No handovers yet.</p>}
        {list.map((h) => (
          <Link key={h.id} to="/approve/$id" params={{ id: h.id }}
            className="block rounded-lg border border-border bg-card p-4 hover:border-primary">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{h.assets.map((a) => a.asset).join(", ")}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[h.status]}`}>{h.status}</span>
            </div>
            <p className="text-sm">{h.from} → {h.to} ({h.email})</p>
            <p className="text-sm text-muted-foreground">{new Date(h.date).toLocaleString()}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

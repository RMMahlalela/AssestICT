import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";
import { decideHandover, getHandover } from "@/lib/handover.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Download, Mail } from "lucide-react";
import { decisionEmail } from "@/lib/handover-record";

const q = (id: string) => queryOptions({ queryKey: ["handover", id], queryFn: () => getHandover({ data: { id } }) });

export const Route = createFileRoute("/approve/$id")({
  head: () => ({
    meta: [
      { title: "Approve Asset Handover" },
      { name: "description", content: "Review the assets handed over to you and approve or reject." },
      { property: "og:title", content: "Approve Asset Handover" },
      { property: "og:description", content: "Review the assets handed over to you and approve or reject." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(q(params.id)),
  component: Approve,
});

function Approve() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: h } = useSuspenseQuery(q(id));
  const [sig, setSig] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saveDecision = useServerFn(decideHandover);
  const [pdfUrl, setPdfUrl] = useState("");
  const [mailUrl, setMailUrl] = useState("");
  useEffect(() => {
    if (!h || h.status === "Pending") return;
    setMailUrl(decisionEmail(h, window.location.href));
    if (!h.pdf) return;
    const bytes = Uint8Array.from(atob(h.pdf.base64), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [h]);

  if (!h) return <main className="mx-auto max-w-2xl px-4 py-10"><p>Handover not found.</p></main>;

  const decide = async (decision: "Approved" | "Rejected") => {
    if (decision === "Approved" && !sig) return setError("Please sign to approve.");
    setBusy(true); setError("");
    try {
      await saveDecision({ data: { id, decision, receiverSignature: decision === "Approved" ? sig : "", note } });
      await qc.invalidateQueries();
    } catch { setError("Could not save your decision. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground underline">← All handovers</Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Asset handover</h1>
      <p className="text-muted-foreground">From <b>{h.from}</b> to <b>{h.to}</b> · {new Date(h.date).toLocaleString()}</p>

      <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="pb-2">Asset</th><th>Serial</th><th>Condition</th></tr></thead>
          <tbody>{h.assets.map((a, i) => (
            <tr key={i} className="border-t border-border"><td className="py-2">{a.asset}</td><td>{a.serial || "—"}</td><td>{a.condition}</td></tr>
          ))}</tbody>
        </table>
      </div>

      {h.status === "Pending" ? (
        <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="font-semibold">{h.to}, please confirm you received these assets</p>
          <SignaturePad onChange={setSig} />
          <textarea className="w-full rounded-md border border-input bg-card px-3 py-2" rows={2} maxLength={500}
            placeholder="Comment (optional, e.g. reason for rejecting)" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => decide("Approved")}>{busy ? "Saving…" : "Approve"}</Button>
            <Button variant="destructive" disabled={busy} onClick={() => decide("Rejected")}>Reject</Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <p className="text-lg font-semibold">{h.status} on {new Date(h.decisionDate).toLocaleString()}</p>
          {h.note && <p className="text-muted-foreground">"{h.note}"</p>}
          {h.receiverSignature && <img src={h.receiverSignature} alt="Receiver signature" className="mt-2 h-20 rounded border border-border bg-background" />}
          <div className="mt-4 flex flex-wrap gap-3">
            {pdfUrl && h.pdf && <Button asChild><a href={pdfUrl} download={h.pdf.filename}><Download />Download PDF record</a></Button>}
            {mailUrl && <Button variant="outline" asChild><a href={mailUrl}><Mail />Email decision to {h.fromEmail ? "both parties" : "receiver"}</a></Button>}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{h.pdf ? "Signed PDF saved with this record. " : ""}Email not sent automatically; the email button opens a prepared message.</p>
          {!h.fromEmail && <p className="mt-2 text-sm text-muted-foreground">This older record has no handover giver email address.</p>}
        </div>
      )}
    </main>
  );
}

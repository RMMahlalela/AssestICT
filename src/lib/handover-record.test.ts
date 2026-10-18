import { describe, expect, it } from "vitest";
import { createSchema, decisionEmail, decisionRecord, type Handover } from "./handover-record";

const handover: Handover = { id: "63c48573-2cc5-4552-affa-d44dc6b8b7db", from: "Giver", fromEmail: "giver@example.com", to: "Receiver", email: "receiver@example.com", date: "2026-10-17T09:56:00Z", status: "Pending", decisionDate: "", receiverSignature: "", note: "", assets: [{ asset: "Laptop", serial: "ICT-001", condition: "Good" }] };

describe("Handover decision rules", () => {
  it("requires a valid giver email for new handovers", () => {
    expect(createSchema.safeParse({ ...handover, fromEmail: "" }).success).toBe(false);
    expect(createSchema.safeParse(handover).success).toBe(true);
  });
  it("requires the receiver signature for approval", () => {
    expect(() => decisionRecord(handover, "Approved", "", "", handover.date)).toThrow("Signature required");
  });
  it("keeps receiver signature and approval date in the final record", () => {
    const approved = decisionRecord(handover, "Approved", "signature", "Received", "2026-10-18T10:00:00Z");
    expect(approved.status).toBe("Approved");
    expect(approved.receiverSignature).toBe("signature");
    expect(approved.decisionDate).toBe("2026-10-18T10:00:00Z");
    expect(() => decisionRecord(approved, "Rejected", "", "", handover.date)).toThrow();
  });
  it("records rejection without an approval signature", () => {
    const rejected = decisionRecord(handover, "Rejected", "unused", "Wrong asset", handover.date);
    expect(rejected.status).toBe("Rejected");
    expect(rejected.receiverSignature).toBe("");
    expect(rejected.note).toBe("Wrong asset");
    expect(rejected.pdf).toBeUndefined();
  });
  it.each(["Approved", "Rejected"] as const)("addresses %s notices to both parties", status => {
    const message = decisionEmail({ ...handover, status }, "https://example.com/approve/record");
    expect(message.split("?")[0]).toBe("mailto:receiver@example.com,giver@example.com");
    expect(decodeURIComponent(message)).toContain("https://example.com/approve/record");
  });
});
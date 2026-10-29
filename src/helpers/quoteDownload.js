// The quote file for a job, as the customer received it: the PDF of the
// version on its accepted proposal, else on the latest proposal sent, else
// the newest saved version. Drawn from the version's snapshot, as the
// proposal screen draws it (helpers/invoice.js).

import { listQuoteVersions } from "@/services/api/leadsApi";
import { listProposals } from "@/services/api/proposalsApi";
import { downloadInvoice } from "@/helpers/invoice";

const newest = (a, b) => new Date(b.sentAt ?? b.createdAt ?? 0) - new Date(a.sentAt ?? a.createdAt ?? 0);

/** Resolves false when the job has no saved quote to download. */
export async function downloadJobQuote(opportunityId, unit) {
  const [proposals, versions] = await Promise.all([listProposals(opportunityId), listQuoteVersions(opportunityId)]);
  const sent = [...(proposals ?? [])].sort(newest);
  const proposal = sent.find((entry) => entry.status === "accepted") ?? sent[0] ?? null;
  const saved = (versions ?? []).filter((version) => version.snapshot);
  const version = (proposal && saved.find((entry) => entry.id === proposal.quoteVersion?.id)) ?? [...saved].sort(newest)[0] ?? null;
  if (!version) return false;
  await downloadInvoice({ unit, version });
  return true;
}

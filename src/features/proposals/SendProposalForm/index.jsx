// Prepare the proposal email: which saved quote version, to whom, the subject
// and the message. "Open in email app" creates the customer's link and opens
// the email app signed in on this device with the email written (greeting,
// message, link, sign-off); "Open in Gmail" does the same in Gmail. The PDF
// downloads alongside for them to attach. The customer's page shows the same
// PDF and lets them accept, ask for changes or decline.
//
// The Gmail tab is opened straight from the click, before the link exists —
// a tab opened after waiting on the server would be blocked as a popup — and
// pointed at Gmail once the link comes back (see ProposalWorkflow). The email
// app needs no tab: a mail link does not leave the page.

import { useEffect, useMemo, useState } from "react";
import { Eye, Mail } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import LoadingState from "@/components/LoadingState";
import Modal from "@/components/Modal";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { invoicePreviewUrl } from "@/helpers/invoice";
import { DEFAULT_MESSAGE, openPendingTab } from "@/helpers/proposals";
import { getErrorMessage } from "@/services/api/client";
import { sendProposal } from "@/services/api/proposalsApi";
import { formatCurrency } from "@/utils/formatCurrency";
import { isEmail } from "@/utils/validators";

function PreviewModal({ version, unit, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let created = null;
    invoicePreviewUrl({ unit, version })
      .then((next) => {
        created = next;
        if (cancelled) URL.revokeObjectURL(next);
        else setUrl(next);
      })
      .catch(() => !cancelled && setError("Could not build the quote PDF."));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
    // Built once per open — the modal is remounted for each preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal confirmClose={false} title={`What the customer will see — v${version.version}`} className="document" onClose={onClose}>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!url && !error ? <LoadingState label="Building the PDF…" /> : null}
      {url ? <iframe className="invoice-frame" src={url} title="Proposal preview" /> : null}
    </Modal>
  );
}

const versionLabel = (version, sentAs) =>
  [
    `v${version.version}`,
    version.quoteNumber,
    version.grandTotal !== null && version.grandTotal !== undefined ? formatCurrency(version.grandTotal, { withCents: true }) : null,
    `saved ${formatDate(version.createdAt)}`,
    sentAs ? `sent as ${sentAs}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

export default function SendProposalForm({ opportunity, versions, proposals = [], unit, onSent, onCancel }) {
  const [form, setForm] = useState(() => ({
    quoteVersionId: versions[0]?.id ?? "",
    to: opportunity.customerEmail || "",
    subject: "",
    message: DEFAULT_MESSAGE,
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null); // "mail" | "gmail" while preparing
  const [failure, setFailure] = useState("");
  const [preview, setPreview] = useState(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  // Which proposals already went out on each version, so a resend of the same numbers is obvious.
  const sentAs = useMemo(() => {
    const map = new Map();
    for (const proposal of proposals) {
      const id = proposal.quoteVersion?.id;
      if (id) map.set(id, [...(map.get(id) ?? []), `P${proposal.version}`]);
    }
    return map;
  }, [proposals]);

  const selected = versions.find((version) => String(version.id) === String(form.quoteVersionId)) ?? null;
  const defaultSubject = `Your proposal ${selected?.quoteNumber || opportunity.number} from ${unit?.name || "Prestige"}`;

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!selected) next.quoteVersionId = "Pick the quote version to send.";
    if (!form.to.trim()) next.to = "Enter the customer's email address.";
    else if (!isEmail(form.to.trim())) next.to = "Enter a single valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;

    // Enter in a field submits with the first button: the email app.
    const via = event.nativeEvent.submitter?.value === "gmail" ? "gmail" : "mail";
    const tab = via === "gmail" ? openPendingTab() : null;
    setBusy(via);
    setFailure("");
    try {
      const result = await sendProposal(opportunity.id, {
        quoteVersionId: selected.id,
        to: form.to.trim(),
        subject: form.subject.trim() || undefined,
        message: form.message.trim() || undefined,
      });
      onSent?.(result, { via, tab });
    } catch (err) {
      tab?.close();
      setFailure(getErrorMessage(err, "The proposal could not be prepared."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field className="span-2" label="Quote to send" error={errors.quoteVersionId} htmlFor="sp-version">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select id="sp-version" style={{ flex: 1, minWidth: 220 }} value={form.quoteVersionId} onChange={(e) => set("quoteVersionId", e.target.value)}>
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {versionLabel(version, sentAs.get(version.id)?.join(", "))}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!selected?.snapshot} onClick={() => setPreview(selected)}>
              <Eye size={14} /> Preview PDF
            </button>
          </div>
        </Field>
        <Field className="span-2" label="Customer email" error={errors.to} htmlFor="sp-to">
          <input id="sp-to" type="email" value={form.to} maxLength={254} placeholder="customer@example.com" onChange={(e) => set("to", e.target.value)} />
        </Field>
        <Field className="span-2" label="Subject" hint="optional" htmlFor="sp-subject">
          <input id="sp-subject" value={form.subject} maxLength={200} placeholder={defaultSubject} onChange={(e) => set("subject", e.target.value)} />
        </Field>
        <Field className="span-2" label="Message" hint="the email adds the greeting, the proposal link and your name" htmlFor="sp-message">
          <textarea id="sp-message" rows={6} maxLength={5000} value={form.message} onChange={(e) => set("message", e.target.value)} />
        </Field>
      </div>

      {failure ? (
        <Alert tone="danger" style={{ marginTop: 12 }}>
          {failure}
        </Alert>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button type="submit" value="mail" className="btn btn-primary btn-sm" disabled={Boolean(busy)} title="Opens the email app signed in on this device, e.g. Outlook">
          <Mail size={14} /> {busy === "mail" ? "Preparing…" : "Open in email app"}
        </button>
        <button type="submit" value="gmail" className="btn btn-ghost btn-sm" disabled={Boolean(busy)} title="Opens Gmail in a new tab, signed in as your Google account">
          <Mail size={14} /> {busy === "gmail" ? "Preparing…" : "Open in Gmail"}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={Boolean(busy)}>
            Cancel
          </button>
        ) : null}
      </div>

      {preview ? <PreviewModal version={preview} unit={unit} onClose={() => setPreview(null)} /> : null}
    </form>
  );
}

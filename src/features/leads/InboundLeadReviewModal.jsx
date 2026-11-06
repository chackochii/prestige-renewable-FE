// Reviewing one inbox lead: everything the form captured, the attribution,
// whether it looks like somebody already in the system — then Convert (a
// stage-1 lead, opened at once), Reject (with a reason) or, for a rejected
// lead, Reopen. A Meta lead whose answers could not be fetched offers Refresh.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Modal from "@/components/Modal";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import LoadingState from "@/components/LoadingState";
import { PERMISSIONS } from "@/constants/permissions";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { getErrorMessage } from "@/services/api/client";
import {
  convertInboundLead,
  getInboundLead,
  refreshInboundLead,
  rejectInboundLead,
  reopenInboundLead,
} from "@/services/api/inboundLeadsApi";

const STATUS_TONE = {
  pending: "warning",
  converted: "success",
  rejected: "neutral",
};

function Row({ label, value }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {value || <span className="hint">—</span>}
      </div>
    </div>
  );
}

export default function InboundLeadReviewModal({ leadId, onClose, onChanged }) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { notify } = useNotifications();
  const [lead, setLead] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const canConvert = hasPermission(PERMISSIONS.LEADS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.LEADS_UPDATE);

  useEffect(() => {
    let alive = true;
    setLead(null);
    setError("");
    getInboundLead(leadId)
      .then((data) => alive && setLead(data))
      .catch(
        (err) =>
          alive && setError(getErrorMessage(err, "Could not load the lead.")),
      );
    return () => {
      alive = false;
    };
  }, [leadId]);

  const run = async (what, action, done) => {
    setBusy(what);
    setError("");
    try {
      const result = await action();
      onChanged?.();
      done?.(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  const convert = () =>
    run(
      "convert",
      () => convertInboundLead(lead.id),
      ({ opportunity }) => {
        notify(
          `${opportunity.number} created from the ${lead.sourceLabel} lead`,
        );
        onClose();
        navigate(`/opportunities/${opportunity.id}`);
      },
    );

  const reject = () =>
    run(
      "reject",
      () => rejectInboundLead(lead.id, { reason: reason.trim() || undefined }),
      (updated) => {
        notify("Lead rejected", "info");
        setLead((current) => ({ ...current, ...updated }));
        setRejecting(false);
      },
    );

  const reopen = () =>
    run(
      "reopen",
      () => reopenInboundLead(lead.id),
      (updated) => {
        notify("Lead back in the queue");
        setLead((current) => ({ ...current, ...updated }));
      },
    );

  const refresh = () =>
    run(
      "refresh",
      () => refreshInboundLead(lead.id),
      (updated) => {
        notify("Answers fetched from Meta");
        setLead((current) => ({ ...current, ...updated }));
      },
    );

  const pending = lead?.status === "pending";
  const needsFetch =
    Boolean(lead?.fetchError) && !lead?.name && !lead?.email && !lead?.phone;

  const actions = lead ? (
    <>
      <button type="button" className="btn btn-ghost" onClick={onClose}>
        Close
      </button>
      {lead.status === "converted" && lead.opportunityId ? (
        <Link
          className="btn btn-primary"
          to={`/opportunities/${lead.opportunityId}`}
          onClick={onClose}
        >
          Open {lead.opportunity?.number || "job"}
        </Link>
      ) : null}
      {lead.status === "rejected" && canUpdate ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={reopen}
          disabled={Boolean(busy)}
        >
          {busy === "reopen" ? "Reopening…" : "Reopen"}
        </button>
      ) : null}
      {pending && lead.source === "meta_ads" && lead.fetchError && canUpdate ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={refresh}
          disabled={Boolean(busy)}
        >
          {busy === "refresh" ? "Fetching…" : "Fetch answers again"}
        </button>
      ) : null}
      {pending && canUpdate && !rejecting ? (
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setRejecting(true)}
          disabled={Boolean(busy)}
        >
          Reject
        </button>
      ) : null}
      {pending && canUpdate && rejecting ? (
        <button
          type="button"
          className="btn btn-danger"
          onClick={reject}
          disabled={Boolean(busy)}
        >
          {busy === "reject" ? "Rejecting…" : "Confirm reject"}
        </button>
      ) : null}
      {pending && canConvert ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={convert}
          disabled={Boolean(busy) || needsFetch}
          title={needsFetch ? "Fetch the answers first" : undefined}
        >
          {busy === "convert" ? "Creating lead…" : "Convert to lead"}
        </button>
      ) : null}
    </>
  ) : (
    <button type="button" className="btn btn-ghost" onClick={onClose}>
      Close
    </button>
  );

  return (
    <Modal
      className="wide"
      title={lead ? lead.displayName : "Lead"}
      body={
        lead
          ? `${lead.sourceLabel} · received ${formatDate(lead.receivedAt, { withTime: true })}`
          : null
      }
      onClose={onClose}
      confirmClose={false}
      actions={actions}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!lead && !error ? <LoadingState label="Loading lead…" /> : null}
      {lead ? (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <Badge tone={STATUS_TONE[lead.status] || "neutral"}>
              {lead.status}
            </Badge>
            {lead.isTest ? <Badge tone="info">Test lead</Badge> : null}
            {lead.duplicateOf ? (
              <Badge tone="warning">Matches earlier lead</Badge>
            ) : null}
            {lead.fetchError ? (
              <Badge tone="danger">Answers not fetched</Badge>
            ) : null}
          </div>

          {lead.fetchError ? (
            <Alert tone="warning" style={{ marginBottom: 16 }}>
              Meta sent this lead but its answers could not be fetched:{" "}
              {lead.fetchError}. Check the connection&apos;s Page access token,
              then fetch again.
            </Alert>
          ) : null}

          {lead.duplicateOf ? (
            <Alert tone="warning" style={{ marginBottom: 16 }}>
              Same email or phone as an earlier inbox lead (
              {lead.duplicateOf.displayName}, {lead.duplicateOf.status}
              {lead.duplicateOf.receivedAt
                ? `, received ${formatDate(lead.duplicateOf.receivedAt)}`
                : ""}
              ). It can still be converted.
            </Alert>
          ) : null}

          {lead.matches?.length ? (
            <Alert tone="info" style={{ marginBottom: 16 }}>
              Already in the system with this contact:{" "}
              {lead.matches.map((m, i) => (
                <span key={m.id}>
                  {i ? ", " : ""}
                  <Link to={`/opportunities/${m.id}`} onClick={onClose}>
                    {m.number}
                  </Link>{" "}
                  ({m.customerLegalName || "unnamed"}, stage {m.stage},{" "}
                  {m.lifecycle.toLowerCase()})
                </span>
              ))}
            </Alert>
          ) : null}

          {lead.status === "rejected" ? (
            <Alert tone="info" style={{ marginBottom: 16 }}>
              Rejected{lead.reviewedByName ? ` by ${lead.reviewedByName}` : ""}
              {lead.reviewedAt
                ? ` on ${formatDate(lead.reviewedAt, { withTime: true })}`
                : ""}
              {lead.rejectReason ? `: ${lead.rejectReason}` : "."}
            </Alert>
          ) : null}

          <div className="form-grid">
            <Row label="Name" value={lead.name} />
            <Row label="Company" value={lead.company} />
            <Row label="Email" value={lead.email} />
            <Row label="Phone" value={lead.phone} />
            <Row label="Street" value={lead.street} />
            <Row
              label="Suburb / state / postcode"
              value={[lead.suburb, lead.state, lead.postcode]
                .filter(Boolean)
                .join(" ")}
            />
            <Row
              label="Campaign"
              value={
                lead.campaignName ||
                (lead.campaignId ? `#${lead.campaignId}` : "")
              }
            />
            <Row
              label="Ad group / ad"
              value={[
                lead.adGroupName || lead.adGroupId,
                lead.adName || lead.adId,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            <Row
              label="Form"
              value={lead.formName || (lead.formId ? `#${lead.formId}` : "")}
            />
            <Row label="Connection" value={lead.connectionName} />
            <div className="field span-2">
              <label>Message and other answers</label>
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {lead.message || <span className="hint">—</span>}
              </div>
            </div>
          </div>

          {pending && rejecting ? (
            <Field
              label="Reason for rejecting"
              hint="optional, kept with the lead"
              className="span-2"
            >
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
            </Field>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}

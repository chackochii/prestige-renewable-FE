// Job history: the record's own timestamps merged with manually added entries.

import { useEffect, useState } from "react";
import { Clock, MessageSquarePlus } from "lucide-react";
import LoadingState from "@/components/LoadingState";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { stageById } from "@/constants/stages";
import { useAppDispatch, useAppSelector } from "@/store";
import { addOpportunityHistoryEntry, fetchOpportunityHistory } from "@/slices/leadsSlice";
import { useNotifications } from "@/hooks/useNotifications";

export default function HistoryTab({ opp, timeZone, canEdit = false }) {
  const dispatch = useAppDispatch();
  const { error: notifyError } = useNotifications();
  const { history, historyStatus } = useAppSelector((s) => s.leads);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opp?.id) dispatch(fetchOpportunityHistory(opp.id));
  }, [opp?.id, dispatch]);

  if (!opp) return null;

  const systemEvents = [
    opp.closedAt && { at: opp.closedAt, action: "Closed", detail: `Lifecycle ${opp.lifecycle}`, kind: "system" },
    opp.slaStartedAt && {
      at: opp.slaStartedAt,
      action: `Entered ${stageById(opp.stage).label}`,
      detail: opp.slaDueAt ? `SLA due ${formatDate(opp.slaDueAt, { timeZone })}` : "No SLA set",
      kind: "system",
    },
    opp.updatedAt && { at: opp.updatedAt, action: "Last updated", detail: "", kind: "system" },
    opp.createdAt && {
      at: opp.createdAt,
      action: "Created",
      detail: opp.leadOwner?.name ? `Lead owner ${opp.leadOwner.name}` : "",
      kind: "system",
    },
  ].filter(Boolean);

  const entryEvents = history.map((h) => ({
    at: h.createdAt,
    action: h.authorName ? `Note by ${h.authorName}` : "Note added",
    detail: h.note,
    kind: "entry",
  }));

  const events = [...systemEvents, ...entryEvents].sort((a, b) => new Date(b.at) - new Date(a.at));

  const submit = async (e) => {
    e.preventDefault();
    const text = note.trim();
    if (!text) return;
    setSaving(true);
    try {
      await dispatch(addOpportunityHistoryEntry({ id: opp.id, body: { note: text } })).unwrap();
      setNote("");
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not add the entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card card-pad">
      {canEdit ? (
        <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16 }}>
          <div className="field" style={{ flex: 1 }}>
            <textarea
              rows={2}
              placeholder="Add to the job history…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !note.trim()}>
            <MessageSquarePlus size={14} /> Add
          </button>
        </form>
      ) : null}

      {historyStatus === "loading" && history.length === 0 ? <LoadingState label="Loading history…" /> : null}

      {events.map((e, i) => (
        <div key={`${e.kind}-${e.action}-${i}`} className="list-row">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span className={`status-icon ${e.kind === "entry" ? "current" : "pending"}`}>
              <Clock size={16} />
            </span>
            <div>
              <div className="row-title">{e.action}</div>
              {e.detail ? <div className="row-meta">{e.detail}</div> : null}
            </div>
          </div>
          <div className="row-meta">{formatDate(e.at, { withTime: true, timeZone })}</div>
        </div>
      ))}
    </div>
  );
}

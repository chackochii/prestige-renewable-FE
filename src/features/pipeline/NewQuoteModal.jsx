// Quotes → New quote: pick a lead and open its quote. Only leads that have
// completed the Leads stage and are in Estimation are offered - a lead still
// at Leads is not ready to quote, and from Proposal on a job's quote is
// already on the Quotes list. Each says whether its electricity bill is uploaded; one
// without is asked for the bill before the quote opens (LeadQuotePage).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "@/components/Modal";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import OppCell from "@/components/OppCell";
import Badge from "@/components/Badge";
import { stageById } from "@/constants/stages";
import { listOpportunities } from "@/services/api/leadsApi";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/** The one stage a lead can be quoted from here: Estimation (the Leads stage completed). */
const QUOTABLE_STAGE = 2;

export default function NewQuoteModal({ onClose }) {
  const navigate = useNavigate();
  const { unitId } = useBusinessUnit();
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim(), 300);
  const [state, setState] = useState({ key: null, rows: [], withBill: new Set(), error: "" });
  const key = JSON.stringify([unitId, term]);

  useEffect(() => {
    if (!unitId) return undefined;
    let alive = true;
    const params = {
      businessUnitId: unitId,
      stage: QUOTABLE_STAGE,
      lifecycle: "Active",
      pageSize: 50,
      ...(term ? { search: term } : {}),
    };
    // The leads, and which of them have a bill uploaded (the same list narrowed with hasBill).
    Promise.all([listOpportunities(params), listOpportunities({ ...params, hasBill: 1 }).catch(() => null)])
      .then(
        ([all, billed]) =>
          alive &&
          setState({
            key,
            rows: all.items,
            // A label only: the lead page checks the bills itself and asks for one when there is none.
            withBill: new Set(billed ? billed.items.map((o) => o.id) : []),
            error: "",
          }),
      )
      .catch((err) => alive && setState({ key, rows: [], withBill: new Set(), error: err?.message || "Could not load the leads." }));
    return () => {
      alive = false;
    };
  }, [key, unitId, term]);

  const loading = state.key !== key;
  const rows = state.rows;

  return (
    <Modal
      className="wide"
      title="New quote"
      body="Choose a lead that has completed the Leads stage (now in Estimation). Its quote opens, ready to size from the electricity bill - a lead without one asks you to upload it first."
      confirmClose={false}
      onClose={onClose}
      actions={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      }
    >
      <input
        className="search"
        style={{ maxWidth: "none", width: "100%", marginBottom: 12 }}
        placeholder="Search name, number, email or phone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search leads"
        autoFocus
      />
      {loading ? (
        <LoadingState label="Loading leads…" />
      ) : state.error ? (
        <EmptyState title="Could not load the leads" body={state.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No leads to quote"
          body={
            term
              ? "No lead in Estimation matches that search."
              : "No lead is in Estimation yet. A lead can be quoted once the Leads stage is completed and it moves to Estimation."
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table clickable stack">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Stage</th>
                <th>Electricity bill</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} onClick={() => navigate(`/quotes/lead/${o.id}`)}>
                  <td data-label="Lead">
                    <OppCell opp={o} />
                  </td>
                  <td data-label="Stage">{stageById(o.stage).label}</td>
                  <td data-label="Electricity bill">
                    {state.withBill.has(o.id) ? <Badge tone="success">Uploaded</Badge> : <Badge tone="warning">Upload needed</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

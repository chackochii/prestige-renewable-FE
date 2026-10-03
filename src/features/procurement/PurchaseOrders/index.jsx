// Purchase orders & delivery — the "delivery" half of the stage's name. Orders
// for every job whichever branch it took (drafted while approvals are pending,
// sent once the job may order), with each one's delivery scheduled around the
// BOQ's lead times and received on site.
//
// `onCreate(body)` drafts an order against BOQ lines; `onUpdate(poId, body)`
// moves it on — sent, delivery scheduled, received — and `onDelete(poId)`
// removes a draft. The API refuses to send one while the variation is
// unapproved, and the CL-13 release tick sends every draft at once.

import { useState } from "react";
import { CalendarClock, PackageCheck, Plus, Send, Truck, X } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import StatCard from "@/components/StatCard";
import { PO_STATUSES } from "@/constants/procurement";
import {
  allDelivered,
  boqLines,
  deliveredOrders,
  longestLeadTimeDays,
  pendingApprovals,
  purchaseOrders,
  quotesReceived,
  readyToOrder,
  roleLabel,
  sentOrders,
  unavailableLines,
} from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const qty = (value) => Number(value) || 0;
const lineNames = (job, keys = []) => {
  const byKey = new Map(boqLines(job).map((line) => [line.key, line.item]));
  return keys.map((key) => byKey.get(key) ?? key).join(", ");
};
const quotedCost = (job, keys) => boqLines(job).filter((line) => keys.includes(line.key)).reduce((sum, line) => sum + qty(line.siteQty) * qty(line.quotedUnitCost), 0);

export default function PurchaseOrders({ job, canEdit = false, onCreate, onUpdate, onDelete }) {
  const orders = purchaseOrders(job);
  const sent = sentOrders(job);
  const delivered = deliveredOrders(job);
  const leadTime = longestLeadTimeDays(job);
  const backordered = unavailableLines(job);
  const lines = boqLines(job);
  const ready = readyToOrder(job);
  const held = pendingApprovals(job).map(roleLabel).join(" and ");

  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState({ supplier: "", lines: [], total: "", deliveryEta: "" });
  const [action, setAction] = useState(null); // { poId, kind: "schedule" | "receive", value }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const suppliers = [...new Set(lines.map((line) => line.supplier).filter(Boolean))];

  const run = async (call, after) => {
    setBusy(true);
    setError("");
    try {
      await call();
      after?.();
    } catch (err) {
      setError(errText(err, "The purchase order could not be saved."));
    } finally {
      setBusy(false);
    }
  };
  const toggleLine = (key) => {
    const next = draft.lines.includes(key) ? draft.lines.filter((k) => k !== key) : [...draft.lines, key];
    const autoTotal = quotedCost(job, next);
    setDraft({ ...draft, lines: next, total: autoTotal ? String(Math.round(autoTotal * 100) / 100) : draft.total });
  };
  const pickSupplier = (supplier) => {
    // Choosing a supplier pre-ticks the lines they quoted.
    const theirs = lines.filter((line) => line.supplier === supplier).map((line) => line.key);
    const next = theirs.length ? theirs : draft.lines;
    const autoTotal = quotedCost(job, next);
    setDraft({ ...draft, supplier, lines: next, total: autoTotal ? String(Math.round(autoTotal * 100) / 100) : draft.total });
  };
  const create = () =>
    run(
      () => onCreate?.({ supplier: draft.supplier.trim(), lines: draft.lines, total: draft.total === "" ? undefined : Number(draft.total), deliveryEta: draft.deliveryEta || null }),
      () => {
        setDrafting(false);
        setDraft({ supplier: "", lines: [], total: "", deliveryEta: "" });
      },
    );

  if (!quotesReceived(job) && !orders.length) {
    return (
      <Alert tone="info">
        Purchase orders are raised once every line is quoted and any price variation has been approved. Nothing to order yet.
      </Alert>
    );
  }

  return (
    <>
      {!ready ? (
        <Alert tone="warning">
          {orders.length ? `${orders.length} order${orders.length === 1 ? "" : "s"} drafted and` : "Orders are"} held until{" "}
          {quotesReceived(job) ? `${held} approve${pendingApprovals(job).length === 1 ? "s" : ""} the price variation` : "every line is quoted"}.
        </Alert>
      ) : sent.length === 0 ? (
        <Alert tone="info">Cleared to order — procurement can start sending purchase orders. Each one is recorded in the history tab.</Alert>
      ) : allDelivered(job) ? (
        <Alert tone="success">Every order has been received on site — materials are ready for the construction crew.</Alert>
      ) : (
        <Alert tone="info">
          {delivered.length} of {sent.length} orders received. Deliveries are scheduled with the site coordinator so the crew
          is not waiting on stock.
        </Alert>
      )}

      <div className="stats" style={{ margin: "20px 0" }}>
        <StatCard label="Orders sent" value={`${sent.length} / ${orders.length}`} icon={<Send size={14} />} hint="Of those drafted" />
        <StatCard label="Received on site" value={delivered.length} icon={<PackageCheck size={14} />} hint="Deliveries signed for" />
        <StatCard
          label="Longest lead time"
          value={leadTime ? `${leadTime} days` : "None"}
          icon={<CalendarClock size={14} />}
          hint={backordered.length ? `${backordered.map((line) => line.item).join(", ")} on back-order` : "Everything can be had when ordered"}
        />
      </div>

      <div className="estimation-item-head">
        <SectionHead icon={<Truck size={13} />} title="Purchase orders" />
        {canEdit && !drafting && lines.length ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrafting(true)}>
            <Plus size={14} /> Draft a purchase order
          </button>
        ) : null}
      </div>
      {error ? (
        <Alert tone="danger" style={{ marginBottom: 10 }}>
          {error}
        </Alert>
      ) : null}

      {drafting ? (
        <div className="decision-card" style={{ marginBottom: 12 }}>
          <div className="form-grid">
            <Field label="Supplier" required>
              <input list="po-suppliers" value={draft.supplier} onChange={(e) => pickSupplier(e.target.value)} placeholder="e.g. Solar Juice" />
              <datalist id="po-suppliers">
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier} />
                ))}
              </datalist>
            </Field>
            <Field label="Order total ($)" hint="from the quoted prices of the lines ticked; change it if the supplier's PO total differs">
              <input type="number" min={0} step="0.01" value={draft.total} onChange={(e) => setDraft({ ...draft, total: e.target.value })} />
            </Field>
            <Field label="Supplier's delivery ETA" hint="optional">
              <input type="date" value={draft.deliveryEta} onChange={(e) => setDraft({ ...draft, deliveryEta: e.target.value })} />
            </Field>
            <Field label="Lines on this order" className="span-2" required>
              <div className="list-stack">
                {lines.map((line) => (
                  <label key={line.key} className="check cl-check">
                    <input type="checkbox" checked={draft.lines.includes(line.key)} onChange={() => toggleLine(line.key)} />
                    <span>
                      {line.item}
                      {line.supplier ? ` · ${line.supplier}` : ""} · {qty(line.siteQty)} {line.unit}
                      {line.quotedUnitCost !== null && line.quotedUnitCost !== undefined ? ` · ${formatCurrency(qty(line.siteQty) * qty(line.quotedUnitCost))}` : " · not quoted"}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={create} disabled={busy || !draft.supplier.trim() || !draft.lines.length}>
              <Plus size={14} /> {busy ? "Saving…" : "Save draft"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrafting(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <p className="lede" style={{ fontSize: 14 }}>
          None drafted yet.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Supplier</th>
                <th>Total</th>
                <th>Sent</th>
                <th>Delivery</th>
                <th>Status</th>
                {canEdit ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const status = PO_STATUSES[order.status] ?? PO_STATUSES.draft;
                const acting = action?.poId === order.id ? action : null;
                return (
                  <tr key={order.id ?? order.number}>
                    <td>
                      <div className="row-title">{order.number}</div>
                      <div className="row-meta" style={{ whiteSpace: "normal" }}>
                        {lineNames(job, order.lines)}
                      </div>
                    </td>
                    <td>{order.supplier}</td>
                    <td>{formatCurrency(order.total)}</td>
                    <td>{order.sentAt ? formatDate(order.sentAt) : <span className="row-meta">not yet</span>}</td>
                    <td>
                      {order.deliveredAt ? (
                        <>
                          <div>{formatDate(order.deliveredAt)}</div>
                          <div className="row-meta">received by {order.receivedBy || "—"}</div>
                        </>
                      ) : order.scheduledFor ? (
                        <>
                          <div>{formatDate(order.scheduledFor)}</div>
                          <div className="row-meta">scheduled</div>
                        </>
                      ) : order.deliveryEta ? (
                        <>
                          <div>{formatDate(order.deliveryEta)}</div>
                          <div className="row-meta">supplier ETA</div>
                        </>
                      ) : (
                        <span className="row-meta">—</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    {canEdit ? (
                      <td>
                        {acting ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            {acting.kind === "schedule" ? (
                              <input type="date" value={acting.value} onChange={(e) => setAction({ ...acting, value: e.target.value })} aria-label="Delivery date" />
                            ) : (
                              <input value={acting.value} onChange={(e) => setAction({ ...acting, value: e.target.value })} placeholder="Received by" aria-label="Received by" style={{ width: 140 }} />
                            )}
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busy || (acting.kind === "schedule" && !acting.value)}
                              onClick={() =>
                                run(
                                  () =>
                                    onUpdate?.(
                                      order.id,
                                      acting.kind === "schedule" ? { status: "scheduled", scheduledFor: acting.value } : { status: "delivered", receivedBy: acting.value || undefined },
                                    ),
                                  () => setAction(null),
                                )
                              }
                            >
                              {acting.kind === "schedule" ? "Schedule" : "Mark received"}
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAction(null)} disabled={busy}>
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {order.status === "draft" ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={busy || !ready}
                                  title={ready ? undefined : `Held until ${held || "every line is quoted"}`}
                                  onClick={() => run(() => onUpdate?.(order.id, { status: "sent" }))}
                                >
                                  <Send size={14} /> Send to supplier
                                </button>
                                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => onDelete?.(order.id))} aria-label={`Remove ${order.number}`}>
                                  <X size={14} />
                                </button>
                              </>
                            ) : null}
                            {["sent", "confirmed"].includes(order.status) ? (
                              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setAction({ poId: order.id, kind: "schedule", value: order.scheduledFor || order.deliveryEta || "" })}>
                                <CalendarClock size={14} /> Schedule delivery
                              </button>
                            ) : null}
                            {["sent", "confirmed", "scheduled"].includes(order.status) ? (
                              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setAction({ poId: order.id, kind: "receive", value: "" })}>
                                <PackageCheck size={14} /> Received
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

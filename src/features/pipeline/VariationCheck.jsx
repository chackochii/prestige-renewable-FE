// Variation check: compares the quote against the default price list (the
// product catalog) and the plain quote, and lists everything that moves the
// price away from it —
//
//   - price variations: an item quoted at a different unit price from its
//     catalog price (including when the catalog price has changed since the
//     item was added);
//   - discounts: item line discounts, and Rebate / Discount cost lines;
//   - extras: every other additional cost on top of the items.
//
// A price variation can be resolved by updating the quote — to the default
// price, or to a new price typed in. The outcome of the check is written to
// the job history, including when there is nothing to report.

import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CircleCheck, History, Receipt, TrendingDown } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import LoadingState from "@/components/LoadingState";
import NumberInput from "@/components/NumberInput";
import SectionHead from "@/components/SectionHead";
import { quoteVariations } from "@/helpers/quote";
import { formatCurrency } from "@/utils/formatCurrency";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchCatalog } from "@/slices/catalogSlice";
import { addOpportunityHistoryEntry, updateQuoteItem } from "@/slices/leadsSlice";
import { useNotifications } from "@/hooks/useNotifications";

const money = (value) => formatCurrency(value, { withCents: true });
const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

/** The job-history note for the check, in plain sentences. */
function historyNote(v) {
  if (!v.hasVariation) {
    return "Variation check: no variations from the default price list — no price changes, discounts or extra costs on the quote.";
  }
  const parts = [];
  if (v.priceVariations.length) {
    parts.push(
      `${v.priceVariations.length} price variation${v.priceVariations.length === 1 ? "" : "s"} (${v.priceVariations
        .map((p) => `${p.item.itemName} ${p.item.brand}: default ${money(p.defaultPrice)}, quoted ${money(p.quotedPrice)}`)
        .join("; ")})`,
    );
  }
  if (v.discounts.length) {
    parts.push(
      `${v.discounts.length} discount${v.discounts.length === 1 ? "" : "s"} (${v.discounts
        .map((d) => `${d.label} −${money(d.amount)}`)
        .join("; ")})`,
    );
  }
  if (v.extras.length) {
    parts.push(
      `${v.extras.length} extra cost${v.extras.length === 1 ? "" : "s"} (${v.extras
        .map((e) => `${e.label} ${money(e.amount)}`)
        .join("; ")})`,
    );
  }
  return `Variation check: ${parts.join(", ")}.`;
}

export default function VariationCheck({ opp, canEdit }) {
  const dispatch = useAppDispatch();
  const { notify, error: notifyError } = useNotifications();
  const quote = useAppSelector((s) => s.leads.quote);
  const catalogItems = useAppSelector((s) => s.catalog.items);
  const catalogStatus = useAppSelector((s) => s.catalog.status);
  const [priceDrafts, setPriceDrafts] = useState({});
  const [busyItemId, setBusyItemId] = useState(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (catalogStatus === "idle") dispatch(fetchCatalog());
  }, [catalogStatus, dispatch]);

  const v = useMemo(() => quoteVariations(quote, catalogItems), [quote, catalogItems]);

  if (catalogStatus === "loading" && !catalogItems.length) return <LoadingState label="Loading the price list…" />;

  const updatePrice = async (item, unitPrice) => {
    setBusyItemId(item.id);
    try {
      await dispatch(updateQuoteItem({ id: opp.id, itemId: item.id, body: { unitPrice: Number(unitPrice) || 0 } })).unwrap();
      await dispatch(
        addOpportunityHistoryEntry({
          id: opp.id,
          body: {
            note: `Quote updated for price variation: ${item.itemName} ${item.brand} unit price ${money(item.unitPrice)} → ${money(unitPrice)}.`,
          },
        }),
      ).unwrap();
      setPriceDrafts((d) => {
        const next = { ...d };
        delete next[item.id];
        return next;
      });
      notify(`${item.itemName} updated to ${money(unitPrice)}`);
    } catch (err) {
      notifyError(errText(err, "Could not update the quote."));
    } finally {
      setBusyItemId(null);
    }
  };

  const updateAllToDefault = async () => {
    for (const p of v.priceVariations) {
      await updatePrice(p.item, p.defaultPrice);
    }
  };

  const recordCheck = async () => {
    setRecording(true);
    try {
      await dispatch(addOpportunityHistoryEntry({ id: opp.id, body: { note: historyNote(v) } })).unwrap();
      notify(v.hasVariation ? "Variations recorded in job history" : "No variations — recorded in job history");
    } catch (err) {
      notifyError(errText(err, "Could not record the check in job history."));
    } finally {
      setRecording(false);
    }
  };

  return (
    <div className="section">
      <SectionHead icon={<BadgeDollarSign size={13} />} title="Variation check" />
      <p className="lede" style={{ marginBottom: 16 }}>
        Compares the quote with the default price list. Price changes can be applied to the quote here; discounts and
        extra costs are listed so they are signed off before the quote goes out.
      </p>

      {catalogStatus === "failed" ? (
        <Alert tone="warning">The price list could not be loaded, so item prices can't be compared right now.</Alert>
      ) : null}

      <div className="variation-summary">
        <Badge tone={v.priceVariations.length ? "warning" : "success"}>
          {v.priceVariations.length} price variation{v.priceVariations.length === 1 ? "" : "s"}
        </Badge>
        <Badge tone={v.discounts.length ? "warning" : "success"}>
          {v.discounts.length} discount{v.discounts.length === 1 ? "" : "s"}
        </Badge>
        <Badge tone={v.extras.length ? "warning" : "success"}>
          {v.extras.length} extra cost{v.extras.length === 1 ? "" : "s"}
        </Badge>
        {v.unpriced.length ? <Badge tone="neutral">{v.unpriced.length} not on the price list</Badge> : null}
      </div>

      {!v.hasVariation ? (
        <Alert tone="success">
          <CircleCheck size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          No variations — every item is at its default price, with no discounts or extra costs.
        </Alert>
      ) : null}

      {v.priceVariations.length ? (
        <div style={{ marginTop: 20 }}>
          <SectionHead icon={<TrendingDown size={13} />} title="Price variations" />
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Default price</th>
                  <th>Quoted price</th>
                  <th>Difference</th>
                  {canEdit ? <th>Update quote</th> : null}
                </tr>
              </thead>
              <tbody>
                {v.priceVariations.map((p) => {
                  const draft = priceDrafts[p.item.id] ?? p.quotedPrice;
                  const busy = busyItemId === p.item.id;
                  return (
                    <tr key={p.item.id}>
                      <td data-label="Item">
                        <div className="row-title">{p.item.itemName}</div>
                        <div className="row-meta">
                          {p.item.brand} · {p.item.quantity} {p.item.unit}
                        </div>
                      </td>
                      <td data-label="Default price">{money(p.defaultPrice)}</td>
                      <td data-label="Quoted price">{money(p.quotedPrice)}</td>
                      <td data-label="Difference">
                        <Badge tone={p.difference > 0 ? "danger" : "info"}>
                          {p.difference > 0 ? "+" : "−"}
                          {money(Math.abs(p.difference))} ({p.difference > 0 ? "+" : "−"}
                          {Math.abs(p.differencePct).toFixed(1)}%)
                        </Badge>
                      </td>
                      {canEdit ? (
                        <td data-label="Update quote">
                          <div className="variation-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={busy}
                              onClick={() => updatePrice(p.item, p.defaultPrice)}
                            >
                              Use default
                            </button>
                            <div className="field variation-price">
                              <NumberInput
                                value={draft}
                                min={0}
                                disabled={busy}
                                onChange={(val) => setPriceDrafts((d) => ({ ...d, [p.item.id]: val }))}
                              />
                            </div>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busy || Number(draft) === p.quotedPrice}
                              onClick={() => updatePrice(p.item, draft)}
                            >
                              {busy ? "Updating…" : "Update"}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {canEdit && v.priceVariations.length > 1 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 10 }}
              disabled={busyItemId !== null}
              onClick={updateAllToDefault}
            >
              Update all to default prices
            </button>
          ) : null}
        </div>
      ) : null}

      {v.discounts.length ? (
        <div style={{ marginTop: 20 }}>
          <SectionHead icon={<TrendingDown size={13} />} title="Discounts" />
          <div className="list-stack">
            {v.discounts.map((d) => (
              <div key={d.key} className="list-row">
                <div>
                  <div className="row-title">{d.label}</div>
                  <div className="row-meta">{d.detail}</div>
                </div>
                <span className="row-meta">−{money(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {v.extras.length ? (
        <div style={{ marginTop: 20 }}>
          <SectionHead icon={<Receipt size={13} />} title="Extra costs" />
          <div className="list-stack">
            {v.extras.map((e) => (
              <div key={e.key} className="list-row">
                <div>
                  <div className="row-title">{e.label}</div>
                  <div className="row-meta">{e.detail}</div>
                </div>
                <span className="row-meta">+{money(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {v.unpriced.length ? (
        <p className="lede" style={{ marginTop: 16 }}>
          Not on the price list, so not compared: {v.unpriced.map((i) => `${i.itemName} (${i.brand})`).join(", ")}.
        </p>
      ) : null}

      {canEdit ? (
        <div className="decision-card">
          <SectionHead icon={<History size={13} />} title="Record in job history" />
          <p className="lede" style={{ marginBottom: 12 }}>
            {v.hasVariation
              ? "Writes the variations above to the job history, so the approved discounts and extras are on the record."
              : "Writes “no variations” to the job history, so the quote is on record as matching the default price list."}
          </p>
          <button type="button" className="btn btn-primary btn-sm" disabled={recording} onClick={recordCheck}>
            {recording ? "Recording…" : v.hasVariation ? "Record variations" : "Record no variations"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

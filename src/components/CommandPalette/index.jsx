// ⌘K search over the current unit's opportunities.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import Avatar from "@/components/Avatar";
import { oppTitle } from "@/helpers/opportunity";
import { stageById } from "@/constants/stages";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchOpportunities } from "@/slices/leadsSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";

export default function CommandPalette({ open, onClose }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { unitId } = useBusinessUnit();
  const { items, status } = useAppSelector((s) => s.leads);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (open && unitId && status === "idle") dispatch(fetchOpportunities({ businessUnitId: unitId }));
  }, [open, unitId, status, dispatch]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    const sorted = [...items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const term = query.trim().toLowerCase();
    if (!term) return sorted.slice(0, 8);
    return sorted
      .filter((o) =>
        `${o.number || ""} ${o.customerLegalName || ""} ${o.customerTradingName || ""} ${o.siteSuburb || ""}`
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 8);
  }, [items, query]);

  if (!open) return null;

  const openOpp = (id) => {
    onClose();
    navigate(`/opportunities/${id}`);
  };

  return (
    <div className="palette-back" onClick={onClose} role="presentation">
      <div className="palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <div className="palette-input">
          <Search size={17} />
          <input
            autoFocus
            placeholder="Search opportunities by name, number or suburb…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list">
          {results.length === 0 ? (
            <div className="palette-empty">
              {status === "loading" ? "Loading…" : `No opportunities match “${query}”.`}
            </div>
          ) : (
            <>
              <div className="palette-section">{query ? "Results" : "Recently updated"}</div>
              {results.map((o) => (
                <button key={o.id} type="button" className="palette-item" onClick={() => openOpp(o.id)}>
                  <Avatar name={oppTitle(o)} size={30} />
                  <div>
                    <div className="row-title">{oppTitle(o)}</div>
                    <div className="row-meta">
                      {o.number} · {[o.siteSuburb, o.siteState].filter(Boolean).join(" ")} · {stageById(o.stage).label}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

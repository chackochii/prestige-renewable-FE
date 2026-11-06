// Lead inbox: leads the ad platforms (Meta, Google Ads) delivered to this
// business unit, waiting for sales to convert or reject them. 12 to a page,
// newest first; the tab, source filter, search and page live in the URL.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Pagination from "@/components/Pagination";
import Alert from "@/components/Alert";
import Tabs from "@/components/Tabs";
import InboundLeadReviewModal from "@/features/leads/InboundLeadReviewModal";
import { AUTOMATED_LEAD_SOURCES } from "@/features/leads/leadSourceOptions";
import { PERMISSIONS } from "@/constants/permissions";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { PAGE_SIZE } from "@/helpers/pagination";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { usePageParam } from "@/hooks/usePageParam";
import { useUrlParam, useUrlSearch } from "@/hooks/useUrlParam";
import { getErrorMessage } from "@/services/api/client";
import { listInboundLeads } from "@/services/api/inboundLeadsApi";

const STATUS_TABS = [
  { key: "pending", label: "To review" },
  { key: "converted", label: "Converted" },
  { key: "rejected", label: "Rejected" },
];

const EMPTY = {
  pending: [
    "Nothing to review",
    "New leads from Meta and Google Ads land here the moment they arrive.",
  ],
  converted: [
    "No converted leads yet",
    "Leads you convert become stage-1 leads and are listed here with their job number.",
  ],
  rejected: [
    "No rejected leads",
    "Leads you reject stay here with the reason, and can be reopened.",
  ],
};

const contactOf = (lead) =>
  [lead.phone, lead.email].filter(Boolean).join(" · ") || "—";

export default function LeadInboxPage() {
  const { unit, unitId } = useBusinessUnit();
  const { hasPermission } = useAuth();
  const [status, setStatus] = useUrlParam("status", "pending");
  const [source, setSource] = useUrlParam("source");
  const { search, setSearch, term } = useUrlSearch();
  const [page, setPage] = usePageParam(`${status}|${source}|${term}`);
  const [state, setState] = useState({
    items: [],
    total: 0,
    counts: null,
    loading: true,
    error: "",
  });
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!unitId) return;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const result = await listInboundLeads({
        businessUnitId: unitId,
        status,
        ...(source ? { source } : {}),
        ...(term ? { search: term } : {}),
        page,
        pageSize: PAGE_SIZE,
      });
      setState({
        items: result.items,
        total: result.total,
        counts: result.counts,
        loading: false,
        error: "",
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: getErrorMessage(err, "Could not load the inbox."),
      }));
    }
  }, [unitId, status, source, term, page]);

  useEffect(() => {
    load();
  }, [load]);

  const { items: rows, total, counts, loading, error } = state;
  const [emptyTitle, emptyBody] = EMPTY[status] || EMPTY.pending;

  return (
    <>
      <PageHeader
        title="Lead inbox"
        description={`Leads delivered by the ad platforms connected to ${unit?.name || "this unit"}. Review each one, then convert it into a lead or reject it.`}
        actions={
          <>
            {hasPermission(PERMISSIONS.ADMIN_READ) ? (
              <Link className="btn btn-ghost" to="/admin/connections">
                Lead connections
              </Link>
            ) : null}
            <Link className="btn btn-ghost" to="/leads">
              All leads
            </Link>
          </>
        }
      />

      <Tabs
        items={STATUS_TABS.map((tab) => ({
          ...tab,
          count: counts ? counts[tab.key] : undefined,
        }))}
        value={
          STATUS_TABS.some((tab) => tab.key === status) ? status : "pending"
        }
        onChange={(key) => setStatus(key)}
      />

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, email, phone, company or campaign"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search inbox"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Source"
        >
          <option value="">Every source</option>
          {AUTOMATED_LEAD_SOURCES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="card card-pad">
        {loading && !rows.length ? (
          <LoadingState label="Loading inbox…" />
        ) : !loading && rows.length === 0 ? (
          <EmptyState
            icon={<Inbox size={28} strokeWidth={1.5} />}
            title={term || source ? "No leads match" : emptyTitle}
            body={
              term || source
                ? "Nothing matches that search or source."
                : emptyBody
            }
          />
        ) : (
          <div className={`table-wrap${loading ? " is-refreshing" : ""}`}>
            <table className="table clickable stack">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Contact</th>
                  <th>Source</th>
                  <th>Received</th>
                  <th>
                    {status === "converted"
                      ? "Job"
                      : status === "rejected"
                        ? "Reason"
                        : "Flags"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr key={lead.id} onClick={() => setOpenId(lead.id)}>
                    <td data-label="Lead">
                      <div className="row-title">{lead.displayName}</div>
                      <div className="row-meta">
                        {[lead.company, lead.suburb, lead.postcode]
                          .filter(Boolean)
                          .join(" · ") || "No location given"}
                      </div>
                    </td>
                    <td data-label="Contact">{contactOf(lead)}</td>
                    <td data-label="Source">
                      <Badge
                        tone={lead.source === "meta_ads" ? "info" : "gold"}
                      >
                        {lead.sourceLabel}
                      </Badge>
                      <div className="row-meta">
                        {[
                          lead.campaignName ||
                            (lead.campaignId
                              ? `Campaign ${lead.campaignId}`
                              : null),
                          lead.formName,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td data-label="Received">
                      {formatDate(lead.receivedAt, { withTime: true })}
                    </td>
                    <td
                      data-label={
                        status === "converted"
                          ? "Job"
                          : status === "rejected"
                            ? "Reason"
                            : "Flags"
                      }
                    >
                      {status === "converted" && lead.opportunity ? (
                        <Link
                          to={`/opportunities/${lead.opportunity.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.opportunity.number}
                        </Link>
                      ) : status === "rejected" ? (
                        <span className="row-meta">
                          {lead.rejectReason || "No reason given"}
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          {lead.duplicateOfId ? (
                            <Badge tone="warning">Duplicate?</Badge>
                          ) : null}
                          {lead.isTest ? <Badge tone="info">Test</Badge> : null}
                          {lead.fetchError ? (
                            <Badge tone="danger">Fetch failed</Badge>
                          ) : null}
                          {!lead.duplicateOfId &&
                          !lead.isTest &&
                          !lead.fetchError ? (
                            <span className="row-meta">—</span>
                          ) : null}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          total={total}
          onPageChange={setPage}
          noun="leads"
          loading={loading}
        />
      </div>

      {openId ? (
        <InboundLeadReviewModal
          leadId={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      ) : null}
    </>
  );
}

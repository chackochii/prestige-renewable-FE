// Administration → Lead connections: the ad accounts this business unit
// takes leads from, and what to paste into each platform. Reads need the
// Admin page; writes need admin.*.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plug, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminNav from "@/components/AdminNav";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import Alert from "@/components/Alert";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import CopyLinkButton from "@/components/CopyLinkButton";
import ConnectionFormModal from "@/features/admin/ConnectionFormModal";
import { PERMISSIONS } from "@/constants/permissions";
import { formatDate, timeAgo } from "@/helpers/dateTimeHelpers";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";
import { getErrorMessage } from "@/services/api/client";
import {
  createConnection,
  deleteConnection,
  getIntegrationSetup,
  listConnections,
  rotateConnectionSecret,
  syncConnection,
  testConnection,
  updateConnection,
} from "@/services/api/integrationsApi";

function SetupCard({ setup }) {
  if (!setup) return null;
  const { webhookUrls, meta } = setup;
  return (
    <Card
      title="Where the platforms send leads"
      icon={<Plug size={16} />}
      sub="One address per platform for the whole system; the connection below decides which business unit each lead lands in."
      style={{ marginBottom: 20 }}
    >
      <div className="table-wrap">
        <table className="table stack">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Setting</th>
              <th>Value</th>
              <th aria-label="Copy" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label="Platform">
                <strong>Meta Ads</strong>
              </td>
              <td data-label="Setting">Webhook callback URL</td>
              <td data-label="Value">
                <code className="enquiry-link">{webhookUrls.meta_ads}</code>
              </td>
              <td style={{ textAlign: "right" }}>
                <CopyLinkButton
                  value={webhookUrls.meta_ads}
                  label="Copy"
                  toast="Meta webhook URL copied"
                />
              </td>
            </tr>
            <tr>
              <td data-label="Platform">
                <strong>Meta Ads</strong>
              </td>
              <td data-label="Setting">Verify token</td>
              <td data-label="Value">
                {meta.verifyToken ? (
                  <code className="enquiry-link">{meta.verifyToken}</code>
                ) : (
                  <Badge tone="danger">
                    META_WEBHOOK_VERIFY_TOKEN not set on the server
                  </Badge>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                {meta.verifyToken ? (
                  <CopyLinkButton
                    value={meta.verifyToken}
                    label="Copy"
                    toast="Verify token copied"
                  />
                ) : null}
              </td>
            </tr>
            <tr>
              <td data-label="Platform">
                <strong>Meta Ads</strong>
              </td>
              <td data-label="Setting">App secret</td>
              <td data-label="Value">
                {meta.appSecretSet ? (
                  <Badge tone="success">Set on the server</Badge>
                ) : (
                  <Badge tone="danger">
                    META_APP_SECRET not set — deliveries will be refused
                  </Badge>
                )}
              </td>
              <td />
            </tr>
            <tr>
              <td data-label="Platform">
                <strong>Google Ads</strong>
              </td>
              <td data-label="Setting">Webhook URL (lead form asset)</td>
              <td data-label="Value">
                <code className="enquiry-link">{webhookUrls.google_ads}</code>
              </td>
              <td style={{ textAlign: "right" }}>
                <CopyLinkButton
                  value={webhookUrls.google_ads}
                  label="Copy"
                  toast="Google Ads webhook URL copied"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {!meta.tokensSealed ? (
        <p className="hint" style={{ marginTop: 12 }}>
          Page access tokens are stored unencrypted — set INTEGRATION_SECRET_KEY
          on the server to seal them.
        </p>
      ) : null}
    </Card>
  );
}

export default function ConnectionsPage() {
  const { hasPermission } = useAuth();
  const { unit, unitId } = useBusinessUnit();
  const { notify } = useNotifications();
  const [setup, setSetup] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | connection
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(null); // `${action}:${id}`
  const [results, setResults] = useState({}); // id → { tone, text }

  const canCreate = hasPermission(PERMISSIONS.ADMIN_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.ADMIN_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.ADMIN_DELETE);

  const load = useCallback(async () => {
    if (!unitId) return;
    setError("");
    try {
      const [connections, setupInfo] = await Promise.all([
        listConnections({ businessUnitId: unitId }),
        setup ? Promise.resolve(setup) : getIntegrationSetup(),
      ]);
      setRows(connections);
      setSetup(setupInfo);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load the connections."));
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const save = async (payload) => {
    if (editing === "new") {
      const created = await createConnection({
        ...payload,
        businessUnitId: unitId,
      });
      notify(
        created.platform === "google_ads"
          ? "Connection added — paste its key into the Google Ads lead form"
          : "Connection added",
      );
    } else {
      await updateConnection(editing.id, payload);
      notify("Connection updated");
    }
    await load();
  };

  const act = async (action, connection, fn, onDone) => {
    setBusy(`${action}:${connection.id}`);
    try {
      const result = await fn();
      onDone?.(result);
    } catch (err) {
      setResults((r) => ({
        ...r,
        [connection.id]: { tone: "danger", text: getErrorMessage(err) },
      }));
    } finally {
      setBusy(null);
    }
  };

  const test = (connection) =>
    act(
      "test",
      connection,
      () => testConnection(connection.id),
      (result) => {
        const text =
          connection.platform === "meta_ads"
            ? `Token works for page “${result.page.name}” (${result.page.id}). Lead forms: ${result.forms.length ? result.forms.map((f) => `${f.name} (${f.status?.toLowerCase() || "?"})`).join(", ") : "none yet"}. ${
                result.subscription?.subscribed
                  ? "The page is subscribed to the webhook."
                  : `The page could not be subscribed to the webhook${result.subscription?.error ? ` (${result.subscription.error})` : ""} — the token needs pages_manage_metadata.`
              }`
            : result.hint;
        setResults((r) => ({
          ...r,
          [connection.id]: { tone: "success", text },
        }));
        load();
      },
    );

  const sync = (connection) =>
    act(
      "sync",
      connection,
      () => syncConnection(connection.id),
      (result) => {
        setResults((r) => ({
          ...r,
          [connection.id]: {
            tone: "success",
            text: `Checked ${result.forms} form(s), ${result.fetched} lead(s) seen, ${result.created} new filed${result.converted ? `, ${result.converted} converted` : ""}.`,
          },
        }));
        load();
      },
    );

  const rotate = (connection) =>
    act(
      "rotate",
      connection,
      () => rotateConnectionSecret(connection.id),
      () => {
        notify(
          "New key made — update the Google Ads lead form, the old key stopped working",
          "info",
        );
        load();
      },
    );

  const remove = async () => {
    try {
      await deleteConnection(deleting.id);
      notify(`${deleting.name} removed`, "info");
      load();
    } catch (err) {
      notify(getErrorMessage(err), "danger");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Lead connections"
        description={`The Meta and Google Ads accounts ${unit?.name || "this unit"} takes leads from. Leads arrive in the lead inbox for review.`}
        actions={
          <>
            <Link className="btn btn-ghost" to="/leads/inbox">
              Lead inbox
            </Link>
            {canCreate ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setEditing("new")}
              >
                <Plus size={16} /> Add connection
              </button>
            ) : null}
          </>
        }
      />
      <AdminNav />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      <SetupCard setup={setup} />

      <div className="card card-pad">
        {rows === null ? (
          <LoadingState label="Loading connections…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Plug size={28} strokeWidth={1.5} />}
            title="No connections yet"
            body="Add the Facebook Page or Google Ads account this unit runs lead ads on. Each lead it produces is then filed here automatically."
          />
        ) : (
          rows.map((c) => {
            const result = results[c.id];
            return (
              <div
                key={c.id}
                className="list-row"
                style={{ flexWrap: "wrap", alignItems: "flex-start" }}
              >
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div
                    className="row-title"
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {c.name}
                    <Badge tone={c.platform === "meta_ads" ? "info" : "gold"}>
                      {c.platformLabel}
                    </Badge>
                    {!c.isActive ? <Badge tone="danger">Off</Badge> : null}
                    {c.autoConvert ? (
                      <Badge tone="neutral">Skips inbox</Badge>
                    ) : null}
                  </div>
                  <div className="row-meta">
                    {c.platform === "meta_ads"
                      ? `Page ${c.externalAccountId} · token ${c.credentials.pageAccessToken || "missing"}`
                      : c.externalAccountId
                        ? `Customer ${c.externalAccountId}`
                        : "Google Ads lead forms"}
                    {" · "}
                    {c.leadCount} lead{c.leadCount === 1 ? "" : "s"} filed
                    {c.lastEventAt
                      ? ` · last ${timeAgo(c.lastEventAt)}`
                      : " · nothing received yet"}
                    {c.platform === "meta_ads" && c.lastSyncAt
                      ? ` · polled ${timeAgo(c.lastSyncAt)}`
                      : ""}
                  </div>
                  {c.platform === "google_ads" ? (
                    <div
                      className="row-meta"
                      style={{
                        marginTop: 6,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      Key:{" "}
                      <code className="enquiry-link">{c.webhookSecret}</code>
                      <CopyLinkButton
                        value={c.webhookSecret}
                        label="Copy key"
                        toast="Key copied — paste it into the lead form's webhook settings"
                      />
                    </div>
                  ) : null}
                  {c.lastError ? (
                    <div
                      className="row-meta"
                      style={{ marginTop: 6, color: "var(--danger, #b00020)" }}
                    >
                      Last error{" "}
                      {c.lastErrorAt
                        ? `(${formatDate(c.lastErrorAt, { withTime: true })})`
                        : ""}
                      : {c.lastError}
                    </div>
                  ) : null}
                  {result ? (
                    <Alert tone={result.tone} style={{ marginTop: 8 }}>
                      {result.text}
                    </Alert>
                  ) : null}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => test(c)}
                      disabled={busy === `test:${c.id}`}
                    >
                      {busy === `test:${c.id}` ? "Testing…" : "Test"}
                    </button>
                  ) : null}
                  {canUpdate && c.platform === "meta_ads" ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => sync(c)}
                      disabled={busy === `sync:${c.id}`}
                      title="Pull leads from the page's forms now"
                    >
                      {busy === `sync:${c.id}` ? "Pulling…" : "Pull leads now"}
                    </button>
                  ) : null}
                  {canUpdate && c.platform === "google_ads" ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => rotate(c)}
                      disabled={busy === `rotate:${c.id}`}
                      title="Make a new key; the old one stops working"
                    >
                      New key
                    </button>
                  ) : null}
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditing(c)}
                    >
                      Edit
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleting(c)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing ? (
        <ConnectionFormModal
          connection={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}

      {deleting ? (
        <Modal
          title="Delete connection"
          confirmClose={false}
          body={`Remove ${deleting.name}? New leads from it will no longer be accepted. The ${deleting.leadCount} lead${deleting.leadCount === 1 ? "" : "s"} it already filed stay in the inbox.`}
          onClose={() => setDeleting(null)}
          actions={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={remove}>
                Delete
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}

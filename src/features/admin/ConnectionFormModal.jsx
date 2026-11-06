// Add / edit a lead connection. Meta needs the Facebook Page id and a Page
// access token (write-only: shown masked, left blank to keep); Google needs
// only a name — its key is made by the API and shown on the list. The field
// map steers how a form's questions land on the lead's columns.

import { useState } from "react";
import Modal from "@/components/Modal";
import Field from "@/components/Field";
import Alert from "@/components/Alert";
import { isBlank } from "@/utils/validators";

const PLATFORMS = [
  { key: "meta_ads", label: "Meta Ads (Facebook / Instagram lead forms)" },
  { key: "google_ads", label: "Google Ads (lead form assets)" },
];

const MAPPABLE_COLUMNS = [
  ["name", "Full name"],
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["company", "Company"],
  ["street", "Street address"],
  ["suburb", "Suburb / city"],
  ["state", "State"],
  ["postcode", "Postcode"],
  ["message", "Message (free text)"],
  ["ignore", "Ignore this field"],
];

function initialForm(connection) {
  return {
    platform: connection?.platform || "meta_ads",
    name: connection?.name || "",
    externalAccountId: connection?.externalAccountId || "",
    pageAccessToken: "",
    autoConvert: Boolean(connection?.autoConvert),
    isActive: connection ? Boolean(connection.isActive) : true,
    fieldMap: Object.entries(connection?.config?.fieldMap || {}).map(
      ([key, column]) => ({ key, column }),
    ),
  };
}

export default function ConnectionFormModal({ connection, onClose, onSave }) {
  const editing = Boolean(connection);
  const [form, setForm] = useState(() => initialForm(connection));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setMapping = (i, field, value) =>
    set(
      "fieldMap",
      form.fieldMap.map((row, idx) =>
        idx === i ? { ...row, [field]: value } : row,
      ),
    );
  const isMeta = form.platform === "meta_ads";

  const submit = async () => {
    const found = {};
    if (isBlank(form.name)) found.name = "Give the connection a name.";
    if (isMeta && !/^\d{5,30}$/.test(form.externalAccountId.trim()))
      found.externalAccountId = "Enter the Facebook Page id (digits only).";
    if (isMeta && !editing && isBlank(form.pageAccessToken))
      found.pageAccessToken = "Paste the Page access token.";
    setErrors(found);
    if (Object.keys(found).length) return;

    const fieldMap = {};
    for (const row of form.fieldMap)
      if (row.key.trim()) fieldMap[row.key.trim()] = row.column;

    setSaving(true);
    setError("");
    try {
      await onSave({
        ...(editing ? {} : { platform: form.platform }),
        name: form.name.trim(),
        externalAccountId: form.externalAccountId.trim() || null,
        ...(form.pageAccessToken.trim()
          ? { credentials: { pageAccessToken: form.pageAccessToken.trim() } }
          : {}),
        config: { fieldMap },
        autoConvert: form.autoConvert,
        isActive: form.isActive,
      });
      onClose();
    } catch (err) {
      setError(
        typeof err === "string"
          ? err
          : err?.message || "Could not save the connection.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      className="wide"
      title={editing ? "Edit connection" : "Add connection"}
      body={
        isMeta
          ? "Leads from every lead form on this Facebook Page are filed into this business unit."
          : "Leads from every Google Ads lead form that sends to this connection's key are filed into this business unit."
      }
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Add connection"}
          </button>
        </>
      }
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="form-grid">
        <Field label="Platform" className="span-2">
          <select
            value={form.platform}
            disabled={editing}
            onChange={(e) => set("platform", e.target.value)}
          >
            {PLATFORMS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Name"
          error={errors.name}
          hint="how it reads on the inbox"
        >
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={
              isMeta
                ? "e.g. Facebook page — Prestige Solar"
                : "e.g. Google Ads — Spring campaign"
            }
            autoComplete="off"
          />
        </Field>
        {isMeta ? (
          <Field
            label="Facebook Page id"
            error={errors.externalAccountId}
            hint="Page → About → Page transparency, or the Business Suite URL"
          >
            <input
              value={form.externalAccountId}
              onChange={(e) => set("externalAccountId", e.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>
        ) : (
          <Field
            label="Google Ads customer id"
            hint="optional, for your own reference"
          >
            <input
              value={form.externalAccountId}
              onChange={(e) => set("externalAccountId", e.target.value)}
              autoComplete="off"
            />
          </Field>
        )}
        {isMeta ? (
          <Field
            label={editing ? "New Page access token" : "Page access token"}
            className="span-2"
            error={errors.pageAccessToken}
            hint={
              editing
                ? `leave blank to keep the current one${connection?.credentials?.pageAccessToken ? ` (${connection.credentials.pageAccessToken})` : ""}`
                : "a System User token with leads_retrieval, pages_show_list and pages_manage_metadata"
            }
          >
            <input
              type="password"
              value={form.pageAccessToken}
              onChange={(e) => set("pageAccessToken", e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        ) : null}
        <Field label="Options" className="span-2">
          <div className="choice-grid">
            <label className="choice">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
              />
              <span>
                Active
                <small>
                  switched off, deliveries are refused and the poll skips it
                </small>
              </span>
            </label>
            <label className="choice">
              <input
                type="checkbox"
                checked={form.autoConvert}
                onChange={(e) => set("autoConvert", e.target.checked)}
              />
              <span>
                Skip the inbox
                <small>
                  every lead becomes a stage-1 lead the moment it arrives
                </small>
              </span>
            </label>
          </div>
        </Field>
        <Field
          label="Field mapping"
          className="span-2"
          hint="Only needed when a form question is not recognised on its own (name, email, phone, suburb, postcode and the usual spellings are). Use the question's key as the platform reports it."
        >
          {form.fieldMap.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {form.fieldMap.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    style={{ flex: "1 1 180px" }}
                    value={row.key}
                    onChange={(e) => setMapping(i, "key", e.target.value)}
                    placeholder="form field key, e.g. which_suburb"
                  />
                  <select
                    style={{ flex: "1 1 160px" }}
                    value={row.column}
                    onChange={(e) => setMapping(i, "column", e.target.value)}
                  >
                    {MAPPABLE_COLUMNS.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      set(
                        "fieldMap",
                        form.fieldMap.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: form.fieldMap.length ? 8 : 0 }}
            onClick={() =>
              set("fieldMap", [
                ...form.fieldMap,
                { key: "", column: "message" },
              ])
            }
          >
            Add mapping
          </button>
        </Field>
      </div>
    </Modal>
  );
}

// Admin → AI skills: the instructions the AI works to when it drafts a
// commercial proposal (the Prestige proposal skill), the reference files it
// reads with them, and the calculator's settings — products and prices,
// incentive rules, finance and savings assumptions. Every save is a new
// version with a note, and any earlier version can be restored.
//
// Anyone with admin read access can look; changing a skill needs skills.manage.

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Download, FileText, History, Plus, RotateCcw, Save, Settings2, Sparkles, Trash2, Upload } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminNav from "@/components/AdminNav";
import Badge from "@/components/Badge";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import Tabs from "@/components/Tabs";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import SkillSettingsForm from "@/features/admin/SkillSettingsForm";
import { PERMISSIONS } from "@/constants/permissions";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  createSkill,
  fetchSkill,
  fetchSkillReference,
  fetchSkillVersion,
  fetchSkillVersions,
  fetchSkills,
  removeSkillReference,
  resetSkillSettings,
  restoreSkillVersion,
  updateSkill,
  updateSkillReference,
  uploadSkillFile,
} from "@/slices/aiSkillsSlice";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const FILE_TYPES = ".md,.markdown,.txt,.json,.py,.csv,.yaml,.yml";
const stamp = (iso) => (iso ? new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) : "");
const size = (n) => (n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

/** Saves a text as a file in the browser — downloading the skill to keep or share. */
function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AiSkillsPage() {
  const dispatch = useAppDispatch();
  const { notify } = useNotifications();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.SKILLS_MANAGE);
  const { list, listStatus, current, currentStatus, versions, error } = useAppSelector((s) => s.aiSkills);

  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("instructions");
  const [content, setContent] = useState("");
  const [settings, setSettings] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // { reference } | { version } | "new" | { restore }
  const contentFile = useRef(null);
  const referenceFile = useRef(null);

  useEffect(() => {
    if (listStatus === "idle") dispatch(fetchSkills());
  }, [dispatch, listStatus]);

  useEffect(() => {
    if (error) notify(error, "danger");
  }, [error, notify]);

  // The active skill opens first.
  const shownId = selectedId ?? list.find((s) => s.isActive)?.id ?? list[0]?.id ?? null;
  useEffect(() => {
    if (shownId && current?.id !== shownId) dispatch(fetchSkill(shownId));
  }, [dispatch, shownId, current?.id]);

  // The editor starts from what was saved, and again after every save.
  useEffect(() => {
    if (!current) return;
    setContent(current.content ?? "");
    setSettings(current.settings ?? null);
    setNote("");
  }, [current]);

  useEffect(() => {
    if (tab === "history" && current?.id) dispatch(fetchSkillVersions(current.id));
  }, [dispatch, tab, current?.id, current?.version]);

  const contentDirty = current && content !== current.content;
  const settingsDirty = useMemo(() => current && settings && JSON.stringify(settings) !== JSON.stringify(current.settings), [current, settings]);
  const dirty = contentDirty || settingsDirty;

  const save = async () => {
    setSaving(true);
    try {
      const body = { note: note.trim() || undefined };
      if (contentDirty) body.content = content;
      if (settingsDirty) body.settings = settings;
      const saved = await dispatch(updateSkill({ id: current.id, body })).unwrap();
      notify(`Saved — ${saved.name} is now version ${saved.version}`);
    } catch (err) {
      notify(errText(err, "Could not save the skill."), "danger");
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file, target) => {
    if (!file) return;
    setSaving(true);
    try {
      const saved = await dispatch(uploadSkillFile({ id: current.id, file, target, note: note.trim() || undefined })).unwrap();
      notify(target === "content" ? `Instructions replaced from ${file.name} — version ${saved.version}` : `${file.name} saved — version ${saved.version}`);
    } catch (err) {
      notify(errText(err, "Could not upload the file."), "danger");
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    try {
      await dispatch(updateSkill({ id: current.id, body: { isActive: true, note: "Made the active proposal skill" } })).unwrap();
      notify(`${current.name} is now the skill proposals use`);
    } catch (err) {
      notify(errText(err, "Could not activate the skill."), "danger");
    }
  };

  const resetSettings = async () => {
    try {
      await dispatch(resetSkillSettings(current.id)).unwrap();
      notify("Calculator settings reset to the defaults");
    } catch (err) {
      notify(errText(err, "Could not reset the settings."), "danger");
    }
  };

  return (
    <>
      <PageHeader
        title="AI skills"
        description="The instructions the AI follows when it drafts a commercial Solar + BESS proposal, the reference files it reads with them, and the calculator's prices and rules. Changes apply to the next proposal drafted; every save is kept as a version."
        actions={
          canManage ? (
            <button type="button" className="btn btn-ghost" onClick={() => setModal("new")}>
              <Plus size={16} /> Skill
            </button>
          ) : null
        }
      />
      <AdminNav />

      {listStatus === "loading" && !list.length ? (
        <div className="card card-pad">
          <LoadingState label="Loading the AI skills…" />
        </div>
      ) : !list.length ? (
        <div className="card card-pad">
          <EmptyState icon={<Sparkles size={28} strokeWidth={1.5} />} title="No AI skills yet" body="Run the database migrations — they add the Prestige proposal skill." />
        </div>
      ) : (
        <>
          {list.length > 1 ? (
            <div className="segmented" style={{ marginBottom: 16 }}>
              {list.map((s) => (
                <button key={s.id} type="button" className={s.id === shownId ? "active" : ""} onClick={() => setSelectedId(s.id)} disabled={dirty}>
                  {s.name} {s.isActive ? "· active" : ""}
                </button>
              ))}
            </div>
          ) : null}

          {!current || currentStatus === "loading" ? (
            <div className="card card-pad">
              <LoadingState label="Opening the skill…" />
            </div>
          ) : (
            <div className="card card-pad">
              <div className="skill-head">
                <div>
                  <div className="row-title" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {current.name}
                    <Badge tone={current.isActive ? "success" : "neutral"}>{current.isActive ? "in use" : "inactive"}</Badge>
                    <Badge tone="info">version {current.version}</Badge>
                  </div>
                  {current.description ? <p className="row-meta" style={{ maxWidth: "70ch" }}>{current.description}</p> : null}
                  <div className="row-meta">
                    {current.updatedBy ? `Last saved by ${current.updatedBy.name}, ` : "Last saved "}
                    {stamp(current.updatedAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText(`${current.key}.md`, current.content)}>
                    <Download size={14} /> Download SKILL.md
                  </button>
                  {canManage && !current.isActive ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={activate} disabled={dirty}>
                      Use for proposals
                    </button>
                  ) : null}
                </div>
              </div>

              {!canManage ? (
                <Alert tone="info" style={{ margin: "12px 0" }}>
                  You can read this skill. Changing it needs the &ldquo;Manage AI skills&rdquo; permission.
                </Alert>
              ) : null}

              <Tabs
                value={tab}
                onChange={setTab}
                items={[
                  { key: "instructions", label: "Instructions", icon: <FileText size={14} /> },
                  { key: "references", label: "Reference files", icon: <BookOpen size={14} />, count: current.references.length },
                  { key: "settings", label: "Calculator settings", icon: <Settings2 size={14} /> },
                  { key: "history", label: "History", icon: <History size={14} /> },
                ]}
              />

              {tab === "instructions" ? (
                <div className="panel">
                  <p className="row-meta" style={{ marginBottom: 10 }}>
                    The skill&apos;s main text (its SKILL.md), sent to the AI with every proposal draft. Markdown. The CRM&apos;s calculator works out the figures itself, so instructions to run scripts or build documents are read as background only.
                  </p>
                  <textarea
                    className="skill-editor"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    readOnly={!canManage}
                    spellCheck={false}
                    aria-label="Skill instructions"
                  />
                  <div className="row-meta" style={{ marginTop: 6 }}>
                    {content.length.toLocaleString()} characters
                    {contentDirty ? " · unsaved changes" : ""}
                  </div>
                  {canManage ? (
                    <div style={{ marginTop: 10 }}>
                      <input ref={contentFile} type="file" accept={FILE_TYPES} hidden onChange={(e) => upload(e.target.files?.[0], "content").finally(() => (e.target.value = ""))} />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => contentFile.current?.click()} disabled={saving || dirty} title={dirty ? "Save or undo your changes first" : undefined}>
                        <Upload size={14} /> Replace from a file (.md)
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === "references" ? (
                <div className="panel">
                  <p className="row-meta" style={{ marginBottom: 10 }}>
                    Files the AI reads with the instructions — references/methodology.md, worked examples (JSON), calc.py. Text files only, up to 300,000 characters each.
                  </p>
                  {current.references.length ? (
                    <div className="table-wrap">
                      <table className="table stack">
                        <thead>
                          <tr>
                            <th>File</th>
                            <th>Size</th>
                            <th>Added</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {current.references.map((ref) => (
                            <tr key={ref.name}>
                              <td data-label="File">
                                <div className="row-title">{ref.name}</div>
                              </td>
                              <td data-label="Size">{size(ref.size)}</td>
                              <td data-label="Added">
                                {stamp(ref.uploadedAt)}
                                {ref.uploadedBy ? <div className="row-meta">{ref.uploadedBy}</div> : null}
                              </td>
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ reference: ref.name })}>
                                  {canManage ? "View / edit" : "View"}
                                </button>{" "}
                                {canManage ? (
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={async () => {
                                      try {
                                        await dispatch(removeSkillReference({ id: current.id, name: ref.name })).unwrap();
                                        notify(`${ref.name} removed`, "info");
                                      } catch (err) {
                                        notify(errText(err, "Could not remove the file."), "danger");
                                      }
                                    }}
                                    aria-label={`Remove ${ref.name}`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState title="No reference files" body="Add references/methodology.md and the worked examples so the AI has the full formulas and past proposals." />
                  )}
                  {canManage ? (
                    <div style={{ marginTop: 12 }}>
                      <input ref={referenceFile} type="file" accept={FILE_TYPES} hidden onChange={(e) => upload(e.target.files?.[0], "reference").finally(() => (e.target.value = ""))} />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => referenceFile.current?.click()} disabled={saving || dirty}>
                        <Upload size={14} /> Add a reference file
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === "settings" && settings ? (
                <div className="panel">
                  <Alert tone="info" style={{ marginBottom: 14 }}>
                    The calculator works out every price, incentive, payment option, saving and payback from these settings — the AI never does the arithmetic. A draft proposal picks up a change straight away; a final proposal keeps the figures it was finalised with.
                  </Alert>
                  <SkillSettingsForm value={settings} onChange={setSettings} disabled={!canManage} />
                  {canManage ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={resetSettings} disabled={dirty} style={{ marginTop: 12 }}>
                      <RotateCcw size={14} /> Reset settings to the defaults
                    </button>
                  ) : null}
                </div>
              ) : null}

              {tab === "history" ? (
                <div className="panel">
                  <div className="table-wrap">
                    <table className="table stack">
                      <thead>
                        <tr>
                          <th>Version</th>
                          <th>What changed</th>
                          <th>Saved</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((v) => (
                          <tr key={v.id}>
                            <td data-label="Version">
                              {v.version} {v.current ? <Badge tone="success">current</Badge> : null}
                            </td>
                            <td data-label="What changed">{v.note || "—"}</td>
                            <td data-label="Saved">
                              {stamp(v.at)}
                              {v.editedBy ? <div className="row-meta">{v.editedBy.name}</div> : null}
                            </td>
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ version: v.version })}>
                                View
                              </button>{" "}
                              {canManage && !v.current ? (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ restore: v.version })} disabled={dirty}>
                                  Restore
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {canManage && (tab === "instructions" || tab === "settings") ? (
                <div className="skill-savebar">
                  <Field label="What changed" hint="kept with the version">
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. StarCharge price updated to $86,500" maxLength={500} />
                  </Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!dirty || saving}
                      onClick={() => {
                        setContent(current.content);
                        setSettings(current.settings);
                      }}
                    >
                      Undo changes
                    </button>
                    <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
                      <Save size={16} /> {saving ? "Saving…" : "Save as new version"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {modal?.reference ? <ReferenceModal skill={current} name={modal.reference} canManage={canManage} onClose={() => setModal(null)} /> : null}
      {modal?.version ? <VersionModal skill={current} version={modal.version} onClose={() => setModal(null)} /> : null}
      {modal?.restore ? (
        <Modal
          title={`Restore version ${modal.restore}?`}
          confirmClose={false}
          body={`Version ${modal.restore}'s instructions, reference files and settings become the current skill, saved as a new version. Nothing is deleted — the current version stays in the history.`}
          onClose={() => setModal(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const saved = await dispatch(restoreSkillVersion({ id: current.id, version: modal.restore })).unwrap();
                    notify(`Version ${modal.restore} restored as version ${saved.version}`);
                  } catch (err) {
                    notify(errText(err, "Could not restore the version."), "danger");
                  } finally {
                    setModal(null);
                  }
                }}
              >
                Restore
              </button>
            </>
          }
        />
      ) : null}
      {modal === "new" ? (
        <NewSkillModal
          from={current}
          onClose={() => setModal(null)}
          onCreated={(skill) => {
            setSelectedId(skill.id);
            setModal(null);
          }}
        />
      ) : null}
    </>
  );
}

function ReferenceModal({ skill, name, canManage, onClose }) {
  const dispatch = useAppDispatch();
  const { notify } = useNotifications();
  const [ref, setRef] = useState(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchSkillReference({ id: skill.id, name }))
      .unwrap()
      .then((r) => {
        setRef(r);
        setText(r.content);
      })
      .catch((err) => notify(errText(err, "Could not open the file."), "danger"));
  }, [dispatch, skill.id, name, notify]);

  return (
    <Modal
      title={name}
      className="document"
      confirmClose={Boolean(ref && text !== ref.content)}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => ref && downloadText(name, ref.content)} disabled={!ref}>
            <Download size={14} /> Download
          </button>
          {canManage ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!ref || text === ref.content || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const saved = await dispatch(updateSkillReference({ id: skill.id, name, body: { content: text } })).unwrap();
                  notify(`${name} saved — version ${saved.version}`);
                  onClose();
                } catch (err) {
                  notify(errText(err, "Could not save the file."), "danger");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Save size={14} /> Save
            </button>
          ) : null}
        </>
      }
    >
      {ref ? <textarea className="skill-editor" value={text} onChange={(e) => setText(e.target.value)} readOnly={!canManage} spellCheck={false} /> : <LoadingState label="Opening…" />}
    </Modal>
  );
}

function VersionModal({ skill, version, onClose }) {
  const dispatch = useAppDispatch();
  const { notify } = useNotifications();
  const [data, setData] = useState(null);

  useEffect(() => {
    dispatch(fetchSkillVersion({ id: skill.id, version }))
      .unwrap()
      .then(setData)
      .catch((err) => notify(errText(err, "Could not open the version."), "danger"));
  }, [dispatch, skill.id, version, notify]);

  return (
    <Modal title={`Version ${version}`} className="document" confirmClose={false} onClose={onClose}>
      {data ? (
        <>
          <p className="row-meta">
            {data.note || "No note"} · {stamp(data.at)} · {data.references.length} reference file{data.references.length === 1 ? "" : "s"}
            {data.references.length ? `: ${data.references.map((r) => r.name).join(", ")}` : ""}
          </p>
          <textarea className="skill-editor" value={data.content} readOnly spellCheck={false} />
          <details style={{ marginTop: 10 }}>
            <summary className="row-meta" style={{ cursor: "pointer" }}>
              Calculator settings in this version
            </summary>
            <pre className="skill-json">{JSON.stringify(data.settings, null, 2)}</pre>
          </details>
        </>
      ) : (
        <LoadingState label="Opening…" />
      )}
    </Modal>
  );
}

function NewSkillModal({ from, onClose, onCreated }) {
  const dispatch = useAppDispatch();
  const { notify } = useNotifications();
  const [form, setForm] = useState({ key: "", name: "", description: "", copy: true });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setSaving(true);
    setError("");
    try {
      const content = file ? await file.text() : form.copy && from ? from.content : "";
      const skill = await dispatch(
        createSkill({ key: form.key, name: form.name, description: form.description, content, settings: form.copy && from ? from.settings : undefined }),
      ).unwrap();
      notify(`${skill.name} created — it is inactive until you choose "Use for proposals"`);
      onCreated(skill);
    } catch (err) {
      setError(errText(err, "Could not create the skill."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New AI skill"
      body="A new skill starts inactive, so you can prepare it without changing the proposals being drafted. Upload its SKILL.md, or start from a copy of the current skill."
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={create} disabled={saving || !form.key.trim() || !form.name.trim() || (!file && !form.copy)}>
            {saving ? "Creating…" : "Create"}
          </button>
        </>
      }
    >
      {error ? <Alert tone="danger" style={{ marginBottom: 12 }}>{error}</Alert> : null}
      <div className="form-grid">
        <Field label="Name" required>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Proposal calculator 2027" />
        </Field>
        <Field label="Key" required hint="lowercase, permanent">
          <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="energy-proposal-2027" />
        </Field>
        <Field label="Description" className="span-2">
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="SKILL.md" className="span-2" hint={file ? file.name : "optional"}>
          <input type="file" accept={FILE_TYPES} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        {!file && from ? (
          <label className="span-2" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={form.copy} onChange={(e) => setForm({ ...form, copy: e.target.checked })} /> Start from a copy of {from.name} (instructions and settings)
          </label>
        ) : null}
      </div>
    </Modal>
  );
}

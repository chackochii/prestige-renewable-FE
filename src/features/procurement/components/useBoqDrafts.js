// Unsaved edits to a job's BOQ lines, as typed, and sending them. Shared by
// the BOQ vs site tab (site quantities, inventory) and the supplier-quote tab
// (supplier, availability, quoted price) — both save through
// procurementApi.saveBoq, which returns the whole job.

import { useEffect, useState } from "react";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

export function useBoqDrafts(job, onSave) {
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A different job: start from what its record says. Not on every copy of the
  // job that comes back — any save returns the whole job (ticking a checklist
  // item included), and resetting then threw away what was typed but not yet
  // saved. Drafts are cleared when they are sent.
  useEffect(() => {
    setDrafts({});
    setError("");
  }, [job?.id]);

  const edit = (key, field, value) => setDrafts((d) => ({ ...d, [key]: { ...(d[key] ?? {}), [field]: value } }));
  const valueOf = (line, field) => (drafts[line.key]?.[field] !== undefined ? drafts[line.key][field] : (line[field] ?? ""));
  const changed = Object.entries(drafts).map(([key, fields]) => ({ key, ...fields }));
  const forget = (key) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });

  const submit = async (body, after) => {
    setBusy(true);
    setError("");
    try {
      await onSave?.(body);
      after?.();
    } catch (err) {
      setError(errText(err, "The BOQ could not be saved."));
    } finally {
      setBusy(false);
    }
  };
  // What was typed went with the save, so the table reads the record again.
  const sent = () => setDrafts({});
  const save = () => submit({ lines: changed }, sent);

  // Autosave: a pause in typing sends what changed. The Save button stays for
  // anyone who wants it now; adding, removing and revising lines carry the
  // drafts with them as before.
  useEffect(() => {
    if (!changed.length || busy || !onSave) return undefined;
    const timer = setTimeout(() => {
      // Only what went out is cleared: anything typed while the save was on its way stays, for the next one.
      const snapshot = drafts;
      submit({ lines: changed }, () =>
        setDrafts((current) =>
          Object.fromEntries(Object.entries(current).filter(([key, fields]) => JSON.stringify(fields) !== JSON.stringify(snapshot[key]))),
        ),
      );
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-armed by each edit
  }, [drafts, busy]);

  return { edit, valueOf, changed, forget, submit, sent, save, busy, error, setError };
}

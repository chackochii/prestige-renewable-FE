// Lead-pack drafts: what someone has typed into a lead's form but not saved,
// kept in this browser (localStorage) so a refresh or a dropped connection
// does not lose it. Keystrokes are not sent to the API.
//
// A draft holds customer details — names, phone, email, address — so drafts
// do not outlive the session: every one is cleared when the session ends in
// this browser (tokenStore.clearSession — signing out, the session expiring,
// the API refusing it), and the next person on the computer finds none.
//
// Storage can be unavailable (private browsing, full), so every access is
// allowed to fail quietly — the form still works, it just has nothing to
// restore.

export const LEAD_DRAFT_PREFIX = "lead-draft:";

const keyOf = (id) => `${LEAD_DRAFT_PREFIX}${id}`;

/**
 * The draft for this lead, or null. Only a draft taken against the version of
 * the record on screen now is restored: anything older is stale and would
 * undo somebody else's edit.
 */
export function readLeadDraft(opp) {
  try {
    const saved = JSON.parse(localStorage.getItem(keyOf(opp?.id)) || "null");
    return saved && saved.updatedAt === opp?.updatedAt ? saved.form : null;
  } catch {
    return null;
  }
}

/** Keeps what is typed, stamped with the version of the record it was typed against. */
export function writeLeadDraft(opp, form) {
  try {
    localStorage.setItem(keyOf(opp?.id), JSON.stringify({ updatedAt: opp?.updatedAt, form }));
  } catch {
    // Not kept — the form still works.
  }
}

/** One lead's draft, once it is saved. */
export function clearLeadDraft(id) {
  try {
    localStorage.removeItem(keyOf(id));
  } catch {
    // Nothing to clear.
  }
}

/** Every lead's draft in this browser — the session is ending. */
export function clearAllLeadDrafts() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LEAD_DRAFT_PREFIX)) keys.push(key);
    }
    // Collected first: removing while walking the keys shifts their indexes.
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage unavailable — there were no drafts to keep either.
  }
}

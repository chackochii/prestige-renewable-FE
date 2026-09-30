// A submitted pre-site inspection (CL-04) as the coordinator and estimator read
// it: the form's sections and numbering, ticks as Yes/No, the signature as the
// drawn image, dates as dates — plus any extra questions the coordinator
// added. Items nobody answered say so rather than disappearing, so a gap in
// the inspection is visible.

import Badge from "@/components/Badge";
import { FORM_KEYS, INSPECTION_SECTIONS, ITEM_NUMBERS } from "@/constants/inspectionReport";
import { formatDate } from "@/helpers/dateTimeHelpers";

const AUTO_KEYS = ["submittedOn", "signedBy"];
const blank = (value) => value === undefined || value === null || String(value).trim() === "";

function Answer({ field, value, timeZone }) {
  if (field.kind === "checkbox") return value === true ? <Badge tone="success">Yes</Badge> : <Badge tone="neutral">No</Badge>;
  if (blank(value)) return <span className="row-meta">Not answered</span>;
  if (field.kind === "signature")
    return /^data:image\/png;base64,/.test(value) ? (
      <img src={value} alt="Signature" className="inspection-signature" />
    ) : (
      <span className="row-meta">Signed</span>
    );
  if (field.kind === "date" || field.kind === "auto") return <span>{formatDate(value, { timeZone })}</span>;
  return <span style={{ whiteSpace: "pre-wrap" }}>{String(value)}</span>;
}

export default function InspectionReportView({ response, requestedFields = [], submittedAt, timeZone }) {
  const answers = response?.fields || {};
  const extra = requestedFields.filter((f) => !FORM_KEYS.has(f.key) && !AUTO_KEYS.includes(f.key));

  return (
    <div className="inspection-report">
      {INSPECTION_SECTIONS.map((section) => {
        const fields = section.fields.filter((f) => f.kind !== "files" && f.key !== "__job");
        if (!fields.length) return null;
        return (
          <div key={section.key} className="inspection-report-section">
            <h4>{section.title}</h4>
            <div className="list-stack">
              {fields.map((field) => (
                <div className="list-row" key={field.key} style={{ alignItems: "flex-start" }}>
                  <span className="row-title" style={{ minWidth: 0 }}>
                    <span className="row-meta">{ITEM_NUMBERS[field.key]}.</span> {field.label}
                  </span>
                  <span style={{ textAlign: "right", maxWidth: "60%" }}>
                    <Answer field={field} value={field.key === "submittedOn" ? answers.submittedOn || submittedAt : answers[field.key]} timeZone={timeZone} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {extra.length ? (
        <div className="inspection-report-section">
          <h4>Also asked by the coordinator</h4>
          <div className="list-stack">
            {extra.map((field) => (
              <div className="list-row" key={field.key} style={{ alignItems: "flex-start" }}>
                <span className="row-title">{field.label}</span>
                <span style={{ textAlign: "right", maxWidth: "60%" }}>
                  <Answer field={field} value={answers[field.key]} timeZone={timeZone} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

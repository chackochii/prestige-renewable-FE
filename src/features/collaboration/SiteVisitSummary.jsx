// The site visit as everyone else sees it — the person who raised it most of
// all.
//
// A requester ticks items on the pre-site inspection checklist and then waits.
// Until now the detail modal showed them the progress log and nothing else:
// not the items they asked for, not who is going, not what came back. This is
// that, read-only, with no way to change anything.
//
// It works before the coordinator has responded too: the ticked items come
// off the request itself, so the requester can see what they asked for from
// the moment they ask.

import { Paperclip } from "lucide-react";
import Badge from "@/components/Badge";
import { documentTypeLabel, siteVisitStatusMeta, siteVisitTask } from "@/constants/collaboration";
import { SITE_PHOTOS_KEY, requesterItems } from "@/constants/inspectionReport";
import InspectionReportView from "@/features/collaboration/InspectionReportView";
import { formatDate, hasClockTime } from "@/helpers/dateTimeHelpers";

const asList = (value) => (Array.isArray(value) ? value : []);

/** What the person attending is given for an item, in plain words. */
const KIND_HINT = {
  textarea: "long answer",
  number: "number",
  date: "date",
  checkbox: "tick box",
  signature: "signature",
};

export default function SiteVisitSummary({ request, timeZone }) {
  const task = siteVisitTask(request);
  const asked = requesterItems(request);
  const askedKeys = new Set(asked.map((f) => f.key));
  // Once the coordinator has saved a form, that list is what is actually being
  // asked; before then, the requester's own ticks are.
  const saved = asList(task?.requestedFields);
  const items = saved.length ? saved : asked;
  const documents = asList(task?.requestedDocuments);
  const photos = asList(task?.photos);
  const submitted = Boolean(task?.submittedAt || task?.status === "submitted");

  if (!items.length && !documents.length && !task) return null;

  return (
    <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
      <div className="estimation-item-head">
        <h3>Site visit</h3>
        {task ? <Badge tone={siteVisitStatusMeta(task).tone}>{siteVisitStatusMeta(task).label}</Badge> : null}
      </div>

      {task ? (
        <dl className="detail-strip">
          <div>
            <dt>Attending</dt>
            <dd>{task.assigneeName || "Not assigned yet"}</dd>
          </div>
          <div>
            <dt>Scheduled</dt>
            <dd>
              {request.scheduledFor
                ? formatDate(request.scheduledFor, { withTime: hasClockTime(request.scheduledFor), timeZone })
                : "Not yet"}
            </dd>
          </div>
          {task.submittedAt ? (
            <div>
              <dt>Submitted</dt>
              <dd>{formatDate(task.submittedAt, { withTime: true, timeZone })}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="lede" style={{ marginBottom: 12 }}>
          Operations has not sent the form out yet. These are the items it will ask for.
        </p>
      )}

      {items.length ? (
        <>
          <h4 style={{ marginBottom: 8 }}>Information requested</h4>
          <div className="list-stack">
            {items.map((field) => (
              <div className="list-row" key={field.key}>
                <span className="row-title">{field.label}</span>
                <span className="row-meta">
                  {askedKeys.has(field.key) ? "from your checklist" : KIND_HINT[field.kind] || "short answer"}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {documents.length ? (
        <>
          <h4 style={{ margin: "16px 0 8px" }}>Photos requested</h4>
          <div className="list-stack">
            {documents.map((doc) => {
              const supplied = photos.filter((p) => p.documentKey === doc.key).length;
              return (
                <div className="list-row" key={doc.key}>
                  <span className="row-lines">
                    <span className="row-title">{doc.label}</span>
                    {doc.comment ? <span className="row-meta">{doc.comment}</span> : null}
                  </span>
                  <Badge tone={supplied ? "success" : "warning"}>
                    {supplied ? `${supplied} supplied` : documentTypeLabel(doc.type)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {submitted ? (
        <InspectionReportView
          response={task?.response}
          requestedFields={saved}
          submittedAt={task?.submittedAt}
          timeZone={timeZone}
        />
      ) : null}

      {photos.length ? (
        <>
          <h4 style={{ margin: "16px 0 8px" }}>Photos from site</h4>
          <div className="site-photo-grid">
            {photos.map((file) => {
              const slot = documents.find((d) => d.key === file.documentKey);
              const isImage = /\.(png|jpe?g|gif|webp|heic|avif)$/i.test(file.filename || "") || slot?.type === "image";
              return (
                <figure key={file.id} className="site-photo">
                  <a href={file.url} target="_blank" rel="noreferrer" title={`Open ${file.filename}`}>
                    {isImage && file.url ? (
                      <img src={file.url} alt={slot?.label || file.filename} loading="lazy" />
                    ) : (
                      <span className="site-photo-file">
                        <Paperclip size={18} />
                      </span>
                    )}
                  </a>
                  <figcaption>
                    <span className="row-title" title={file.filename}>
                      {slot ? slot.label : file.documentKey === SITE_PHOTOS_KEY ? "Site photos" : "Extra"}
                    </span>
                    <span className="row-meta">{file.filename}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

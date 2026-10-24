// Every file on a job in one place: what sales attached on the lead, what
// estimation collected, client documents filed from a request, and the
// supplier quotes, purchase orders and delivery receipts procurement added.
// The stage screens each show only their own slots; this tab shows them all.
//
// Each file opens from its address in the DigitalOcean Space — the `url`
// prestige-be keeps on the document row (storage_url) — so links work from
// anywhere and do not expire. Photos show as thumbnails, everything else as a
// row.

import { useEffect } from "react";
import { ExternalLink, FolderOpen, Paperclip } from "lucide-react";
import Alert from "@/components/Alert";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import SectionHead from "@/components/SectionHead";
import { stageById } from "@/constants/stages";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchOpportunityAttachments } from "@/slices/leadsSlice";

/** The attachment categories prestige-be files documents under, in the order a job collects them. */
const CATEGORIES = [
  { key: "bill", label: "Electricity bills" },
  { key: "photo", label: "Site photos" },
  { key: "sketch", label: "Sketches & drawings" },
  { key: "document", label: "Lead documents" },
  { key: "client_document", label: "Client documents" },
  { key: "supplier_quote", label: "Supplier quotes" },
  { key: "purchase_order", label: "Purchase orders" },
  { key: "delivery_receipt", label: "Delivery receipts" },
  { key: "other", label: "Other documents" },
];

const isImage = (file) => /^image\//.test(file.mime || "") || /\.(png|jpe?g|gif|webp|heic|avif|bmp)$/i.test(file.filename || "");

/** "1.4 MB · Jane Smith · 12 Oct 2026 · Estimation" */
const metaOf = (file, timeZone) =>
  [file.size, file.uploaderName, file.createdAt ? formatDate(file.createdAt, { timeZone }) : null, file.stage ? stageById(file.stage)?.label : null]
    .filter(Boolean)
    .join(" · ");

export default function JobDocuments({ opp, timeZone }) {
  const dispatch = useAppDispatch();
  const { attachments, attachmentsStatus, attachmentsError } = useAppSelector((s) => s.leads);

  // Asked again whenever the tab opens, so files added on another screen show.
  useEffect(() => {
    if (opp?.id) dispatch(fetchOpportunityAttachments(opp.id));
  }, [opp?.id, dispatch]);

  const files = Array.isArray(attachments) ? attachments.filter((file) => Number(file.opportunityId) === Number(opp?.id)) : [];
  const known = new Set(CATEGORIES.map((c) => c.key));
  const groups = CATEGORIES.map((category) => ({
    ...category,
    files: files.filter((file) => (known.has(file.category) ? file.category : "other") === category.key),
  })).filter((group) => group.files.length);

  if (attachmentsStatus === "failed" && !files.length)
    return (
      <div className="card card-pad">
        <Alert tone="danger">{attachmentsError || "The job's documents could not be loaded."}</Alert>
      </div>
    );
  if (attachmentsStatus === "loading" && !files.length)
    return (
      <div className="card card-pad">
        <LoadingState label="Loading documents…" />
      </div>
    );
  if (!files.length)
    return (
      <div className="card card-pad">
        <EmptyState
          icon={<FolderOpen size={28} strokeWidth={1.5} />}
          title="No documents yet"
          body="Bills, photos, drawings and documents attached anywhere on this job appear here."
        />
      </div>
    );

  return (
    <div className="card card-pad">
      <p className="sub" style={{ marginTop: 0 }}>
        {files.length} file{files.length === 1 ? "" : "s"} attached to this job, from lead capture on. Each opens from where it is stored.
      </p>
      {groups.map((group) => (
        <div key={group.key} style={{ marginTop: 18 }}>
          <SectionHead icon={<Paperclip size={13} />} title={`${group.label} (${group.files.length})`} />
          {group.files.some(isImage) ? (
            <div className="site-photo-grid">
              {group.files.filter(isImage).map((file) => (
                <figure key={file.id} className="site-photo">
                  <a href={file.url} target="_blank" rel="noreferrer" title={`Open ${file.filename}`}>
                    <img src={file.url} alt={file.filename} loading="lazy" />
                  </a>
                  <figcaption>
                    <span className="row-title" title={file.filename}>
                      {file.filename}
                    </span>
                    <span className="row-meta">{metaOf(file, timeZone)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          {group.files.some((file) => !isImage(file)) ? (
            <div className="list-stack" style={{ marginTop: 10 }}>
              {group.files
                .filter((file) => !isImage(file))
                .map((file) => (
                  <div key={file.id} className="list-row">
                    <span className="row-lines">
                      <a className="row-title" href={file.url} target="_blank" rel="noreferrer" title={`Open ${file.filename}`}>
                        {file.filename}
                      </a>
                      <span className="row-meta">{metaOf(file, timeZone)}</span>
                    </span>
                    <a className="btn btn-ghost btn-sm" href={file.url} target="_blank" rel="noreferrer">
                      <ExternalLink size={13} /> Open
                    </a>
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

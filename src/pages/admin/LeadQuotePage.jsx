// Quotes → New quote → a lead: its quote, built from the electricity bill
// uploaded on the lead. Only once the Leads stage is completed (the lead is in
// Estimation). A lead with no bill asks for one first; it is filed on the lead. The same QuoteBuilder the Estimation tab uses, so the quote is the
// job's one quote - estimation carries on from it.

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Zap } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import FileDropzone from "@/components/FileDropzone";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import Alert from "@/components/Alert";
import QuoteBuilder from "@/features/pipeline/QuoteBuilder";
import { PERMISSIONS } from "@/constants/permissions";
import { stageById } from "@/constants/stages";
import { oppTitle } from "@/helpers/opportunity";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useAppDispatch, useAppSelector } from "@/store";
import { clearSelected, fetchOpportunity, fetchOpportunityAttachments, fetchOpportunityQuote, uploadOpportunityAttachment } from "@/slices/leadsSlice";
import { useNotifications } from "@/hooks/useNotifications";

export default function LeadQuotePage() {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const { hasPermission } = useAuth();
  const { unit } = useBusinessUnit();
  const { selected: opp, selectedStatus, selectedError, attachments, attachmentsStatus } = useAppSelector((s) => s.leads);
  const { notify, error: notifyError } = useNotifications();
  const [uploading, setUploading] = useState(false);

  // The bill is filed on the lead itself (category "bill"), so it shows in the
  // lead form's electricity bills and ticks that checklist row too.
  const uploadBills = async (files) => {
    setUploading(true);
    try {
      for (const file of files) await dispatch(uploadOpportunityAttachment({ id: opp.id, category: "bill", file })).unwrap();
      notify("Electricity bill uploaded to the lead");
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not upload the bill.");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    dispatch(fetchOpportunity(id));
    dispatch(fetchOpportunityQuote(id));
    dispatch(fetchOpportunityAttachments(id));
    return () => {
      dispatch(clearSelected());
    };
  }, [id, dispatch]);

  if (selectedStatus === "loading" || (selectedStatus === "idle" && !opp)) return <LoadingState label="Loading the lead…" />;
  if (!opp || String(opp.id) !== String(id)) {
    return (
      <div className="card card-pad">
        <EmptyState
          title="Lead not found"
          body={selectedError || "It may belong to another business unit, or you may not have access."}
          action={
            <Link to="/quotes" className="btn btn-primary">
              Back to quotes
            </Link>
          }
        />
      </div>
    );
  }

  // The Leads stage must be completed before a lead is quoted.
  if (Number(opp.stage) < 2) {
    return (
      <div className="card card-pad">
        <EmptyState
          title="Complete the Leads stage first"
          body={`${opp.number} is still at the Leads stage. Finish the lead form, mark it Potential and assign an estimator - once it moves to Estimation it can be quoted.`}
          action={
            <Link to={`/opportunities/${opp.id}`} className="btn btn-primary">
              Open the lead
            </Link>
          }
        />
      </div>
    );
  }

  const bills = attachments.filter((a) => a.category === "bill");
  const hasBill = bills.length > 0;
  const canEdit = hasPermission(PERMISSIONS.ESTIMATION_UPDATE);
  // What the API lets upload an attachment (prestige-be POST /:id/attachments).
  const canUpload = [PERMISSIONS.LEADS_UPDATE, PERMISSIONS.ESTIMATION_UPDATE].some((code) => hasPermission(code));

  return (
    <>
      <Link to="/quotes" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
        Quotes
      </Link>
      <PageHeader
        title={`Quote · ${oppTitle(opp)}`}
        description={`${opp.number} · ${stageById(opp.stage).label}. Build it from the electricity bill; the quote stays on the job for estimation.`}
        actions={
          <Link to={`/opportunities/${opp.id}`} className="btn btn-ghost">
            Open the job
          </Link>
        }
      />
      {attachmentsStatus === "loading" && !attachments.length ? (
        <LoadingState label="Checking the lead's electricity bills…" />
      ) : !hasBill ? (
        // A quote is built from the bill: ask for it first.
        <div className="card card-pad">
          <div className="card-head">
            <span className="card-icon">
              <Zap size={16} />
            </span>
            <h2>Upload the electricity bill</h2>
          </div>
          <p className="sub">
            This lead has no electricity bill yet. Upload it here - it is saved on the lead (Electricity bills on the lead form) and the quote opens.
          </p>
          {canUpload ? (
            <FileDropzone files={bills} onSelect={uploadBills} uploading={uploading} />
          ) : (
            <Alert tone="info">Uploading a bill needs the "Update Leads" or "Update Estimation" permission.</Alert>
          )}
        </div>
      ) : (
        <>
          {!canEdit ? <Alert tone="info">You can view this quote. Building it needs the "Update Estimation" permission.</Alert> : null}
          <div className="card card-pad">
            <QuoteBuilder opp={opp} unit={unit} canEdit={canEdit} />
          </div>
        </>
      )}
    </>
  );
}

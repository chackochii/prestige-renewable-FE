// Client meeting & site visit attachments: site photos and sketches only.
// Rendered as LeadForm's clientMeetingSlot — the section heading/description
// live in LeadForm, right after the "Need client visit" checkbox.

import { useEffect, useState } from "react";
import FileDropzone from "@/components/FileDropzone";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchOpportunityAttachments, uploadOpportunityAttachment } from "@/slices/leadsSlice";
import { useNotifications } from "@/hooks/useNotifications";

export default function ClientMeetingPanel({ opp, canEdit }) {
  const dispatch = useAppDispatch();
  const { error: notifyError } = useNotifications();
  const { attachments } = useAppSelector((s) => s.leads);
  const [uploading, setUploading] = useState({ photo: false, sketch: false });

  useEffect(() => {
    if (opp?.id) dispatch(fetchOpportunityAttachments(opp.id));
  }, [opp?.id, dispatch]);

  const photos = attachments.filter((a) => a.category === "photo");
  const sketches = attachments.filter((a) => a.category === "sketch");

  const upload = (category) => async (files) => {
    setUploading((u) => ({ ...u, [category]: true }));
    try {
      for (const file of files) {
        // Sequential: keeps upload order predictable and avoids flooding the API.
        await dispatch(uploadOpportunityAttachment({ id: opp.id, category, file })).unwrap();
      }
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not upload the file.");
    } finally {
      setUploading((u) => ({ ...u, [category]: false }));
    }
  };

  return (
    <div>
      <p className="eyebrow">Site photos</p>
      <p className="lede" style={{ marginBottom: 12 }}>
        Photos from the site visit — access, electrical conditions, constraints.
      </p>
      <FileDropzone files={photos} onSelect={upload("photo")} disabled={!canEdit} uploading={uploading.photo} />

      <p className="eyebrow">Sketches &amp; drawings</p>
      <p className="lede" style={{ marginBottom: 12 }}>
        Hand sketches, plans or design outputs from the site visit.
      </p>
      <FileDropzone files={sketches} onSelect={upload("sketch")} disabled={!canEdit} uploading={uploading.sketch} />
    </div>
  );
}

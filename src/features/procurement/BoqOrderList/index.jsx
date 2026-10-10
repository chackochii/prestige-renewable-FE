// Under the CL-11 checklist: the PDF of the BOQ and BOS lines that are not in
// our inventory — what quotes are needed for. It opens once "BOQ changes
// approved before ordering" is signed, so the list is the approved BOQ.

import { useState } from "react";
import { FileDown } from "lucide-react";
import SectionHead from "@/components/SectionHead";
import { procurementChecklistOf } from "@/constants/procurementChecklists";
import { itemDone } from "@/helpers/checklist";
import { downloadBoqOrderList, orderListLines } from "@/helpers/boqOrderPdf";
import { answersOf, procurementContext } from "@/helpers/procurementChecklist";
import { useNotifications } from "@/hooks/useNotifications";

export default function BoqOrderList({ job }) {
  const { error: notifyError } = useNotifications();
  const [busy, setBusy] = useState(false);

  const section = procurementChecklistOf("boq");
  const item = section.items.find((entry) => entry.key === "changesApproved");
  const answers = answersOf(job?.checklist, "boq");
  const approved = itemDone(section, item, answers, procurementContext(job, job?.checklist ?? {}));
  const { materials, services } = orderListLines(job);

  const download = async () => {
    setBusy(true);
    try {
      await downloadBoqOrderList(job, { approvedDetails: answers[item.detailsKey] });
    } catch {
      notifyError("The quote list PDF could not be created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <SectionHead icon={<FileDown size={13} />} title="BOQ & BOS list for quotes" />
      <p className="row-meta" style={{ whiteSpace: "normal", marginBottom: 10 }}>
        {approved
          ? `${materials.length} material${materials.length === 1 ? "" : "s"} and ${services.length} service${services.length === 1 ? "" : "s"} not in our inventory to get quotes for — saved lines only.`
          : "Available once “BOQ changes approved before ordering” is signed above."}
      </p>
      <button type="button" className="btn btn-primary btn-sm" onClick={download} disabled={!approved || busy}>
        <FileDown size={14} /> {busy ? "Creating PDF…" : "Download list for quotes (PDF)"}
      </button>
    </div>
  );
}

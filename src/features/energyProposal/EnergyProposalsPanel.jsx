// Commercial Solar + BESS (+ EV) proposals on a job, in the Prestige template.
//
// "Draft with AI" sends the job's electricity bills and the estimator's
// instructions (e.g. "100 kW panels with a 100 kW hybrid inverter, $75k +
// GST, and a 266 kWh StarCharge battery, $89,500 + GST") to the AI with the
// admin's skill (Admin → AI skills). The AI fills in the calculator's input;
// the API works out every figure; the editor shows the workout to confirm
// before any PDF is made. "Start blank" opens a draft from what the job knows.
//
// Marking a proposal final saves it as the next version of the job's quote:
// "Send to proposal" can then hand it over in place of the manual quote, and
// sales sends the customer this PDF (helpers/invoice.js draws a version in the
// template it was made in). A job quoted in the quote builder sends that quote.
//
// Used on the job page (its own tab) and from the Quote Builder.

import { useEffect, useRef, useState } from "react";
import { FileText, Plus, Sparkles, Upload } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import Field from "@/components/Field";
import LoadingState from "@/components/LoadingState";
import EnergyProposalEditor, { BillChoice } from "./EnergyProposalEditor";
import { downloadEnergyProposal } from "@/helpers/energyProposalPdf";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppDispatch, useAppSelector } from "@/store";
import { uploadOpportunityAttachment } from "@/slices/leadsSlice";
import {
  closeEnergyProposal,
  createEnergyProposal,
  draftEnergyProposalWithAi,
  fetchEnergyProposal,
  fetchEnergyProposals,
  fetchProposalOptions,
} from "@/slices/energyProposalsSlice";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const money = (v) => (v == null ? "—" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(v));
const systemText = (s) => (s ? [s.nominalKwh ? `${s.nominalKwh} kWh` : null, s.solarKw ? `${s.solarKw} kW solar` : null, s.evChargers ? `${s.evChargers} EV` : null].filter(Boolean).join(" + ") : "");
const READABLE = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif";

export default function EnergyProposalsPanel({ opp, canEdit }) {
  const dispatch = useAppDispatch();
  const { notify } = useNotifications();
  const { list, listStatus, options, current, oppId } = useAppSelector((s) => s.energyProposals);
  const [composer, setComposer] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [chosen, setChosen] = useState(new Set());
  const [busy, setBusy] = useState(null); // "ai" | "blank" | "upload" | proposal id being opened / downloaded
  const [error, setError] = useState("");
  const uploadRef = useRef(null);

  useEffect(() => {
    dispatch(fetchEnergyProposals(opp.id));
    dispatch(fetchProposalOptions(opp.id));
  }, [dispatch, opp.id]);

  const readableBills = (options?.bills ?? []).filter((b) => b.readable);
  // The newest readable bills are ticked to start with.
  useEffect(() => {
    setChosen(new Set(readableBills.slice(0, 4).map((b) => b.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.bills?.length]);

  const shownCurrent = current && oppId === opp.id ? current : null;

  const open = async (id) => {
    setBusy(id);
    try {
      await dispatch(fetchEnergyProposal({ oppId: opp.id, id })).unwrap();
    } catch (err) {
      notify(errText(err, "Could not open the proposal."), "danger");
    } finally {
      setBusy(null);
    }
  };

  const download = async (id) => {
    setBusy(`dl${id}`);
    try {
      const full = await dispatch(fetchEnergyProposal({ oppId: opp.id, id })).unwrap();
      await downloadEnergyProposal(full);
      dispatch(closeEnergyProposal());
    } catch (err) {
      notify(errText(err, "Could not build the PDF."), "danger");
    } finally {
      setBusy(null);
    }
  };

  const draft = async () => {
    setBusy("ai");
    setError("");
    try {
      await dispatch(draftEnergyProposalWithAi({ oppId: opp.id, body: { instructions, documentIds: [...chosen] } })).unwrap();
      setComposer(false);
      setInstructions("");
      notify("Proposal drafted — check the workout and the open items before making the PDF");
    } catch (err) {
      setError(errText(err, "Could not draft the proposal."));
    } finally {
      setBusy(null);
    }
  };

  const blank = async () => {
    setBusy("blank");
    try {
      await dispatch(createEnergyProposal({ oppId: opp.id, body: {} })).unwrap();
    } catch (err) {
      notify(errText(err, "Could not start the proposal."), "danger");
    } finally {
      setBusy(null);
    }
  };

  const uploadBill = async (file) => {
    if (!file) return;
    setBusy("upload");
    try {
      const uploaded = await dispatch(uploadOpportunityAttachment({ id: opp.id, category: "bill", file })).unwrap();
      await dispatch(fetchProposalOptions(opp.id)).unwrap();
      setChosen((prev) => new Set([...prev, uploaded.id]));
      notify(`${file.name} added to the job's bills`);
    } catch (err) {
      notify(errText(err, "Could not upload the bill."), "danger");
    } finally {
      setBusy(null);
    }
  };

  if (shownCurrent) return <EnergyProposalEditor opp={opp} proposal={shownCurrent} options={options} canEdit={canEdit} onClose={() => dispatch(closeEnergyProposal())} />;

  return (
    <div className="card card-pad">
      <div className="ep-editor-head">
        <div>
          <div className="row-title">Solar + BESS proposals</div>
          <p className="row-meta" style={{ maxWidth: "72ch" }}>
            The commercial proposal PDF in the Prestige template — bills, system, price and incentives, payment options, savings and payback.
            {options?.skill ? ` Drafted to the "${options.skill.name}" skill (version ${options.skill.version}).` : ""}
          </p>
        </div>
        {canEdit && !composer ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setComposer(true)} disabled={!options?.aiConfigured || !options?.skill} title={!options?.aiConfigured ? "The AI is not set up on the server (GEMINI_API_KEY)" : undefined}>
              <Sparkles size={14} /> Draft with AI
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={blank} disabled={busy !== null}>
              <Plus size={14} /> {busy === "blank" ? "Starting…" : "Start blank"}
            </button>
          </div>
        ) : null}
      </div>

      {options && !options.aiConfigured ? (
        <Alert tone="info" style={{ marginTop: 12 }}>
          Drafting with AI needs GEMINI_API_KEY on the server. You can still start a blank proposal, enter the bill figures and system, and make the PDF.
        </Alert>
      ) : null}
      {options && !options.skill ? (
        <Alert tone="warning" style={{ marginTop: 12 }}>
          No active proposal skill — an administrator can set one on Admin → AI skills.
        </Alert>
      ) : null}

      {composer ? (
        <div className="ep-composer">
          {error ? (
            <Alert tone="danger" style={{ marginBottom: 12 }}>
              {error}
            </Alert>
          ) : null}
          {busy === "ai" ? (
            <LoadingState label="Reading the bills, choosing the system and working out the figures — this can take a minute…" />
          ) : (
            <>
              <Field label="Electricity bills to read" hint="the AI reads up to four">
                <BillChoice bills={readableBills} chosen={chosen} setChosen={setChosen} />
              </Field>
              <input ref={uploadRef} type="file" accept={READABLE} hidden onChange={(e) => uploadBill(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => uploadRef.current?.click()} disabled={busy !== null} style={{ marginBottom: 12 }}>
                <Upload size={14} /> {busy === "upload" ? "Uploading…" : "Upload a bill"}
              </button>
              <Field label="Instructions" hint="optional — system, prices, anything the AI should know">
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder={"e.g. 100 kW panels with 100 kW hybrid inverter ($75k + GST) and 266 kWh StarCharge battery ($89,500 + GST).\nLeave blank to let the skill size the system from the bills."}
                />
              </Field>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-primary" onClick={draft} disabled={busy !== null || (!chosen.size && !instructions.trim())}>
                  <Sparkles size={16} /> Draft proposal
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setComposer(false)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {listStatus === "loading" && !list.length ? (
          <LoadingState label="Loading proposals…" />
        ) : list.length === 0 ? (
          <EmptyState icon={<FileText size={28} strokeWidth={1.5} />} title="No proposals yet" body="Draft one with AI from the customer's bills, or start blank." />
        ) : (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Quote no.</th>
                  <th>System</th>
                  <th>Net incl. GST</th>
                  <th>Benefit / yr</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Quote no.">
                      <div className="row-title">
                        {p.number}
                        {p.revision > 1 ? ` · rev ${p.revision}` : ""}
                      </div>
                      <div className="row-meta">
                        {p.preparedOn}
                        {p.createdBy ? ` · ${p.createdBy.name}` : ""}
                      </div>
                    </td>
                    <td data-label="System">{systemText(p.system) || p.title}</td>
                    <td data-label="Net incl. GST">{money(p.netIncGst)}</td>
                    <td data-label="Benefit / yr">{p.annualBenefit ? `~${money(p.annualBenefit)}` : "—"}</td>
                    <td data-label="Status">
                      <Badge tone={p.status === "final" ? "success" : "warning"}>{p.status}</Badge>
                      {p.quoteVersion ? <div className="row-meta">quote version {p.quoteVersion.version} - sent from the proposal stage</div> : null}
                      {p.openItems && p.status !== "final" ? <div className="row-meta">{p.openItems} open item{p.openItems === 1 ? "" : "s"}</div> : null}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(p.id)} disabled={busy !== null}>
                        {busy === p.id ? "Opening…" : "Open"}
                      </button>{" "}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => download(p.id)} disabled={busy !== null}>
                        {busy === `dl${p.id}` ? "Building…" : "PDF"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// New lead capture.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Save } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Alert from "@/components/Alert";
import LeadForm from "@/features/leads/LeadForm";
import { emptyLeadForm, formToPayload, validateLeadForm } from "@/features/leads/leadFormModel";
import { useAppDispatch, useAppSelector } from "@/store";
import { createLead } from "@/slices/leadsSlice";
import { fetchReferrers } from "@/slices/referralsSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useNotifications } from "@/hooks/useNotifications";

export default function NewLeadPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { unit, unitId } = useBusinessUnit();
  const { estimators, sales } = useUnitUsers();
  const referrers = useAppSelector((s) => s.referrals.items);
  const referrersStatus = useAppSelector((s) => s.referrals.status);
  const { notify } = useNotifications();
  const [form, setForm] = useState(emptyLeadForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (referrersStatus === "idle") dispatch(fetchReferrers({ status: "active" }));
  }, [referrersStatus, dispatch]);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validateLeadForm(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setSaving(true);
    setSubmitError("");
    try {
      const created = await dispatch(createLead({ ...formToPayload(form), businessUnitId: unitId })).unwrap();
      notify(`Lead ${created.number} saved`);
      navigate(`/opportunities/${created.id}`);
    } catch (err) {
      setSubmitError(typeof err === "string" ? err : err?.message || "Could not save the lead.");
    } finally {
      setSaving(false);
    }
  };

  const errorList = [...new Set(Object.values(errors))];

  return (
    <>
      <Link to="/leads" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
        Back
      </Link>
      <PageHeader
        title="New lead"
        description={`Capture the lead in ${unit?.name ?? "this unit"}. It starts as Nurture — log a client meeting and attach site photos or sketches on the record before it can be marked Qualified and attached to the pipeline.`}
      />
      <form onSubmit={submit} className="card card-pad" noValidate>
        <LeadForm
          form={form}
          set={set}
          errors={errors}
          estimators={estimators}
          sales={sales}
          referrers={referrers}
          unit={unit}
          allowQualified={false}
          qualifiedHint="log a meeting and site evidence on the saved record first"
        />
        {errorList.length ? (
          <Alert tone="danger">
            Fix {errorList.length} {errorList.length === 1 ? "field" : "fields"} before saving.
            <ul>
              {errorList.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          <Save size={16} /> {saving ? "Saving…" : "Save lead"}
        </button>
      </form>
    </>
  );
}

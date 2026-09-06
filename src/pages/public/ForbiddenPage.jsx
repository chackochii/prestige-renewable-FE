// 403 inside the workspace. Explains what was needed when the guard says so.

import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchPermissions } from "@/slices/rolesSlice";
import { fetchMe } from "@/slices/authSlice";
import { SUPER_ROLE_CODE } from "@/constants/roles";

function describe(reason, permissions, roles) {
  if (!reason) return "Your roles do not include access to this page in this business unit.";
  if (reason.type === "page-disabled")
    return `${reason.page} is turned off for ${reason.unit || "this business unit"}. An administrator can enable it under Admin → Pages.`;
  if (reason.type === "role") {
    const names = (reason.roles || []).map((code) =>
      code === SUPER_ROLE_CODE ? "System Administrator" : roles.find((r) => r.code === code)?.name || code,
    );
    return `This screen is reserved for the ${names.join(" or ")} role.`;
  }
  if (reason.type === "permission") {
    const names = (reason.codes || []).map((code) => {
      const p = permissions.find((x) => x.code === code);
      return p ? `“${p.name}”` : `“${code}”`;
    });
    const what = reason.page ? `${reason.page} needs` : "This needs";
    return names.length
      ? `${what} the ${names.join(" or ")} permission. Ask an administrator to add it to one of your roles.`
      : "You don't hold the permission this screen needs.";
  }
  return "Your roles do not include access to this page.";
}

export default function ForbiddenPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions, permissionsStatus, roles } = useAppSelector((s) => s.roles);
  const reason = location.state?.reason || null;
  const from = location.state?.from?.pathname;

  useEffect(() => {
    if (reason?.type === "permission" && permissionsStatus === "idle") dispatch(fetchPermissions());
  }, [reason, permissionsStatus, dispatch]);

  return (
    <div className="card card-pad">
      <EmptyState
        icon={<ShieldCheck size={28} strokeWidth={1.5} />}
        title="Access denied"
        body={`${from ? `You tried to open ${from}. ` : ""}${describe(reason, permissions, roles)}`}
        action={
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/" className="btn btn-primary">
              Back to home
            </Link>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              Go back
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                await dispatch(fetchMe());
                if (from) navigate(from, { replace: true });
              }}
              title="Reload your permissions in case they were just changed"
            >
              Check again
            </button>
          </div>
        }
      />
    </div>
  );
}

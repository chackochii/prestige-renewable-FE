// Sign in with email + password against prestige-be.

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { redirectTarget } from "@/helpers/navigation";
import { Eye, EyeOff } from "lucide-react";
import Field from "@/components/Field";
import Alert from "@/components/Alert";
import BrandMark from "@/components/BrandMark";
import { useAuth } from "@/hooks/useAuth";
import { isBlank, isEmail } from "@/utils/validators";
import { useAppDispatch, useAppSelector } from "@/store";
import { clearSessionNotice, markSessionNoticeSeen, SESSION_NOTICES } from "@/slices/authSlice";

const NOTICE_TEXT = {
  [SESSION_NOTICES.EXPIRED]: "Your session expired. Sign in again to pick up where you left off.",
  [SESSION_NOTICES.UNAUTHORIZED]: "You were signed out because your session is no longer valid.",
};

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const { login, status } = useAuth();
  const notice = useAppSelector((s) => s.auth.notice);
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Once the "why you were signed out" message has been shown here, the
  // landing page stops redirecting to sign-in for it.
  useEffect(() => {
    dispatch(markSessionNoticeSeen());
  }, [dispatch]);

  const submit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!isEmail(email)) errors.email = "Enter your work email.";
    if (isBlank(password)) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setError("");
    dispatch(clearSessionNotice());
    try {
      await login(email.trim(), password);
      navigate(redirectTarget(location), { replace: true });
    } catch (err) {
      // One message for any refused sign-in, as the UAT asks; it does not say which of the two was wrong.
      const text = typeof err === "string" ? err : err?.message || "";
      setError(/network|reach|timeout/i.test(text) ? "Cannot reach the server. Try again." : "Email or password is incorrect.");
    }
  };

  return (
    <div className="login-wrap">
      <section className="login-art">
        <div>
          <Link to="/" className="brand" style={{ width: "fit-content" }}>
            <BrandMark size={40} />
            <div>
              {/* <div className="brand-name">Prestige Renewable</div>
              <div className="brand-sub">Sales &amp; delivery</div> */}
            </div>
          </Link>
          <h2>Every job, every stage, one place.</h2>
          <p>
            Manage leads, estimates, delivery and handover in one place. Keep every team connected, with the right
            information at every stage.
          </p>
        </div>
        {/* <p>Prestige Business Units · Sales &amp; Delivery</p> */}
      </section>

      <section className="login-panel">
        <form className="login-card route-fade" onSubmit={submit} noValidate>
          {/* Visible only on small screens, where the art panel is hidden. */}
          <Link to="/" className="brand login-brand">
            <BrandMark size={34} />
            <div>
              {/* <div className="brand-name">Prestige Renewable</div>
              <div className="brand-sub">Sales &amp; delivery</div> */}
            </div>
          </Link>
          <h1>Sign in</h1>
          <p className="lede">Enter your work email and password to get started.</p>

          {NOTICE_TEXT[notice] ? (
            <Alert tone="info" style={{ marginTop: 16, marginBottom: 0 }}>
              {NOTICE_TEXT[notice]}
            </Alert>
          ) : null}

          <div className="section">
            <Field label="Email" error={fieldErrors.email} htmlFor="login-email">
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </Field>
 <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, marginBottom: -6 }}>
              {/* Passwords are reset by an administrator; there is no self-service reset. */}
              <button type="button" className="link-btn" onClick={() => setForgot(true)}>
                Forgot password?
              </button>
            </div>
            {forgot ? (
              <Alert tone="info" style={{ marginTop: 10, marginBottom: 0 }}>
                Contact your administrator to reset your password.
              </Alert>
            ) : null}
            <Field label="Password" error={fieldErrors.password} htmlFor="login-password">
              <div className="input-with-action">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
          </div>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={status === "loading"}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {status === "loading" ? "Signing in…" : "Sign in"}
          </button>
          <p className="row-meta" style={{ textAlign: "center", marginTop: 14 }}>
            Need access? Contact your administrator.
          </p>
        </form>
      </section>
    </div>
  );
}

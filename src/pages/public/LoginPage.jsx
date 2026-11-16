// Sign in with email + password against prestige-be.
//
// A first sign-in with the temporary password an administrator set (adding
// the person, or a reset) does not open the app: the page asks them to choose
// their own password, and that signs them in.

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

/** The rules prestige-be checks (userService.cleanOwnPassword), checked here first. */
function passwordProblem(password, confirm, email) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 100) return "Use at most 100 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) return "Your password cannot be your email address.";
  if (password !== confirm) return "The two passwords do not match.";
  return "";
}

/** Choose your own password — shown after signing in with a temporary one. */
function SetPasswordStep({ setup, temporaryPassword, onDone, onCancel }) {
  const { completePasswordSetup, status } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const problem = passwordProblem(password, confirm, setup.user?.email);
    if (problem) return setError(problem);
    if (password === temporaryPassword) return setError("Choose a new password - not the temporary one you were given.");
    setError("");
    try {
      await completePasswordSetup(setup.token, password);
      onDone();
    } catch (err) {
      const text = typeof err === "string" ? err : err?.message || "";
      setError(/expired|invalid|token/i.test(text) ? "This sign-in has timed out. Go back and sign in again with the temporary password." : text || "Your password could not be set. Try again.");
    }
  };

  return (
    <form className="login-card route-fade" onSubmit={submit} noValidate>
      <h1>Set your password</h1>
      <p className="lede">
        Welcome{setup.user?.name ? `, ${setup.user.name}` : ""}. You signed in with a temporary password from your administrator - choose your own to
        continue. You will use it from now on.
      </p>
      <div className="section">
        <Field label="New password" hint="at least 8 characters, with a letter and a number" htmlFor="set-password">
          <div className="input-with-action">
            <input id="set-password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
            <button
              type="button"
              className="input-action"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              title={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <Field label="Confirm new password" htmlFor="set-password-confirm">
          <input id="set-password-confirm" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <button className="btn btn-primary" type="submit" disabled={status === "loading"} style={{ width: "100%", justifyContent: "center" }}>
        {status === "loading" ? "Saving…" : "Set password and continue"}
      </button>
      <p className="row-meta" style={{ textAlign: "center", marginTop: 14 }}>
        <button type="button" className="link-btn" onClick={onCancel}>
          Back to sign in
        </button>
      </p>
    </form>
  );
}

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
  // Signed in with a temporary password: { token (the set-up token), user } until they choose their own.
  const [setup, setSetup] = useState(null);

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
      const result = await login(email.trim(), password);
      if (result?.passwordSetup) {
        setSetup(result.passwordSetup);
        return;
      }
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
          <Link to="/">
            <img src="/brand/prestige-logo-wide.png" alt="Prestige Renewable Solutions" style={{ height: 84 }} />
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
        {setup ? (
          <SetPasswordStep
            setup={setup}
            temporaryPassword={password}
            onDone={() => navigate(redirectTarget(location), { replace: true })}
            onCancel={() => {
              setSetup(null);
              setPassword("");
            }}
          />
        ) : (
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
        )}
      </section>
    </div>
  );
}

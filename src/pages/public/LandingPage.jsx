// Public landing page shown on "/" to signed-out visitors.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BrandMark from "@/components/BrandMark";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  CircleCheck,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Gauge,
  HardHat,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

const PROCESS = [
  { label: "Leads & Marketing", hint: "Initial enquiries & tracking" },
  { label: "Estimation & Proposals", hint: "Quote prep & presentation" },
  { label: "Approvals", hint: "Client & regulatory sign-offs" },
  { label: "Procurement & Delivery", hint: "Material sourcing & logistics" },
  { label: "Construction", hint: "On-site build & commissioning" },
  { label: "Invoicing & Payments", hint: "Financial close-out & billing" },
  { label: "Warranty Registration", hint: "Certificate issue & logging" },
  { label: "Referrals & Feedback", hint: "Client review & advocacy" },
  { label: "DLP, O&M Period", hint: "Defects liability & maintenance" },
];

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: "Lead capture & qualification",
    desc: "Every enquiry — campaign, referrer, inbound or repeat — logged, assigned and qualified with a full audit trail.",
  },
  {
    icon: Gauge,
    title: "Estimation & margin control",
    desc: "Solution options, cost build-ups and margin-floor checks before a proposal ever reaches a client.",
  },
  {
    icon: FileText,
    title: "Proposals & approvals",
    desc: "Sign-off on below-floor pricing, DA / DNSP / finance approvals tracked to close.",
  },
  {
    icon: PackageSearch,
    title: "Procurement & purchase orders",
    desc: "BOQ matching, price-variation checks and delivery confirmation tied straight to billing milestones.",
  },
  {
    icon: HardHat,
    title: "Site delivery & sign-off",
    desc: "Crew scheduling, sub-stage checklists, SWMS and commissioning evidence captured on site.",
  },
  {
    icon: CircleDollarSign,
    title: "Milestone billing",
    desc: "Deposit, delivery and final requests raised as each milestone is met.",
  },
  {
    icon: ShieldCheck,
    title: "Warranty & compliance",
    desc: "CCEW, STC and warranty registration tracked with escalation if a step stalls.",
  },
  {
    icon: Users,
    title: "Referrals & commission",
    desc: "Referrer network, involvement tiers and commission calculated straight from accepted value.",
  },
  {
    icon: Bell,
    title: "SLA-aware notifications",
    desc: "Every stage carries a response-time target — overdue items surface automatically, to the right person.",
  },
];

function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function Reveal({ children, delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className={`reveal ${visible ? "visible" : ""}`.trim()} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-brand">
          <BrandMark size={32} />
          Prestige Renewable
        </div>
        <div className="landing-nav-links">
          <a href="#process">Process</a>
          <a href="#platform">Platform</a>
          <Link className="btn btn-primary btn-sm" to="/login">
            Sign in
          </Link>
        </div>
      </nav>

      <header className="landing-hero">
        <span className="landing-aura" />
        <span className="landing-blob b1" />
        <span className="landing-blob b2" />
        <span className="landing-grid-overlay" />
        <div className="landing-hero-inner">
          <span className="landing-badge">
            <Sparkles size={13} /> Lead to service, in one platform
          </span>
          <h1>
            From first enquiry to final <em>commission</em> — one system, every stage.
          </h1>
          <p>
            Prestige runs the entire delivery lifecycle — leads, estimation, approvals, procurement, construction,
            billing and warranty — so nothing gets lost between a WhatsApp message and a signed-off job.
          </p>
          <div className="landing-cta-row">
            <Link className="btn btn-primary" to="/login">
              Sign in to your workspace <ArrowRight size={16} />
            </Link>
            <a className="btn btn-ghost" href="#process">
              See the process
            </a>
          </div>
        </div>
        <a href="#process" className="landing-scroll-cue" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: "56px auto 0", color: "#ffffff80", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", width: "fit-content" }}>
          Scroll <ChevronDown size={16} />
        </a>
      </header>

      <div className="landing-marquee" aria-hidden="true">
        <div className="landing-marquee-track">
          {[...PROCESS, ...PROCESS].map((step, i) => (
            <span key={i} className="landing-marquee-item">
              <Zap size={13} /> {step.label}
            </span>
          ))}
        </div>
      </div>

      <section className="landing-section" id="platform">
        <Reveal>
          <div className="landing-section-head">
            <span className="landing-eyebrow">Platform</span>
            <h2>Every module your team already needs</h2>
            <p>Built around the actual way a job moves — not a generic pipeline bolted on afterwards.</p>
          </div>
        </Reveal>
        <div className="landing-features">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="landing-feature-card">
                <div className="landing-feature-icon">
                  <f.icon size={20} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="process">
        <Reveal>
          <div className="landing-section-head">
            <span className="landing-eyebrow">Process</span>
            <h2>The whole company process, mapped</h2>
            <p>From the first marketing touch to the day defects liability closes out — one record, start to finish.</p>
          </div>
        </Reveal>
        <div className="landing-timeline">
          {PROCESS.map((step, i) => (
            <Reveal key={step.label} delay={i * 60}>
              <div className="landing-timeline-step">
                <div className="landing-timeline-dot">
                  <CircleCheck size={16} />
                </div>
                <h4>{step.label}</h4>
                <p>{step.hint}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <div className="landing-cta-banner">
          <h2>Ready to see your pipeline like this?</h2>
          <p>Sign in with your team credentials — every lead, quote and job you already have is waiting.</p>
          <Link className="btn btn-primary" to="/login">
            Sign in <ArrowRight size={16} />
          </Link>
        </div>
      </Reveal>

      <footer className="landing-footer">
        <div className="landing-brand" style={{ fontSize: 14 }}>
          <BrandMark size={26} />
          Prestige Renewable
        </div>
        <span>© {new Date().getFullYear()} Prestige · Sales &amp; Delivery</span>
      </footer>
    </div>
  );
}

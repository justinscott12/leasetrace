// Hash routes so the static build works on any host (GitHub Pages has no rewrites).
import { useEffect, useState } from "react";
import { AuditPage } from "./pages/AuditPage.js";
import { EvalsPage } from "./pages/EvalsPage.js";
import { HomePage } from "./pages/HomePage.js";
import { HowPage } from "./pages/HowPage.js";
import { LivePage } from "./pages/LivePage.js";

const REPO = "https://github.com/justinscott12/leasetrace";
const PORTFOLIO = "https://justin-scott.dev";

function useRoute(): string[] {
  const read = () => (window.location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => {
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return parts;
}

export function App() {
  const [page, arg] = useRoute();
  let body;
  let title = "LeaseTrace";
  switch (page) {
    case "audit":
      body = <AuditPage id={arg ?? ""} />;
      title = "Sample audit · LeaseTrace";
      break;
    case "live":
      body = <LivePage />;
      title = "Audit your lease · LeaseTrace";
      break;
    case "evals":
      body = <EvalsPage />;
      title = "How well it works · LeaseTrace";
      break;
    case "how":
      body = <HowPage />;
      title = "How it works · LeaseTrace";
      break;
    default:
      body = <HomePage />;
  }
  useEffect(() => {
    document.title = title;
  }, [title]);
  const nav = (href: string, label: string, match: string | undefined) => (
    <a href={href} aria-current={page === match ? "page" : undefined}>
      {label}
    </a>
  );
  return (
    <>
      <header className="site-head">
        <div className="wrap">
          <a className="brand" href="#/">
            <span className="brand-mark" aria-hidden="true" />
            LeaseTrace
          </a>
          <nav className="site-nav" aria-label="Main">
            {nav("#/", "Sample leases", undefined)}
            {nav("#/live", "Check your lease", "live")}
            {nav("#/evals", "How well it works", "evals")}
            {nav("#/how", "How it works", "how")}
            <a href={REPO}>Source</a>
          </nav>
        </div>
      </header>
      <main>{body}</main>
      <footer className="site-foot">
        <div className="wrap">
          <p className="not-advice">LeaseTrace gives information, not legal advice.</p>
          <p>
            It checks 18 provisions of Chapter 83, Part II of the 2026 Florida Statutes. A lease can pass every check and still
            break other laws, and a flagged clause may be fine in context. For advice about your lease, talk to a Florida attorney
            or your local legal aid office.
          </p>
          <p>
            Built by <a href={PORTFOLIO}>Justin Scott</a>. Version 1, which got this wrong in ways that looked right, is kept on the{" "}
            <a href={`${REPO}/tree/v1-legacy`}>v1-legacy branch</a>.
          </p>
        </div>
      </footer>
    </>
  );
}

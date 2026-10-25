import { Link, useLocation } from "react-router";

// Navigation-er shob link ekhane. Notun page banale shudhu ekhane ek line jog korbo
export const NAV_ITEMS = [
  { label: "Overview", to: "/app", match: "exact", icon: "overview" },
  { label: "Reviews", to: "/app/reviews", match: "prefix", icon: "reviews" },
];

function isActive(item, pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (item.match === "exact") {
    return path === item.to;
  }
  return path === item.to || path.startsWith(`${item.to}/`);
}

function NavIcon({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (name === "reviews") {
    return (
      <svg {...common}>
        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export default function AppNavigation() {
  const { pathname } = useLocation();

  return (
    <nav className="app-nav-wrap" aria-label="App navigation">
      <style>{`
        .app-nav-wrap { max-width: 998px; margin: 0 auto; padding: 16px 16px 0; box-sizing: border-box; font-family: Inter, -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }
        .app-nav { display: flex; gap: 4px; padding: 6px; background: #ffffff; border: 1px solid #e1e3e5; border-radius: 12px; overflow-x: auto; }
        .app-nav-link { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 600; color: #4a4a4a; text-decoration: none; white-space: nowrap; }
        .app-nav-link:hover { background: #f1f2f3; color: #1a1a1a; }
        .app-nav-link.active { background: #1a1a1a; color: #ffffff; }
      `}</style>

      <div className="app-nav">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`app-nav-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
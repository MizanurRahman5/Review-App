import { useLoaderData, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = [
  { value: 7, label: "7D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
];

// Review-er ekta list theke 4 ta number bar kore
function summarize(reviews) {
  const approved = reviews.filter((review) => review.status === "approved");
  const ratingSum = approved.reduce((sum, review) => sum + review.rating, 0);
  const repliedCount = approved.filter((review) => review.reply).length;

  return {
    total: reviews.length,
    averageRating: approved.length ? ratingSum / approved.length : 0,
    responseRate: approved.length ? (repliedCount / approved.length) * 100 : 0,
    pending: reviews.filter((review) => review.status === "pending").length,
  };
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // URL theke range ney (?range=7), thik na hole 30 din
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("range"));
  const range = [7, 30, 90].includes(requested) ? requested : 30;

  const now = Date.now();
  const currentStart = new Date(now - range * DAY_MS);
  const previousStart = new Date(now - 2 * range * DAY_MS);

  // Ekhon-er period ar ager period, duita-r review ek query-te ane
  const reviews = await prisma.review.findMany({
    where: { shop: session.shop, createdAt: { gte: previousStart } },
    select: { rating: true, status: true, reply: true, createdAt: true },
  });

  const current = summarize(
    reviews.filter((review) => review.createdAt >= currentStart),
  );
  const previous = summarize(
    reviews.filter((review) => review.createdAt < currentStart),
  );

  return { range, current, previous };
};

// Ager period-er theke koto bodlalo, sei text ar color
function Change({ value, suffix = "", decimals = 1, positiveIsGood = true }) {
  if (value === null || Number.isNaN(value)) {
    return <span style={{ color: "#6d7175", fontSize: 13 }}>No data</span>;
  }

  const isUp = value >= 0;
  const isGood = isUp === positiveIsGood;
  const color = value === 0 ? "#6d7175" : isGood ? "#0f7b3f" : "#d72c0d";
  const arrow = value === 0 ? "" : isUp ? "↑ " : "↓ ";
  const sign = isUp ? "+" : "";

  return (
    <span style={{ color, fontSize: 13, fontWeight: 600 }}>
      {arrow}
      {sign}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

function StatCard({ label, value, change, footnote }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {change}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-footnote">{footnote}</div>
    </div>
  );
}

export default function OverviewPage() {
  const { range, current, previous } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  const setRange = (value) => {
    const next = new URLSearchParams(searchParams);
    next.set("range", String(value));
    setSearchParams(next);
  };

  const totalChange = previous.total
    ? ((current.total - previous.total) / previous.total) * 100
    : null;
  const ratingChange = previous.total
    ? current.averageRating - previous.averageRating
    : null;
  const responseChange = previous.total
    ? current.responseRate - previous.responseRate
    : null;

  const footnote = `vs previous ${range} days`;

  return (
    <s-page heading="Overview">
      <style>{`
        .overview-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .overview-subtitle { color: #6d7175; font-size: 14px; margin: 0; }
        .range-group { display: inline-flex; background: #f1f2f3; border-radius: 10px; padding: 3px; gap: 2px; }
        .range-button { border: 0; background: transparent; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #303030; cursor: pointer; }
        .range-button.active { background: #ffffff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; }
        .stat-card { background: #ffffff; border: 1px solid #e1e3e5; border-radius: 12px; padding: 16px; }
        .stat-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .stat-label { font-size: 13px; font-weight: 600; color: #303030; }
        .stat-value { font-size: 32px; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
        .stat-footnote { font-size: 12px; color: #6d7175; margin-top: 6px; }
      `}</style>

      <div className="overview-header">
        <p className="overview-subtitle">
          Here is how your reviews are performing.
        </p>
        <div className="range-group">
          {RANGES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`range-button${range === item.value ? " active" : ""}`}
              onClick={() => setRange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Total reviews"
          value={current.total.toLocaleString("en-US")}
          change={<Change value={totalChange} suffix="%" />}
          footnote={footnote}
        />
        <StatCard
          label="Average rating"
          value={current.averageRating.toFixed(1)}
          change={<Change value={ratingChange} decimals={1} />}
          footnote={footnote}
        />
        <StatCard
          label="Response rate"
          value={`${Math.round(current.responseRate)}%`}
          change={<Change value={responseChange} suffix=" pts" />}
          footnote={footnote}
        />
        <StatCard
          label="Awaiting moderation"
          value={current.pending.toLocaleString("en-US")}
          change={null}
          footnote={`pending in the last ${range} days`}
        />
      </div>
    </s-page>
  );
}
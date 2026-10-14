import { useLoaderData, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = [
  { value: 7, label: "7D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function startOfDay(ms) {
  const date = new Date(ms);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatDay(date) {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

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

  // Ekhon-er period: ajker din soho gelo (range) din. Ager period tar thik age-r (range) din
  const now = Date.now();
  const currentStart = startOfDay(now - (range - 1) * DAY_MS);
  const previousStart = new Date(currentStart.getTime() - range * DAY_MS);

  // Ekhon-er period ar ager period, duita-r review ek query-te ane
  const reviews = await prisma.review.findMany({
    where: { shop: session.shop, createdAt: { gte: previousStart } },
    select: { rating: true, status: true, reply: true, createdAt: true },
  });

  const currentReviews = reviews.filter(
    (review) => review.createdAt >= currentStart,
  );
  const previousReviews = reviews.filter(
    (review) => review.createdAt < currentStart,
  );

  const current = summarize(currentReviews);
  const previous = summarize(previousReviews);

  // Chart-er jonno: proti diner review-er songkha
  const countsByDay = {};
  for (const review of currentReviews) {
    const key = dayKey(review.createdAt);
    countsByDay[key] = (countsByDay[key] || 0) + 1;
  }

  const daily = [];
  for (let i = range - 1; i >= 0; i--) {
    const date = new Date(now - i * DAY_MS);
    const key = dayKey(date);
    daily.push({ label: formatDay(date), count: countsByDay[key] || 0 });
  }

  // Rating distribution: approved review-er moddhe 5 theke 1 star-er bhag
  const approvedCurrent = currentReviews.filter(
    (review) => review.status === "approved",
  );
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = approvedCurrent.filter(
      (review) => review.rating === star,
    ).length;
    return {
      star,
      count,
      percent: approvedCurrent.length
        ? (count / approvedCurrent.length) * 100
        : 0,
    };
  });

  return { range, current, previous, daily, distribution };
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
    <div className="panel">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {change}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-footnote">{footnote}</div>
    </div>
  );
}

// Line chart, SVG diye. Kono library lagena
function ReviewsChart({ daily }) {
  const width = 600;
  const height = 220;
  const pad = { top: 12, right: 12, bottom: 28, left: 32 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;

  const maxCount = Math.max(...daily.map((day) => day.count), 1);
  const yMax = Math.ceil(maxCount / 5) * 5;
  const lastIndex = daily.length - 1;

  const x = (index) => pad.left + (index / lastIndex) * innerWidth;
  const y = (value) => pad.top + innerHeight - (value / yMax) * innerHeight;

  const linePath = daily
    .map((day, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(day.count)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(lastIndex)},${pad.top + innerHeight} L${x(0)},${pad.top + innerHeight} Z`;

  const yTicks = [0, Math.round(yMax / 2), yMax];
  const xLabelIndexes = Array.from({ length: 5 }, (_, step) =>
    Math.round((step * lastIndex) / 4),
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="New reviews per day"
    >
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="#e1e3e5"
            strokeWidth="1"
          />
          <text
            x={pad.left - 8}
            y={y(tick) + 4}
            textAnchor="end"
            fontSize="11"
            fill="#6d7175"
          >
            {tick}
          </text>
        </g>
      ))}

      <path d={areaPath} fill="rgba(37, 99, 235, 0.1)" />
      <path
        d={linePath}
        fill="none"
        stroke="#2563eb"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {xLabelIndexes.map((index, step) => (
        <text
          key={index}
          x={x(index)}
          y={height - 8}
          textAnchor={step === 0 ? "start" : step === 4 ? "end" : "middle"}
          fontSize="11"
          fill="#6d7175"
        >
          {daily[index].label}
        </text>
      ))}
    </svg>
  );
}

export default function OverviewPage() {
  const { range, current, previous, daily, distribution } = useLoaderData();
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
        .panel { background: #ffffff; border: 1px solid #e1e3e5; border-radius: 12px; padding: 16px; }
        .stat-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .stat-label { font-size: 13px; font-weight: 600; color: #303030; }
        .stat-value { font-size: 32px; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
        .stat-footnote { font-size: 12px; color: #6d7175; margin-top: 6px; }
        .chart-row { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-top: 16px; }
        @media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } }
        .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
        .panel-title { font-size: 15px; font-weight: 700; color: #1a1a1a; margin: 0; }
        .panel-subtitle { font-size: 12px; color: #6d7175; margin: 2px 0 0; }
        .panel-number { font-size: 28px; font-weight: 700; color: #1a1a1a; line-height: 1.1; text-align: right; }
        .average-number { font-size: 40px; font-weight: 700; color: #1a1a1a; line-height: 1.1; margin-bottom: 16px; }
        .average-number span { font-size: 14px; font-weight: 500; color: #6d7175; margin-left: 6px; }
        .rating-row { display: grid; grid-template-columns: 32px 1fr 84px; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 13px; color: #303030; }
        .rating-track { height: 8px; background: #f1f2f3; border-radius: 999px; overflow: hidden; }
        .rating-fill { height: 100%; background: #2563eb; border-radius: 999px; }
        .rating-count { text-align: right; color: #6d7175; }
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

      <div className="chart-row">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">Reviews collected</h3>
              <p className="panel-subtitle">
                New reviews per day · last {range} days
              </p>
            </div>
            <div>
              <div className="panel-number">
                {current.total.toLocaleString("en-US")}
              </div>
              <div style={{ textAlign: "right" }}>
                <Change value={totalChange} suffix="%" />
              </div>
            </div>
          </div>
          <ReviewsChart daily={daily} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">Rating distribution</h3>
              <p className="panel-subtitle">Share of reviews by star rating</p>
            </div>
          </div>
          <div className="average-number">
            {current.averageRating.toFixed(1)}
            <span>average</span>
          </div>
          {distribution.map((row) => (
            <div className="rating-row" key={row.star}>
              <span>{row.star} ★</span>
              <div className="rating-track">
                <div
                  className="rating-fill"
                  style={{ width: `${row.percent}%` }}
                />
              </div>
              <span className="rating-count">
                {row.count} · {Math.round(row.percent)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </s-page>
  );
}
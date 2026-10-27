import { useState } from "react";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const PAGE_SIZE = 50;
const MAX_REPLY_LENGTH = 1000;
const VALID_STATUSES = ["pending", "flagged", "approved", "rejected"];
const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "flagged", label: "Flagged" },
  { value: "approved", label: "Published" },
  { value: "rejected", label: "Rejected" },
];
const STATUS_BADGES = {
  approved: { label: "Published", background: "#cdfee1", color: "#0c5132" },
  pending: { label: "Pending", background: "#fff1c5", color: "#5e4200" },
  flagged: { label: "Flagged", background: "#fee9e8", color: "#8e1f0b" },
  rejected: { label: "Rejected", background: "#f1f2f3", color: "#4a4a4a" },
};

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // URL theke filter ney (?status=pending), thik na hole sob
  const url = new URL(request.url);
  const requested = url.searchParams.get("status");
  const statusFilter = VALID_STATUSES.includes(requested) ? requested : "all";

  const [reviews, groups] = await Promise.all([
    prisma.review.findMany({
      where: {
        shop,
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: { photos: true },
    }),
    // Proti status-e koyta review, filter button-er songkha-r jonno
    prisma.review.groupBy({
      by: ["status"],
      where: { shop },
      _count: { _all: true },
    }),
  ]);

  const counts = { all: 0, pending: 0, flagged: 0, approved: 0, rejected: 0 };
  for (const group of groups) {
    counts[group.status] = group._count._all;
    counts.all += group._count._all;
  }

  return { statusFilter, reviews, counts };
};

// Approve / Reject / Reply button click korle ei function chole
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return { ok: false };
  }

  // Reply save kora. Faka reply dile purano reply muche jay
  if (intent === "reply") {
    const reply = String(formData.get("reply") ?? "")
      .trim()
      .slice(0, MAX_REPLY_LENGTH);

    await prisma.review.updateMany({
      where: { id, shop: session.shop },
      data: { reply: reply || null, repliedAt: reply ? new Date() : null },
    });

    return { ok: true };
  }

  const nextStatus =
    intent === "approve" ? "approved" : intent === "reject" ? "rejected" : null;

  if (!nextStatus) {
    return { ok: false };
  }

  // shop-o mele dekhe, jate onno store-er review bodlano na jay
  await prisma.review.updateMany({
    where: { id, shop: session.shop },
    data: { status: nextStatus },
  });

  return { ok: true };
};

function Stars({ rating }) {
  return (
    <span aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: n <= rating ? "#f5a623" : "#d2d5d8" }}>
          ★
        </span>
      ))}
    </span>
  );
}

function ReviewCard({ review }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const badge = STATUS_BADGES[review.status] || STATUS_BADGES.rejected;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const send = (intent) => {
    fetcher.submit({ intent, id: review.id }, { method: "post" });
  };

  const openReply = () => {
    setDraft(review.reply || "");
    setEditing(true);
  };

  const saveReply = () => {
    fetcher.submit(
      { intent: "reply", id: review.id, reply: draft },
      { method: "post" },
    );
    setEditing(false);
  };

  return (
    <div className="review-card">
      <div className="review-top">
        <div className="review-avatar">{getInitials(review.customerName)}</div>
        <div className="review-who">
          <div className="review-name">{review.customerName}</div>
          {review.verifiedBuyer && (
            <div className="review-verified">✓ Verified buyer</div>
          )}
        </div>
        <span
          className="status-badge"
          style={{ background: badge.background, color: badge.color }}
        >
          {badge.label}
        </span>
        <div className="review-date">{formatDate(review.createdAt)}</div>
      </div>

      <div className="review-stars">
        <Stars rating={review.rating} />
      </div>
      <div className="review-title">{review.title}</div>
      <p className="review-text">{review.body}</p>

      {review.photos.length > 0 && (
        <div className="review-photos">
          {review.photos.map((photo) => (
            <img key={photo.id} src={photo.url} alt="Customer photo" />
          ))}
        </div>
      )}

      <div className="review-meta">
        {[review.productTitle, review.variantInfo].filter(Boolean).join(" · ")}
      </div>

      {review.reply && !editing && (
        <div className="review-reply">
          <div className="review-reply-label">Your reply</div>
          <div>{review.reply}</div>
        </div>
      )}

      {editing && (
        <div className="reply-editor">
          <label className="reply-label" htmlFor={`reply-${review.id}`}>
            Your reply
          </label>
          <textarea
            id={`reply-${review.id}`}
            className="reply-textarea"
            value={draft}
            maxLength={MAX_REPLY_LENGTH}
            placeholder="Write a public reply to this customer"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="reply-hint">
            {draft.length}/{MAX_REPLY_LENGTH} · Customers see this reply under
            their review. Leave it empty and save to remove the reply.
          </div>
          <div className="reply-actions">
            <button
              type="button"
              className="action-button approve"
              disabled={busy}
              onClick={saveReply}
            >
              Save reply
            </button>
            <button
              type="button"
              className="action-button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="review-actions">
          {review.status !== "approved" && (
            <button
              type="button"
              className="action-button approve"
              disabled={busy}
              onClick={() => send("approve")}
            >
              Approve
            </button>
          )}
          {review.status !== "rejected" && (
            <button
              type="button"
              className="action-button reject"
              disabled={busy}
              onClick={() => send("reject")}
            >
              Reject
            </button>
          )}
          <button
            type="button"
            className="action-button"
            disabled={busy}
            onClick={openReply}
          >
            {review.reply ? "Edit reply" : "Reply"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  const { statusFilter, reviews, counts } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  const setStatusFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "all") {
      next.delete("status");
    } else {
      next.set("status", value);
    }
    setSearchParams(next);
  };

  return (
    <s-page heading="Reviews">
      <style>{`
        .reviews-wrap { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }
        .filter-group { display: flex; flex-wrap: wrap; gap: 8px; }
        .filter-pill { border: 1px solid #e1e3e5; background: #ffffff; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: #303030; cursor: pointer; }
        .filter-pill.active { background: #1a1a1a; border-color: #1a1a1a; color: #ffffff; }
        .review-card { background: #ffffff; border: 1px solid #e1e3e5; border-radius: 12px; padding: 16px; }
        .review-top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .review-avatar { width: 40px; height: 40px; border-radius: 50%; background: #f1f2f3; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #4a4a4a; flex-shrink: 0; }
        .review-who { flex: 1; min-width: 0; }
        .review-name { font-size: 14px; font-weight: 600; color: #1a1a1a; }
        .review-verified { font-size: 12px; color: #0f7b3f; margin-top: 2px; }
        .review-date { font-size: 12px; color: #6d7175; white-space: nowrap; }
        .status-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .review-stars { font-size: 16px; margin-bottom: 4px; }
        .review-title { font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
        .review-text { font-size: 14px; color: #303030; margin: 0 0 8px; line-height: 1.5; }
        .review-photos { display: flex; gap: 8px; margin-bottom: 8px; }
        .review-photos img { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; }
        .review-meta { font-size: 12px; color: #6d7175; }
        .review-reply { margin-top: 12px; background: #f7f7f5; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #303030; }
        .review-reply-label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #6d7175; margin-bottom: 2px; }
        .reply-editor { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e1e3e5; }
        .reply-label { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #6d7175; margin-bottom: 6px; }
        .reply-textarea { display: block; width: 100%; min-height: 90px; resize: vertical; border: 1px solid #c9cccf; border-radius: 8px; padding: 10px 12px; font: inherit; font-size: 14px; color: #1a1a1a; background: #ffffff; box-sizing: border-box; }
        .reply-textarea:focus { outline: 2px solid #2563eb; outline-offset: 0; border-color: #2563eb; }
        .reply-hint { font-size: 12px; color: #6d7175; margin-top: 6px; }
        .reply-actions { display: flex; gap: 8px; margin-top: 12px; }
        .review-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e1e3e5; }
        .action-button { border: 1px solid #e1e3e5; background: #ffffff; padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .action-button:disabled { opacity: 0.5; cursor: default; }
        .action-button.approve { background: #1a1a1a; border-color: #1a1a1a; color: #ffffff; }
        .action-button.reject { color: #d72c0d; }
        .empty-note { font-size: 14px; color: #6d7175; background: #ffffff; border: 1px solid #e1e3e5; border-radius: 12px; padding: 24px; text-align: center; margin: 0; }
        .reviews-footnote { font-size: 12px; color: #6d7175; text-align: center; margin: 0 0 16px; }
      `}</style>

      <div className="reviews-wrap">
        <div className="filter-group">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`filter-pill${statusFilter === item.value ? " active" : ""}`}
              onClick={() => setStatusFilter(item.value)}
            >
              {item.label} ({counts[item.value] || 0})
            </button>
          ))}
        </div>

        {reviews.length === 0 ? (
          <p className="empty-note">No reviews found.</p>
        ) : (
          reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        )}

        {reviews.length === PAGE_SIZE && (
          <p className="reviews-footnote">
            Showing the latest {PAGE_SIZE} reviews.
          </p>
        )}
      </div>
    </s-page>
  );
}
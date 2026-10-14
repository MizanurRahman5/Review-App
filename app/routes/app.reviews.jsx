import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const reviews = await prisma.review.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    include: { photos: true },
  });

  return { reviews };
};

export default function ReviewsPage() {
  const { reviews } = useLoaderData();

  return (
    <s-page heading="Reviews">
      <s-section heading={`All reviews (${reviews.length})`}>
        {reviews.length === 0 ? (
          <s-paragraph>
            No reviews yet. When customers submit reviews, they will show up here.
          </s-paragraph>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>Customer</th>
                  <th style={{ padding: "8px" }}>Rating</th>
                  <th style={{ padding: "8px" }}>Review</th>
                  <th style={{ padding: "8px" }}>Status</th>
                  <th style={{ padding: "8px" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr
                    key={review.id}
                    style={{ borderTop: "1px solid #e1e3e5" }}
                  >
                    <td style={{ padding: "8px" }}>{review.customerName}</td>
                    <td style={{ padding: "8px" }}>
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <strong>{review.title}</strong>
                      <div>{review.body}</div>
                    </td>
                    <td style={{ padding: "8px" }}>{review.status}</td>
                    <td style={{ padding: "8px" }}>
                      {new Date(review.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>
    </s-page>
  );
}
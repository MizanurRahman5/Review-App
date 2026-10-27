import { authenticate } from "../shopify.server";
import prisma from "../db.server";

function fail(message, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return fail("Method not allowed", 405);
  }

  // Shopify-r signature check kore. Thik na hole ekhanei error dey
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const formData = await request.formData();
  const reviewId = String(formData.get("review_id") ?? "");

  if (!shop || !reviewId) {
    return fail("Missing store or review.");
  }

  // Shudhu ei store-er approved review-er count bare
  const result = await prisma.review.updateMany({
    where: { id: reviewId, shop, status: "approved" },
    data: { helpfulCount: { increment: 1 } },
  });

  if (result.count === 0) {
    return fail("Review not found.", 404);
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { helpfulCount: true },
  });

  return Response.json({ ok: true, helpfulCount: review?.helpfulCount ?? 0 });
};
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const PAGE_SIZE = 6;
const PHOTO_PREVIEW_LIMIT = 6;

// product_id numeric (1001) ba gid (gid://shopify/Product/1001), duita-i cholbe
function toProductGid(value) {
  if (!value) return null;
  return value.startsWith("gid://") ? value : `gid://shopify/Product/${value}`;
}

// Customer-er dekha-r jonno sort
function getOrderBy(sort) {
  if (sort === "highest") return [{ rating: "desc" }, { createdAt: "desc" }];
  if (sort === "lowest") return [{ rating: "asc" }, { createdAt: "desc" }];
  if (sort === "helpful") return [{ helpfulCount: "desc" }, { createdAt: "desc" }];
  return [{ createdAt: "desc" }];
}

export const loader = async ({ request }) => {
  // Shopify-r signature check kore. Thik na hole ekhanei error dey
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const productId = toProductGid(url.searchParams.get("product_id"));

  if (!shop || !productId) {
    return Response.json({ error: "Missing shop or product_id" }, { status: 400 });
  }

  const filter = url.searchParams.get("filter") || "all";
  const sort = url.searchParams.get("sort") || "recent";
  const query = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  // Customer-ke shudhu approved review dekhano hoy
  const baseWhere = { shop, productId, status: "approved" };

  // Filter ar search onujayi where
  const filteredWhere = { ...baseWhere };
  if (filter === "photos") filteredWhere.photos = { some: {} };
  if (filter === "5") filteredWhere.rating = 5;
  if (filter === "4") filteredWhere.rating = 4;
  if (filter === "low") filteredWhere.rating = { lte: 3 };
  if (query) {
    filteredWhere.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { body: { contains: query, mode: "insensitive" } },
    ];
  }

  const [ratingGroups, photoTotal, photoRows, reviews, filteredTotal] =
    await Promise.all([
      prisma.review.groupBy({
        by: ["rating"],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.reviewPhoto.count({ where: { review: baseWhere } }),
      prisma.reviewPhoto.findMany({
        where: { review: baseWhere },
        orderBy: { review: { createdAt: "desc" } },
        take: PHOTO_PREVIEW_LIMIT,
        select: { url: true },
      }),
      prisma.review.findMany({
        where: filteredWhere,
        orderBy: getOrderBy(sort),
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { photos: { select: { url: true } } },
      }),
      prisma.review.count({ where: filteredWhere }),
    ]);

  // Summary: mot review, average, 5 theke 1 star-er songkha, recommend %
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const group of ratingGroups) {
    counts[group.rating] = group._count._all;
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const ratingSum = Object.entries(counts).reduce(
    (sum, [star, count]) => sum + Number(star) * count,
    0,
  );
  const average = total ? ratingSum / total : 0;
  const recommendPercent = total
    ? Math.round(((counts[5] + counts[4]) / total) * 100)
    : 0;

  return Response.json({
    summary: {
      total,
      average: Math.round(average * 10) / 10,
      counts,
      recommendPercent,
    },
    photos: {
      total: photoTotal,
      urls: photoRows.map((photo) => photo.url),
    },
    reviews: reviews.map((review) => ({
      id: review.id,
      customerName: review.customerName,
      verifiedBuyer: review.verifiedBuyer,
      rating: review.rating,
      title: review.title,
      body: review.body,
      variantInfo: review.variantInfo,
      helpfulCount: review.helpfulCount,
      reply: review.reply,
      createdAt: review.createdAt,
      photos: review.photos.map((photo) => photo.url),
    })),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total: filteredTotal,
      hasMore: page * PAGE_SIZE < filteredTotal,
    },
  });
};
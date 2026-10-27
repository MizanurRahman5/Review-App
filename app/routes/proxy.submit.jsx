import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// product_id numeric (1001) ba gid, duita-i cholbe
function toProductGid(value) {
  if (!value) return null;
  return value.startsWith("gid://") ? value : `gid://shopify/Product/${value}`;
}

function text(formData, key) {
  return String(formData.get(key) ?? "").trim();
}

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

  // Gopon "website" field-e kichu thakle eta bot, kichu save na kore ok bole dei
  if (text(formData, "website")) {
    return Response.json({ ok: true });
  }

  const productId = toProductGid(text(formData, "product_id"));
  const productTitle = text(formData, "product_title").slice(0, 200);
  const rating = Number(text(formData, "rating"));
  const name = text(formData, "name");
  const email = text(formData, "email");
  const title = text(formData, "title");
  const body = text(formData, "body");

  if (!shop || !productId) return fail("Missing store or product.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail("Please choose a star rating.");
  }
  if (!name || name.length > 60) return fail("Please enter your name.");
  if (!EMAIL_PATTERN.test(email) || email.length > 120) {
    return fail("Please enter a valid email address.");
  }
  if (!title || title.length > 100) {
    return fail("Please add a short review title (up to 100 characters).");
  }
  if (body.length < 10 || body.length > 2000) {
    return fail("Please write between 10 and 2000 characters in your review.");
  }

  // Notun review shob shomoy pending, merchant approve korle dekhabe
  await prisma.review.create({
    data: {
      shop,
      productId,
      productTitle,
      rating,
      title,
      body,
      customerName: name,
      customerEmail: email,
      verifiedBuyer: false,
      status: "pending",
    },
  });

  return Response.json({ ok: true });
};
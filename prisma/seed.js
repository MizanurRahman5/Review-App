import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tomar dev store-er domain (terminal-e dekha: my-app-store-ajef0x8t.myshopify.com)
const SHOP = "my-app-store-ajef0x8t.myshopify.com";

// Simple pseudo-random number generator, jate bar bar chalale same data ashe
let seedValue = 42;
function random() {
  seedValue = (seedValue * 16807) % 2147483647;
  return (seedValue - 1) / 2147483646;
}

function pick(list) {
  return list[Math.floor(random() * list.length)];
}

const products = [
  { id: "gid://shopify/Product/1001", title: "Product A" },
  { id: "gid://shopify/Product/1002", title: "Product B" },
  { id: "gid://shopify/Product/1003", title: "Product C" },
  { id: "gid://shopify/Product/1004", title: "Product D" },
];

const customerNames = [
  "Amina R.", "Daniel K.", "Priya S.", "Tom W.", "Lena M.", "Omar H.",
  "Sara T.", "Jonas B.", "Mei L.", "Carlos D.", "Nadia F.", "Ben A.",
  "Hana Y.", "Lucas P.", "Zoe C.", "Ravi N.",
];

const reviewTexts = {
  5: [
    { title: "Exactly what I hoped for", body: "The fabric feels far more expensive than the price suggests. Fit is spot on." },
    { title: "Quality you can feel", body: "Stitching is clean and the weight is perfect. Arrived earlier than promised." },
    { title: "Bought a second one", body: "Wore it for a week straight and immediately ordered another colour." },
    { title: "Looks even better in person", body: "The colour is rich and true to the photos. Packaging was lovely too." },
  ],
  4: [
    { title: "Great, but runs slightly large", body: "Love the look and the material. I would suggest sizing down if you are between sizes." },
    { title: "Solid build", body: "Really good quality overall. Would have given five stars if the colour was a little brighter." },
  ],
  3: [
    { title: "Good product, slow shipping", body: "The product itself is nice and matches the photos. Delivery took longer than expected." },
    { title: "Decent for the price", body: "Does the job. Nothing special, but no complaints about the quality." },
  ],
  2: [
    { title: "Sizing runs large", body: "The material is fine but the size chart was off. Support took three days to reply." },
  ],
  1: [
    { title: "Not as described", body: "The colour was very different from the photos and I had to return it." },
  ],
};

const replyTexts = [
  "Thank you so much! So glad it works for you.",
  "Thanks for the feedback, we really appreciate it.",
  "Thanks for the sizing tip. We have added it to the product notes.",
  "Sorry about the delay, we are working with a new carrier.",
];

const sizes = ["S", "M", "L", "XL"];
const colors = ["Sand", "Charcoal", "Navy", "Olive"];

function pickRating() {
  const r = random();
  if (r < 0.74) return 5;
  if (r < 0.9) return 4;
  if (r < 0.96) return 3;
  if (r < 0.985) return 2;
  return 1;
}

function pickStatus() {
  const r = random();
  if (r < 0.1) return "pending";
  if (r < 0.14) return "flagged";
  return "approved";
}

function buildReviews(count) {
  const reviews = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const rating = pickRating();
    const text = pick(reviewTexts[rating]);
    const product = pick(products);
    const name = pick(customerNames);
    const status = pickStatus();

    // Gelo 60 diner moddhe jekono ekta somoy
    const createdAt = new Date(
      Date.now() - Math.floor(random() * 60) * dayMs - Math.floor(random() * dayMs)
    );

    // Approved review-er proye 70% e store reply thake
    const hasReply = status === "approved" && random() < 0.7;
    const repliedAt = hasReply
      ? new Date(Math.min(Date.now(), createdAt.getTime() + (2 + Math.floor(random() * 40)) * 60 * 60 * 1000))
      : null;

    reviews.push({
      shop: SHOP,
      productId: product.id,
      productTitle: product.title,
      rating,
      title: text.title,
      body: text.body,
      customerName: name,
      customerEmail: `${name.toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
      verifiedBuyer: random() < 0.9,
      variantInfo: `Size ${pick(sizes)} · ${pick(colors)}`,
      status,
      helpfulCount: Math.floor(random() * 40),
      reply: hasReply ? pick(replyTexts) : null,
      repliedAt,
      createdAt,
    });
  }

  return reviews;
}

async function main() {
  // Ei store-er age-r sob review muche notun kore dhukano, jate bar bar chalale duplicate na hoy
  await prisma.review.deleteMany({ where: { shop: SHOP } });

  const result = await prisma.review.createMany({ data: buildReviews(120) });
  console.log(`Done. ${result.count} sample reviews added for ${SHOP}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
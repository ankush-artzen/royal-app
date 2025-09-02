import prisma from "@/lib/db/prisma-connect";
import { findSessionsByShop } from "@/lib/db/session-storage";

const API_VERSION = "2025-07";

type CreateRoyaltyTxParams = {
  shop: string;
  orderId: string;
  description: string;
  price: number;
  currency?: string;
};

type SessionType = {
  accessToken: string;
  shop: string;
  id: string;
  scope?: string;
  state?: string;
  isOnline?: boolean;
  expires?: string | undefined;
};

async function getActiveRoyaltySubscriptionByShop(shop: string) {
  const normalizedShop = shop.toLowerCase();
  console.log("🔎 Looking up active subscription for shop:", normalizedShop);

  let record = await prisma.royaltySubscription.findFirst({
    where: { shop: normalizedShop, status: "active" },
  });

  if (!record) {
    console.log("⚠ No active subscription found, creating placeholder record");
    record = await prisma.royaltySubscription.create({
      data: {
        shop: normalizedShop,
        chargeId: "unknown",
        planName: "Royalty Usage Plan",
        status: "active",
        test: true,
      },
    });
  }

  console.log("📦 Subscription record:", record);
  return record;
}

export async function createRoyaltyTransactionForOrder({
  shop,
  orderId,
  description,
  price,
  currency = "USD",
}: CreateRoyaltyTxParams) {
  const subscriptionRecord = await getActiveRoyaltySubscriptionByShop(shop);
  const chargeId = subscriptionRecord?.chargeId;

  if (!chargeId) throw new Error("No active chargeId found for this shop");

  // Ensure sessions are typed
  const sessions = (await findSessionsByShop(shop)) as SessionType[] | SessionType | null;
  const token = Array.isArray(sessions) ? sessions[0]?.accessToken : sessions?.accessToken;

  if (!token) throw new Error("No access token found for this shop");

  const resp = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges/${chargeId}/usage_charges.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ usage_charge: { description, price } }),
    }
  );

  const data = await resp.json();
  if (!resp.ok) {
    console.error("❌ Failed to create usage charge:", data);
    throw new Error(`Failed to create usage charge: ${JSON.stringify(data)}`);
  }

  const usageChargeData = data?.usage_charge;
  if (!usageChargeData) throw new Error("No usage charge data returned");

  return prisma.royaltyTransaction.create({
    data: {
      shop,
      shopifyTransactionChargeId: usageChargeData.id.toString(),
      orderId,
      description: usageChargeData.description,
      price: parseFloat(usageChargeData.price),
      currency: usageChargeData.currency,
      balanceUsed: parseFloat(usageChargeData.balance_used),
      balanceRemaining: parseFloat(usageChargeData.balance_remaining),
      createdAt: new Date(usageChargeData.created_at),
    },
  });
}

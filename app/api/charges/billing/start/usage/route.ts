import { NextRequest, NextResponse } from "next/server";
import { findSessionsByShop } from "@/lib/db/session-storage";
import prisma from "@/lib/db/prisma-connect";

const API_VERSION = "2025-07";

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

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shopParam = searchParams.get("shop");

    if (!shopParam) {
      return NextResponse.json({ error: "shop query parameter is required" }, { status: 400 });
    }

    const shop = shopParam.toLowerCase();
    const body = await req.json();
    const { description, price: rawPrice, chargeId: bodyChargeId, orderId } = body;

    if (!description || rawPrice == null) {
      return NextResponse.json(
        { error: "description and price are required" },
        { status: 400 }
      );
    }

    const price = typeof rawPrice === "string" ? parseFloat(rawPrice) : rawPrice;
    if (isNaN(price)) {
      return NextResponse.json({ error: "price must be a valid number" }, { status: 400 });
    }

    const subscriptionRecord = await getActiveRoyaltySubscriptionByShop(shop);
    const chargeId = bodyChargeId || subscriptionRecord?.chargeId;

    if (!chargeId) {
      return NextResponse.json(
        { error: "No active chargeId found for this shop" },
        { status: 400 }
      );
    }

    const sessions = (await findSessionsByShop(shop)) as SessionType[] | SessionType | null;
    const token = Array.isArray(sessions) ? sessions[0]?.accessToken : sessions?.accessToken;

    if (!token) {
      return NextResponse.json({ error: "No access token found for this shop" }, { status: 401 });
    }

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
      return NextResponse.json(
        { error: "Failed to create usage charge", shopifyError: data?.errors || data },
        { status: resp.status }
      );
    }

    const usageChargeData = data?.usage_charge;

    if (usageChargeData) {
      await prisma.royaltyTransaction.create({
        data: {
          shop,
          shopifyTransactionChargeId: usageChargeData.id.toString(),
          orderId: orderId || "N/A",
          description: usageChargeData.description,
          price: parseFloat(usageChargeData.price),
          currency: usageChargeData.currency,
          balanceUsed: parseFloat(usageChargeData.balance_used),
          balanceRemaining: parseFloat(usageChargeData.balance_remaining),
          createdAt: new Date(usageChargeData.created_at),
        },
      });
    }

    return NextResponse.json({ success: true, usageCharge: usageChargeData }, { status: 201 });
  } catch (e: any) {
    console.error("❌ Error creating usage charge:", e);
    return NextResponse.json(
      { error: "Internal server error", message: e.message },
      { status: 500 }
    );
  }
}

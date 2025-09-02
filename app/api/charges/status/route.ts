import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma-connect";

async function getActiveRoyaltySubscriptionByShop(shop: string) {
  const normalizedShop = shop.toLowerCase();
  console.log("🔎 Checking active subscription for shop:", normalizedShop);

  const record = await prisma.royaltySubscription.findFirst({
    where: { shop: normalizedShop, status: "active" },
  });

  return record;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shopParam = searchParams.get("shop");

    if (!shopParam) {
      return NextResponse.json(
        { error: "shop query parameter is required" },
        { status: 400 }
      );
    }

    const shop = shopParam.toLowerCase();
    const subscription = await getActiveRoyaltySubscriptionByShop(shop);

    if (subscription) {
      return NextResponse.json({ active: true, subscription }, { status: 200 });
    } else {
      return NextResponse.json({ active: false }, { status: 200 });
    }
  } catch (e: any) {
    console.error("❌ Error fetching billing status:", e);
    return NextResponse.json(
      { error: "Internal server error", message: e.message },
      { status: 500 }
    );
  }
}

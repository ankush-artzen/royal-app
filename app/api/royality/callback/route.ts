import { NextRequest, NextResponse } from "next/server";
import { findSessionsByShop } from "@/lib/db/session-storage";
import prisma from "@/lib/db/prisma-connect";

const API_VERSION = "2025-07";

export async function GET(req: NextRequest) {
  console.log("===== 🟢 Billing Callback Handler START =====");
  console.log("🔗 Incoming request URL:", req.url);

  try {
    const { searchParams } = new URL(req.url);
    let shop = searchParams.get("shop") || "";
    const chargeId = searchParams.get("charge_id") || "";
    let hostParam = searchParams.get("host") || "";

    // Decode host if needed
    if (!shop && hostParam) {
      try {
        const decodedHost = Buffer.from(hostParam, "base64").toString("utf8");
        shop = decodedHost.replace("/admin", "");
      } catch (err) {
        console.error("⚠️ Failed to decode host:", err);
      }
    }

    console.log("🔎 Extracted:", { shop, chargeId, hostParam });

    // Always try to fetch token
    const sessions = shop ? await findSessionsByShop(shop) : [];
    const token = sessions?.[0]?.accessToken;

    // Always try to fetch charge
    let rac: any = null;
    if (shop && chargeId && token) {
      const chargeUrl = `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges/${chargeId}.json`;
      const resp = await fetch(chargeUrl, {
        headers: { "X-Shopify-Access-Token": token },
      });
      const data = await resp.json();
      rac = data?.recurring_application_charge || null;

      // Try activation if still pending
      if (rac?.status === "pending") {
        const activateUrl = `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges/${chargeId}/activate.json`;
        const activateRes = await fetch(activateUrl, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": token,
            "Content-Type": "application/json",
          },
        });
        const activateData = await activateRes.json();
        rac = activateData?.recurring_application_charge || rac;
      }

      // Save to DB even if not active yet
      if (rac) {
        await prisma.royaltySubscription.upsert({
          where: { shop },
          update: {
            chargeId: rac.id?.toString(),
            planName: rac.name,
            cappedAmount: rac.capped_amount
              ? parseFloat(rac.capped_amount)
              : null,
            currency: rac.currency,
            status: rac.status,
            test: rac.test,
          },
          create: {
            shop,
            chargeId: rac.id?.toString(),
            planName: rac.name,
            cappedAmount: rac.capped_amount
              ? parseFloat(rac.capped_amount)
              : null,
            currency: rac.currency,
            status: rac.status,
            test: rac.test,
          },
        });
      }
    }

    // Fallback host generation
    if (!hostParam && shop) {
      hostParam = Buffer.from(`${shop}/admin`, "utf8")
        .toString("base64")
        .replace(/=/g, "");
    }

    // Always redirect back
    const redirectUrl = shop && hostParam
      ? `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/royalty/billing/start?host=${hostParam}`
      : `${process.env.HOST}/app?billing=done`;

    console.log("🚀 Redirecting to:", redirectUrl);
    console.log("===== 🟢 Billing Callback Handler END =====");

    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error("❌ Callback error:", error?.message || error);
    console.log("===== 🔴 Billing Callback Handler CRASH =====");
    return NextResponse.redirect(`${process.env.HOST}/app?billing=error`);
  }
}

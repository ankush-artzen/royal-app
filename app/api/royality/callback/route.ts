import { NextRequest, NextResponse } from "next/server";
import { findSessionsByShop } from "@/lib/db/session-storage";
import prisma from "@/lib/db/prisma-connect";

const API_VERSION = "2025-07";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let shop = searchParams.get("shop");
    const chargeId = searchParams.get("charge_id");
    const hostParam = searchParams.get("host");

    console.log("🔎 Callback params:", { shop, chargeId, hostParam });

    // Fallback: if no shop param, try to decode from host
    if (!shop && hostParam) {
      const decodedHost = Buffer.from(hostParam, "base64").toString("utf8");
      shop = decodedHost.replace("/admin", "");
      console.log("ℹ️ Extracted shop from host:", shop);
    }

    if (!shop || !chargeId) {
      console.error("❌ Missing shop or chargeId in callback");
      return NextResponse.redirect(`${process.env.HOST}/app?billing=missing_params`);
    }

    // Find the access token from session DB
    const sessions = await findSessionsByShop(shop);
    const token = sessions?.[0]?.accessToken;

    if (!token) {
      console.error("❌ No access token found for shop:", shop);
      return NextResponse.redirect(`${process.env.HOST}/app?billing=no_token`);
    }

    // 1️⃣ Fetch charge info
    const resp = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges/${chargeId}.json`,
      { headers: { "X-Shopify-Access-Token": token } }
    );

    const data = await resp.json();
    console.log("🔎 Charge response:", data);

    const rac = data?.recurring_application_charge;
    if (!resp.ok || !rac) {
      console.error("❌ Failed to fetch charge info");
      return NextResponse.redirect(`${process.env.HOST}/app?billing=fetch_failed`);
    }

    // 2️⃣ If charge is still pending → activate it
    if (rac.status === "pending") {
      console.log("ℹ️ Charge is pending, activating...");

      const activateRes = await fetch(
        `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges/${chargeId}/activate.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": token,
            "Content-Type": "application/json",
          },
        }
      );

      const activateData = await activateRes.json();
      console.log("🔑 Activated charge response:", activateData);

      if (!activateRes.ok) {
        console.error("❌ Failed to activate charge");
        return NextResponse.redirect(`${process.env.HOST}/app?billing=activation_failed`);
      }

      // Replace rac with activated version
      Object.assign(rac, activateData?.recurring_application_charge);
    }

    // 3️⃣ Ensure charge is active
    if (rac.status !== "active") {
      console.error("❌ Charge is not active:", rac.status);
      return NextResponse.redirect(`${process.env.HOST}/app?billing=not_active`);
    }

    // 4️⃣ Save subscription in DB
    await prisma.royaltySubscription.upsert({
      where: { shop },
      update: {
        chargeId: rac.id.toString(),
        planName: rac.name,
        cappedAmount: rac.capped_amount ? parseFloat(rac.capped_amount) : null,
        currency: rac.currency,
        status: rac.status,
        test: rac.test,
      },
      create: {
        shop,
        chargeId: rac.id.toString(),
        planName: rac.name,
        cappedAmount: rac.capped_amount ? parseFloat(rac.capped_amount) : null,
        currency: rac.currency,
        status: rac.status,
        test: rac.test,
      },
    });

    console.log("✅ Subscription saved for shop:", shop);

    // 5️⃣ Handle host param properly
    let finalHost = hostParam;
    if (!finalHost && shop) {
      finalHost = Buffer.from(`${shop}/admin`, "utf8").toString("base64").replace(/=/g, "");
      console.log("ℹ️ Generated fallback host (local dev):", finalHost);
    }

    if (!finalHost) {
      console.error("❌ Missing host param and unable to generate fallback");
      return NextResponse.redirect(`${process.env.HOST}/app?billing=no_host`);
    }

    // 6️⃣ Redirect back to Shopify app
    const redirectUrl = `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/royalty/billing/start?host=${finalHost}`;
    console.log("✅ Redirecting back to Shopify app:", redirectUrl);

    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error("❌ Callback error:", error?.message || error);
    return NextResponse.redirect(`${process.env.HOST}/app?billing=error`);
  }
}

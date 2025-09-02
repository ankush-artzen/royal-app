import "@shopify/shopify-api/adapters/node";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { findSessionsByShop } from "@/lib/db/session-storage";
import prisma from "@/lib/db/prisma-connect";

const API_VERSION = "2025-07";

export async function POST(req: NextRequest) {
  console.log("➡️ Incoming royalty create request");

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    console.warn("⚠️ No JSON body found, falling back to query params only");
  }

  try {
    console.log("📦 Request body:", body);

    const { name, price, cappedAmount, terms, test } = body;
    const url = new URL(req.url);
    const queryShop = url.searchParams.get("shop");
    const queryHost = url.searchParams.get("host");
    const bodyShop = body?.shop;

    // Get cookie store
    const cookieStore = cookies();

    // Resolve shop: body > query param > cookie
    const shop = bodyShop || queryShop || cookieStore.get("shop")?.value;
    if (!shop) {
      return NextResponse.json({ error: "shop is required" }, { status: 400 });
    }

    // ✅ Fetch token from DB first, then fallback to cookie
    let token = (await findSessionsByShop(shop))?.[0]?.accessToken || cookieStore.get("accessToken")?.value;
    console.log("🏪 Shop:", shop);
    console.log("🔑 Token source:", token ? "✅ Found" : "❌ Missing");

    if (!token) {
      return NextResponse.json({ error: "No access token available for shop" }, { status: 401 });
    }

    if (!name || price === undefined) {
      return NextResponse.json({ error: "name and price are required" }, { status: 400 });
    }

    // Ensure host param is passed
    let hostParam = queryHost;
    if (!hostParam) {
      hostParam = Buffer.from(`${shop}/admin`, "utf8").toString("base64").replace(/=/g, "");
      console.log("ℹ️ Generated fallback host:", hostParam);
    }

    // Build Shopify payload
    const bodyPayload: any = {
      recurring_application_charge: {
        name,
        price,
        return_url: `${process.env.HOST?.replace(/\/$/, "")}/api/royality/callback?shop=${shop}&host=${hostParam}`,
        test: test ?? true,
      },
    };

    // Handle capped amount for free plans
    if (parseFloat(String(price)) === 0.0) {
      if (!cappedAmount || !terms) {
        return NextResponse.json(
          { error: "For price=0.00, cappedAmount and terms are required" },
          { status: 400 }
        );
      }
      bodyPayload.recurring_application_charge.capped_amount = cappedAmount;
      bodyPayload.recurring_application_charge.terms = terms;
    }

    console.log("📤 Sending request to Shopify:", JSON.stringify(bodyPayload, null, 2));

    // Call Shopify API
    const resp = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges.json`,
      {
        method: "POST",
        headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      }
    );

    const data = await resp.json();
    console.log("📥 Shopify response:", JSON.stringify(data, null, 2));

    if (!resp.ok) {
      return NextResponse.json({ error: "Shopify error", details: data }, { status: resp.status });
    }

    const rac = data?.recurring_application_charge;
    const confirmationUrl = rac?.confirmation_url;
    if (!confirmationUrl) {
      return NextResponse.json({ error: "Missing confirmation_url from Shopify" }, { status: 502 });
    }

    console.log("✅ Charge created successfully:", confirmationUrl);

    // Save/Update subscription in DB
    try {
      await prisma.royaltySubscription.upsert({
        where: { shop },
        update: {
          chargeId: String(rac.id),
          planName: rac.name,
          cappedAmount: rac.capped_amount ? parseFloat(rac.capped_amount) : null,
          currency: rac.currency || "USD",
          status: rac.status,
          test: rac.test,
        },
        create: {
          shop,
          chargeId: String(rac.id),
          planName: rac.name,
          cappedAmount: rac.capped_amount ? parseFloat(rac.capped_amount) : null,
          currency: rac.currency || "USD",
          status: rac.status,
          test: rac.test,
        },
      });
      console.log("🗄️ Saved subscription in DB");
    } catch (dbErr) {
      console.error("💥 Failed to save subscription in DB:", dbErr);
    }

    return NextResponse.json({ confirmationUrl, rac });
  } catch (e: any) {
    console.error("💥 Unexpected error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

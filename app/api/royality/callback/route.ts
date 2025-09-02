import { NextRequest, NextResponse } from "next/server";
import { findSessionsByShop } from "@/lib/db/session-storage";
import prisma from "@/lib/db/prisma-connect";

const API_VERSION = "2025-07";

export async function GET(req: NextRequest) {
  try {
    const normalizedUrl = req.url.replace(/([^:]\/)\/+/g, "$1");
    const { searchParams } = new URL(normalizedUrl);

    let shop = searchParams.get("shop");
    const chargeId = searchParams.get("charge_id");
    const hostParam = searchParams.get("host");

    console.log("🔎 Callback params:", { shop, chargeId, hostParam });

    if (!shop && hostParam) {
      const decodedHost = Buffer.from(hostParam, "base64").toString("utf8");
      shop = decodedHost.replace("/admin", "");
      console.log("ℹ️ Extracted shop from host:", shop);
    }

    if (!shop || !chargeId) {
      return NextResponse.redirect(`${process.env.HOST}/app?billing=missing_params`);
    }

    // ✅ Get token
    const sessions = await findSessionsByShop(shop);
    const token = sessions?.[0]?.accessToken;

    if (!token) {
      return NextResponse.redirect(`${process.env.HOST}/app?billing=no_token`);
    }

    // 1️⃣ Fetch charge info
    const resp = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges/${chargeId}.json`,
      { headers: { "X-Shopify-Access-Token": token } }
    );

    const data = await resp.json();
    let rac = data?.recurring_application_charge;

    if (!resp.ok || !rac) {
      return NextResponse.redirect(`${process.env.HOST}/app?billing=fetch_failed`);
    }

    // 2️⃣ Handle $0 + capped charges differently
    if (parseFloat(rac.price) === 0 && rac.capped_amount && rac.status === "pending") {
      console.log("ℹ️ $0 + capped charge requires merchant confirmation");
      return NextResponse.redirect(rac.confirmation_url); // <-- redirect merchant to confirm charge
    }

    // 3️⃣ Activate charge if pending (non-$0 charges)
    if (rac.status === "pending") {
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
      if (!activateRes.ok) {
        return NextResponse.redirect(`${process.env.HOST}/app?billing=activation_failed`);
      }
      rac = activateData?.recurring_application_charge || rac;
    }

    // 4️⃣ Must be active before saving
    if (rac.status !== "active") {
      return NextResponse.redirect(`${process.env.HOST}/app?billing=not_active`);
    }

    // 5️⃣ Save subscription in DB
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

    // 6️⃣ Handle host param
    let finalHost = hostParam;
    if (!finalHost && shop) {
      finalHost = Buffer.from(`${shop}/admin`, "utf8").toString("base64").replace(/=/g, "");
    }
    if (!finalHost) {
      return NextResponse.redirect(`${process.env.HOST}/app?billing=no_host`);
    }

    // 7️⃣ Redirect back to Shopify app dynamically
    const shopAlias = shop.replace(".myshopify.com", "");
    const appHandle = process.env.SHOPIFY_APP_HANDLE; // must match your Partner Dashboard app handle

    const redirectUrl = `https://admin.shopify.com/store/${shopAlias}/apps/${appHandle}?host=${finalHost}`;
    console.log("✅ Redirecting back to Shopify app:", redirectUrl);

    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error("❌ Callback error:", error?.message || error);
    return NextResponse.redirect(`${process.env.HOST}/app?billing=error`);
  }
}

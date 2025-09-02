import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma-connect";
import { createRoyaltyTransactionForOrder } from "@/lib/helper/createRoyaltyTransactionForOrder";

export async function POST(req: NextRequest) {
  try {
    console.log("✅ Orders webhook hit at", new Date().toISOString());

    const shop = req.headers.get("x-shopify-shop-domain") || "";
    const body = await req.json();

    const orderId = body.id?.toString();
    const orderName = body.name;
    const createdAt = new Date(body.created_at);
    const currency = body.currency || "USD";

    if (!orderId || !body.line_items) {
      return NextResponse.json(
        { success: false, message: "Invalid order data" },
        { status: 400 }
      );
    }

    const lineItemsToAdd: any[] = [];

    for (const item of body.line_items) {
      const productIdNumeric = item.product_id.toString();
      const productIdGid = `gid://shopify/Product/${productIdNumeric}`;

      const royalties = await prisma.productRoyalty.findMany({
        where: {
          shop,
          OR: [{ shopifyId: productIdNumeric }, { shopifyId: productIdGid }],
        },
      });

      if (!royalties.length) continue;

      const quantity = item.quantity;
      const unitPrice = parseFloat(item.price);
      const lineTotal = unitPrice * quantity;

      for (const royalty of royalties) {
        const productRoyalityCalculatedAmount =
          (lineTotal * royalty.Royality) / 100;

        lineItemsToAdd.push({
          productId: royalty.productId,
          title: item.title,
          variantId: item.variant_id?.toString() || "",
          variantTitle: item.variant_title || "",
          designerId: royalty.designerId,
          productRoyalityCalculatedAmount,
          quantity,
          unitPrice,
          royaltypercentage: royalty.Royality,
        });
      }
    }

    if (lineItemsToAdd.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No royalty products in this order",
      });
    }

    let royaltyOrder = await prisma.royaltyOrder.findFirst({
      where: { shop, orderId },
    });

    if (!royaltyOrder) {
      royaltyOrder = await prisma.royaltyOrder.create({
        data: {
          shop,
          orderId,
          orderName,
          currency,
          lineItem: lineItemsToAdd,
          createdAt,
          calculatedroyaltyamount: lineItemsToAdd.reduce(
            (sum, li) => sum + li.productRoyalityCalculatedAmount,
            0
          ),
        },
      });
    } else {
      royaltyOrder = await prisma.royaltyOrder.update({
        where: { id: royaltyOrder.id },
        data: {
          lineItem: {
            set: [...royaltyOrder.lineItem, ...lineItemsToAdd],
          },
          calculatedroyaltyamount:
            royaltyOrder.calculatedroyaltyamount +
            lineItemsToAdd.reduce(
              (sum, li) => sum + li.productRoyalityCalculatedAmount,
              0
            ),
        },
      });
    }

    const description = `Royalty payment for order ${royaltyOrder.orderName}`;
    const price = royaltyOrder.calculatedroyaltyamount;

    await createRoyaltyTransactionForOrder({
      shop,
      orderId,
      description,
      price,
      currency,
    });

    return NextResponse.json({
      success: true,
      royaltyOrder,
    });
  } catch (error: any) {
    console.error("❌ Error processing order webhook:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

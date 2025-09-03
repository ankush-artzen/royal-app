// import { NextRequest, NextResponse } from "next/server";
// import prisma from "@/lib/db/prisma-connect";

// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);

//     const shop = searchParams.get("shop");
//     const designerId = searchParams.get("designerId");
//     const productId = searchParams.get("productId");

//     if (!shop) {
//       return NextResponse.json(
//         { error: "Missing shop parameter" },
//         { status: 400 }
//       );
//     }

//     // Build query conditions
//     const where: any = { shop };
//     if (designerId) where.designerId = designerId;
//     if (productId) where.productId = productId;

//     const royalties = await prisma.productRoyalty.findMany({
//       where,
//     });

//     return NextResponse.json({ royalties });
//   } catch (err: any) {
//     console.error("Error fetching royalties:", err);
//     return NextResponse.json(
//       { error: err.message || "Internal server error" },
//       { status: 500 }
//     );
//   }
// }
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma-connect";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const shop = searchParams.get("shop");
    const designerId = searchParams.get("designerId");
    const productId = searchParams.get("productId");
    const status = searchParams.get("status"); // optional: filter by royalty status

    // 🔹 Mandatory shop parameter
    if (!shop) {
      return NextResponse.json(
        { error: "Missing shop parameter" },
        { status: 400 }
      );
    }

    // 🔹 Build dynamic query conditions
    const where: any = { shop };
    if (designerId) where.designerId = designerId;
    if (productId) where.productId = productId;
    if (status) where.status = status; // e.g., active/inactive

    // 🔹 Fetch all products with royalties
    const royalties = await prisma.productRoyalty.findMany({
      where,
      // orderBy: { createdAt: "desc" }, // newest first
    });

    // 🔹 Return message if no royalty products found
    if (!royalties || royalties.length === 0) {
      return NextResponse.json(
        { message: "No royalty products found", royalties: [] },
        { status: 200 }
      );
    }

    // 🔹 Return all royalty products
    return NextResponse.json({ royalties });
  } catch (err: any) {
    console.error("Error fetching royalty products:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

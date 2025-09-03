// import { NextRequest, NextResponse } from "next/server";
// import prisma from "@/lib/db/prisma-connect";

// export async function PUT(
//   req: NextRequest,
//   { params }: { params: { id: string } } 
// ) {
//   try {
//     const { id } = params;
//     const { searchParams } = new URL(req.url);
//     const shop = searchParams.get("shop");

//     if (!shop) {
//       return NextResponse.json(
//         { error: "Missing shop parameter" },
//         { status: 400 }
//       );
//     }

//     if (!id) {
//       return NextResponse.json(
//         { error: "Missing product ID in URL" },
//         { status: 400 }
//       );
//     }

//     const body = await req.json();
//     const { designerId, Royality } = body;

//     if (Royality !== undefined && isNaN(Royality)) {
//       return NextResponse.json(
//         { error: "Invalid Royality value" },
//         { status: 400 }
//       );
//     }

//     // Find the royalty record directly by raw Shopify product ID
//     const royalty = await prisma.productRoyalty.findFirst({
//       where: { shopifyId: id, shop },
//     });

//     if (!royalty) {
//       return NextResponse.json(
//         { error: "No royalty found for this product" },
//         { status: 404 }
//       );
//     }

//     // Update royalty
//     const updatedRoyalty = await prisma.productRoyalty.update({
//       where: { id: royalty.id },
//       data: {
//         ...(designerId && { designerId }),
//         ...(Royality !== undefined && { Royality: parseFloat(Royality) }),
//       },
//     });

//     return NextResponse.json({
//       message: "Royalty updated successfully",
//       royalty: updatedRoyalty,
//     });
//   } catch (error: any) {
//     console.error("Error updating royalty:", error);
//     return NextResponse.json(
//       { error: error.message || "Internal Server Error" },
//       { status: 500 }
//     );
//   }
// }
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma-connect";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json(
        { error: "Missing shop parameter" },
        { status: 400 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "Missing product ID in URL" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { designerId, Royality } = body;

    if (Royality !== undefined && isNaN(Number(Royality))) {
      return NextResponse.json(
        { error: "Invalid Royality value" },
        { status: 400 }
      );
    }

    // Find the royalty record by Shopify product ID and shop
    const royalty = await prisma.productRoyalty.findFirst({
      where: { shopifyId: id, shop },
    });

    if (!royalty) {
      return NextResponse.json(
        { error: "No royalty found for this product" },
        { status: 404 }
      );
    }

    // Update royalty
    const updatedRoyalty = await prisma.productRoyalty.update({
      where: { id: royalty.id },
      data: {
        ...(designerId && { designerId }),
        ...(Royality !== undefined && { Royality: Number(Royality) }),
      },
    });

    return NextResponse.json({
      message: "Royalty updated successfully",
      royalty: updatedRoyalty,
    });
  } catch (error: any) {
    console.error("Error updating royalty:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// import { NextRequest, NextResponse } from "next/server";
// import prisma from "@/lib/db/prisma-connect";
// import { ObjectId } from "mongodb";

// export async function POST(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const shop = searchParams.get("shop");

//     const body = await req.json();
//     const {
//       designerId,
//       productId,
//       Royality,
//       title,
//       image,
//       status,
//       price,
//       shopifyId,
//     } = body;

//     // 🔹 Basic validation
//     if (
//       !shop ||
//       !productId ||
//       !Royality ||
//       isNaN(Royality) ||
//       !title ||
//       !designerId
//     ) {
//       return NextResponse.json(
//         {
//           error:
//             "Missing or invalid shop, productId, title, Royality, or designerId",
//         },
//         { status: 400 }
//       );
//     }

//     if (!ObjectId.isValid(designerId)) {
//       return NextResponse.json(
//         { error: `Invalid Designer ID format: ${designerId}` },
//         { status: 400 }
//       );
//     }

//     // 🔹 Check if designer exists
//     const designerExists = await prisma.designer.findUnique({
//       where: { id: designerId },
//     });

//     if (!designerExists) {
//       return NextResponse.json(
//         {
//           error: `Designer with ID ${designerId} not found.`,
//         },
//         { status: 404 }
//       );
//     }

//     // 🔹 Check if royalty already exists
//     const existingRoyalty = await prisma.productRoyalty.findFirst({
//       where: { productId, designerId },
//     });

//     if (existingRoyalty) {
//       return NextResponse.json(
//         {
//           error: "Royalty already assigned for this product & designer",
//         },
//         { status: 400 }
//       );
//     }

//     // 🔹 Create royalty
//     const royalty = await prisma.productRoyalty.create({
//       data: {
//         productId,
//         shopifyId: shopifyId || productId,
//         title,
//         image: image || null,
//         status: status || "active",
//         price: price ? parseFloat(price) : null,
//         designerId,
//         Royality: parseFloat(Royality),
//         shop,
//       },
//     });

//     return NextResponse.json({
//       message: "Royalty assigned successfully",
//       royalty,
//     });
//   } catch (err: any) {
//     console.error("Error creating royalty:", err);
//     return NextResponse.json(
//       { error: "Something went wrong while assigning royalty." },
//       { status: 500 }
//     );
//   }
// }
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma-connect";
import { ObjectId } from "mongodb";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    const body = await req.json();
    const {
      designerId,
      productId,
      Royality,
      title,
      image,
      status,
      price,
      shopifyId,
    } = body;

    // 🔹 Basic validation for required fields
    if (
      !shop ||
      !productId ||
      !Royality ||
      isNaN(Royality) ||
      !title ||
      !designerId
    ) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid shop, productId, title, Royality, or designerId",
        },
        { status: 400 }
      );
    }

    // 🔹 Ensure designerId is a valid ObjectId format
    if (!ObjectId.isValid(designerId)) {
      return NextResponse.json(
        { error: `Invalid Designer ID format: ${designerId}` },
        { status: 400 }
      );
    }

    // 🔹 (COMMENTED OUT) Designer existence check
    //   👉 Skipped since you want to enter designerId manually
    /*
    const designerExists = await prisma.designer.findUnique({
      where: { id: designerId },
    });

    if (!designerExists) {
      return NextResponse.json(
        {
          error: `Designer with ID ${designerId} not found.`,
        },
        { status: 404 }
      );
    }
    */

    // 🔹 Ensure this product is NOT already assigned to another designer
    const productAlreadyAssigned = await prisma.productRoyalty.findFirst({
      where: { productId },
    });

    if (productAlreadyAssigned) {
      return NextResponse.json(
        {
          error: `This product is already assigned to designer ${productAlreadyAssigned.designerId}`,
        },
        { status: 400 }
      );
    }

    // 🔹 Extra check (not strictly needed since productAlreadyAssigned covers it)
    //   But this prevents duplicate (productId + designerId) combinations
    const existingRoyalty = await prisma.productRoyalty.findFirst({
      where: { productId, designerId },
    });

    if (existingRoyalty) {
      return NextResponse.json(
        {
          error: "Royalty already assigned for this product & designer",
        },
        { status: 400 }
      );
    }

    // 🔹 Create royalty record
    const royalty = await prisma.productRoyalty.create({
      data: {
        productId,
        shopifyId: shopifyId || productId, // fallback if shopifyId not provided
        title,
        image: image || null,
        status: status || "active",
        price: price ? parseFloat(price) : null,
        designerId, // directly use manual designerId
        Royality: parseFloat(Royality),
        shop,
      },
    });

    return NextResponse.json({
      message: "Royalty assigned successfully",
      royalty,
    });
  } catch (err: any) {
    console.error("Error creating royalty:", err);
    return NextResponse.json(
      { error: "Something went wrong while assigning royalty." },
      { status: 500 }
    );
  }
}

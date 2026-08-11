import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/auth-middleware";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const user = await verifyFirebaseToken(request);
    if ('error' in user) {
      return NextResponse.json({ error: user.error }, { status: user.status });
    }

    const body = await request.json();
    const { paramsToSign } = body;

    if (!paramsToSign) {
      return NextResponse.json({ error: "Missing paramsToSign" }, { status: 400 });
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET as string
    );

    return NextResponse.json({ signature });
  } catch (error) {
    console.error("Error signing Cloudinary request:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function uploadImage(file: File): Promise<string> {
  // 1. Get signature
  const timestamp = Math.round((new Date()).getTime() / 1000);

  // Actually, standard signed upload flow:
  // 1. Prepare params (timestamp, etc)
  // 2. Send to backend to sign
  // 3. Receive signature
  // 4. Send to Cloudinary with signature & apiKey

  const signResponse = await fetch("/api/sign-cloudinary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paramsToSign: {
        timestamp,
      },
    }),
  });

  const { signature } = await signResponse.json();
  if (!signature) {
    throw new Error("Failed to get upload signature");
  }

  // 2. Upload to Cloudinary
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;

  if (!cloudName || !apiKey) {
    throw new Error("Cloudinary configuration missing");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Upload failed");
  }

  const data = await response.json();
  return data.secure_url;
}

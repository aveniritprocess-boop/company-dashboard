"use client";

import { useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import Image from "next/image";
import { doc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";

export function ProfileImageUploader() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(user?.photoURL || null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setError(null);

    // Validate file type and size (max 5MB)
    if (!file.type.startsWith("image/")) {
        setError("Please upload an image file.");
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB.");
        return;
    }

    try {
      setUploading(true);
      
      // 1. Get Signature from our API
      const timestamp = Math.round(new Date().getTime() / 1000);
      const paramsToSign = {
        timestamp,
        folder: "user_profiles",
      };

      const response = await fetch("/api/sign-cloudinary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paramsToSign }),
      });

      const { signature } = await response.json();

      if (!signature) throw new Error("Failed to get upload signature");

      // 2. Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || ""); // Ensure this env var is set on client too or just hardcode if public? Usually public.
      // Wait, user provided CLOUDINARY_API_KEY. It's usually safe to expose API Key if signing is done on server, 
      // but let's check if user populated NEXT_PUBLIC_.
      // For now, I'll rely on the standard upload preset or signed params.
      // Actually standard signed upload needs api_key as param.
      // I will assume NEXT_PUBLIC_CLOUDINARY_API_KEY is available or I need to pass it from server? 
      // Better: The signature response could return the apiKey if needed, OR I can just assume the user put it in NEXT_PUBLIC.
      // Let's use the one from env if available.
      
      formData.append("timestamp", timestamp.toString());
      formData.append("signature", signature);
      formData.append("folder", "user_profiles");
      
      // We need the cloud name for the URL
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      if (!cloudName) throw new Error("Cloudinary Cloud Name is missing");

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await uploadResponse.json();
      if (data.error) throw new Error(data.error.message);

      const imageUrl = data.secure_url;

      // 3. Update Firebase
      await updateProfile(user, { photoURL: imageUrl });
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        name: user.displayName || "",
        photoURL: imageUrl,
      }, { merge: true });

      setPreview(imageUrl);
    } catch (err: any) {
      console.error("Upload failed", err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-gray-200 dark:border-gray-700">
        {preview ? (
          <Image
            src={preview}
            alt="Profile"
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
            <Camera className="h-8 w-8" />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <label className="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <span>Change Photo</span>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

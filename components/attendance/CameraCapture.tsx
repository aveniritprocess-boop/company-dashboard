"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Camera, RefreshCw } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel?: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Held in a ref as well as state: the unmount cleanup below runs with an empty
  // dependency array, so it closes over the FIRST render's value. Reading the
  // stream from state there always saw null and the camera tracks were never
  // stopped — leaving the device camera (and its indicator light) running after
  // the capture UI closed. A ref is not captured by that stale closure.
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      // Release any previous stream before requesting a new one, so retrying
      // cannot leave an orphaned track running.
      stopCamera();
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("[attendance] camera initialisation failed:", err);

      // getUserMedia failures are not all permission problems. Reporting every
      // one as "allow camera permissions" sent diagnosis down the wrong path,
      // so distinguish the standard DOMException names. None of these expose
      // sensitive data.
      const name = (err as { name?: string })?.name || "";
      const detail =
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access for this site in your browser, then retry."
          : name === "NotFoundError" || name === "OverconstrainedError"
          ? "No camera was found on this device."
          : name === "NotReadableError"
          ? "The camera is already in use by another application. Close it and retry."
          : name === "SecurityError"
          ? "The browser blocked camera access for this page (insecure context or permissions policy)."
          : `Unable to access camera${name ? ` (${name})` : ""}.`;

      setError(detail);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(videoRef.current, 0, 0);

    // Convert to Blob/File
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `attendance-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      }
    }, "image/jpeg", 0.8);
  }, [onCapture]);

  const handleRetry = () => {
    setError(null);
    startCamera();
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
      {error ? (
        <div className="flex flex-col items-center text-center p-8 space-y-4">
          <p className="text-red-500">{error}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-lg bg-black aspect-video w-full max-w-sm">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-4">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            )}
            <button
              onClick={capturePhoto}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm"
            >
              <Camera className="h-4 w-4" /> Capture Photo
            </button>
          </div>
        </>
      )}
    </div>
  );
}

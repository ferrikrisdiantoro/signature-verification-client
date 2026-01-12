"use client";

import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import Cropper from "react-easy-crop";
import { Camera01Icon, CheckmarkCircle01Icon, Cancel01Icon, Image01Icon, ArrowRight01Icon } from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { verifySignature } from "@/lib/inference";
import { cn } from "@/lib/utils";

// Mock User List (42 Users)
const USERS = Array.from({ length: 42 }, (_, i) => ({
    id: i,
    name: `Respondent ${i + 1}`,
    anchorPath: `/anchors/user_${i}.png` // Assuming this structure
}));

export default function SignatureVerifier() {
    const [step, setStep] = useState<"select" | "capture" | "crop" | "result">("select");
    const [selectedUserId, setSelectedUserId] = useState<number>(0);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [croppedImage, setCroppedImage] = useState<string | null>(null);

    // Crop State
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    // Result State
    const [isVerifying, setIsVerifying] = useState(false);
    const [result, setResult] = useState<{ score: number; isMatch: boolean } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const webcamRef = useRef<Webcam>(null);

    // Capture
    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setImageSrc(imageSrc);
            setStep("crop");
        }
    }, [webcamRef]);

    // Crop Complete
    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    // Generate Cropped Image
    const showCroppedImage = async () => {
        try {
            const croppedImage = await getCroppedImg(imageSrc!, croppedAreaPixels);
            setCroppedImage(croppedImage);
            setStep("result");
            handleVerify(croppedImage);
        } catch (e) {
            console.error(e);
        }
    };

    // Verification Logic
    const handleVerify = async (capturedImg: string) => {
        setIsVerifying(true);
        setError(null);
        try {
            const user = USERS.find(u => u.id === Number(selectedUserId));
            if (!user) throw new Error("User not found");

            // Verify against anchor
            // Note: In a real app, anchor images must exist. 
            // If they don't, this will fail. We'll add a catch.
            const res = await verifySignature(capturedImg, user.anchorPath);
            setResult(res);
        } catch (err: any) {
            console.error(err);
            // Fallback or Error message
            setError("Failed to verify. Ensure model is loaded and anchor images exist in /public/anchors/.");
        } finally {
            setIsVerifying(false);
        }
    };

    // Helper for cropping
    const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
        const image = new Image();
        image.src = imageSrc;
        await new Promise((resolve) => (image.onload = resolve));

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return "";

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return canvas.toDataURL("image/jpeg");
    };

    const reset = () => {
        setStep("select");
        setImageSrc(null);
        setCroppedImage(null);
        setResult(null);
        setError(null);
    };

    return (
        <Card className="w-full max-w-md mx-auto shadow-lg border-slate-200">
            <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold text-slate-800">Signature Verification</CardTitle>
                <CardDescription>AI-Powered Authenticity Check</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Step 1: Select User */}
                {step === "select" && (
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700">Select Respondent</label>
                        <select
                            className="w-full p-2 border rounded-md border-slate-300"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(Number(e.target.value))}
                        >
                            {USERS.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                        <Button className="w-full" onClick={() => setStep("capture")}>
                            Next <ArrowRight01Icon className="ml-2 w-4 h-4" />
                        </Button>
                    </div>
                )}

                {/* Step 2: Capture */}
                {step === "capture" && (
                    <div className="space-y-4">
                        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: "environment" }} // Use back camera
                                className="w-full h-full object-cover"
                            />
                            {/* Overlay for Box Card - Kartu Kontrol Frame */}
                            <div className="absolute inset-0 border-2 border-white/50 pointer-events-none flex items-center justify-center">
                                <div className="w-[80%] h-[20%] border-2 border-green-400 rounded-md box-content shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                                <p className="absolute bottom-4 text-white text-xs bg-black/50 px-2 py-1 rounded">Align Signature inside Green Box</p>
                            </div>
                        </div>
                        <Button className="w-full" onClick={capture}>
                            <Camera01Icon className="mr-2 w-4 h-4" /> Capture Photo
                        </Button>
                        <Button variant="ghost" className="w-full" onClick={() => setStep("select")}>Back</Button>
                    </div>
                )}

                {/* Step 3: Crop */}
                {step === "crop" && imageSrc && (
                    <div className="space-y-4">
                        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={3 / 1} // Signature aspect ratio roughly
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>
                        <p className="text-xs text-center text-muted-foreground">Pinch or scroll to zoom. Drag to verify area.</p>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setStep("capture")}>Retake</Button>
                            <Button className="flex-1" onClick={showCroppedImage}>Verify Signature</Button>
                        </div>
                    </div>
                )}

                {/* Step 4: Result */}
                {step === "result" && (
                    <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
                        {croppedImage && (
                            <img src={croppedImage} alt="Captured" className="h-20 mx-auto border rounded shadow-sm" />
                        )}

                        {isVerifying ? (
                            <div className="py-8">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                                <p className="mt-2 text-sm text-muted-foreground">Analyzing biometrics...</p>
                            </div>
                        ) : error ? (
                            <div className="py-4 text-red-500 bg-red-50 rounded-lg">
                                <Cancel01Icon className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        ) : result ? (
                            <div className={cn(
                                "p-6 rounded-xl border-2",
                                result.score > 70 ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"
                            )}>
                                <div className="flex justify-center mb-2">
                                    {result.score > 70 ? (
                                        <CheckmarkCircle01Icon className="w-12 h-12 text-green-600" />
                                    ) : (
                                        <Cancel01Icon className="w-12 h-12 text-red-600" />
                                    )}
                                </div>
                                <h3 className="text-2xl font-bold">
                                    {result.score.toFixed(1)}% Match
                                </h3>
                                <p className={cn(
                                    "mt-1 font-medium",
                                    result.score > 70 ? "text-green-700" : "text-red-700"
                                )}>
                                    {result.score > 70 ? "Signature Verified (Genuine)" : "Signature Mismatch (Potential Fake)"}
                                </p>
                            </div>
                        ) : null}

                        <Button className="w-full" onClick={reset}>Verify Another</Button>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}

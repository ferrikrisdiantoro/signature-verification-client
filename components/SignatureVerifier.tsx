"use client";

import React, { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Camera01Icon, CheckmarkCircle01Icon, Cancel01Icon, UserIcon } from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { findBestMatch, dummyVerifySignature } from "@/lib/inference";

// Dynamic import for Webcam and Cropper to avoid SSR issues
// @ts-expect-error - dynamic import type mismatch with react-webcam
const Webcam = dynamic(() => import("react-webcam"), { ssr: false });
const Cropper = dynamic(() => import("react-easy-crop").then(mod => mod.default), { ssr: false });

// Configuration: set to true to use real ONNX model, false for dummy
const USE_REAL_MODEL = true; // Set to true when anchor images are ready

export default function SignatureVerifier() {
    const [step, setStep] = useState<"capture" | "crop" | "result">("capture");
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [croppedImage, setCroppedImage] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    // Crop State
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    // Result State
    const [isVerifying, setIsVerifying] = useState(false);
    const [result, setResult] = useState<{
        matchedRespondent: string;
        similarity: number;
        isMatch: boolean
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const webcamRef = useRef<any>(null);

    // Check if component is mounted (client-side only)
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    // Capture
    const capture = useCallback(() => {
        const screenshot = webcamRef.current?.getScreenshot();
        if (screenshot) {
            setImageSrc(screenshot);
            setStep("crop");
        }
    }, []);

    // Crop Complete
    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    // Generate Cropped Image
    const showCroppedImage = async () => {
        try {
            const cropped = await getCroppedImg(imageSrc!, croppedAreaPixels);
            setCroppedImage(cropped);
            setStep("result");
            handleVerify(cropped);
        } catch (e) {
            console.error(e);
        }
    };

    // Verification Logic
    const handleVerify = async (capturedImg: string) => {
        setIsVerifying(true);
        setError(null);
        try {
            let res;
            if (USE_REAL_MODEL) {
                // Use real ONNX model
                const match = await findBestMatch(capturedImg);
                res = {
                    matchedRespondent: match.respondent,
                    similarity: match.similarity,
                    isMatch: match.isMatch
                };
            } else {
                // Use dummy verification
                const dummy = dummyVerifySignature();
                // Add delay for UX
                await new Promise(resolve => setTimeout(resolve, 1500));
                res = {
                    matchedRespondent: dummy.respondent,
                    similarity: dummy.similarity,
                    isMatch: dummy.isMatch
                };
            }
            setResult(res);
        } catch (err: any) {
            console.error(err);
            setError("Gagal memverifikasi tanda tangan. Silakan coba lagi.");
        } finally {
            setIsVerifying(false);
        }
    };

    // Helper for cropping
    const getCroppedImg = async (src: string, pixelCrop: any): Promise<string> => {
        const image = new Image();
        image.src = src;
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
        setStep("capture");
        setImageSrc(null);
        setCroppedImage(null);
        setResult(null);
        setError(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    // Loading state for SSR
    if (!isMounted) {
        return (
            <Card className="w-full max-w-md mx-auto shadow-lg border-slate-200">
                <CardHeader className="text-center">
                    <CardTitle className="text-xl font-bold text-slate-800">Verifikasi Tanda Tangan</CardTitle>
                    <CardDescription>Sistem Kontrol Keaslian berbasis AI</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="aspect-[4/3] bg-slate-100 rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">Memuat kamera...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md mx-auto shadow-lg border-slate-200">
            <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold text-slate-800">Verifikasi Tanda Tangan</CardTitle>
                <CardDescription>Sistem Kontrol Keaslian berbasis AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Step 1: Capture */}
                {step === "capture" && (
                    <div className="space-y-4">
                        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                            {(() => {
                                const WebcamAny = Webcam as any;
                                return (
                                    <WebcamAny
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        videoConstraints={{ facingMode: "environment" }}
                                        className="w-full h-full object-cover"
                                    />
                                );
                            })()}
                            <div className="absolute inset-0 border-2 border-white/50 pointer-events-none flex items-center justify-center">
                                <div className="w-[60%] aspect-square border-2 border-green-400 rounded-md box-content shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                                <p className="absolute bottom-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
                                    Posisikan tanda tangan di dalam kotak hijau
                                </p>
                            </div>
                        </div>
                        <Button className="w-full" onClick={capture}>
                            <Camera01Icon className="mr-2 w-4 h-4" /> Ambil Foto
                        </Button>
                    </div>
                )}

                {/* Step 2: Crop */}
                {step === "crop" && imageSrc && (
                    <div className="space-y-4">
                        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                            {/* @ts-expect-error - props type mismatch with dynamic import */}
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                            Cubit untuk zoom. Geser untuk memilih area tanda tangan.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setStep("capture")}>
                                Ulangi
                            </Button>
                            <Button className="flex-1" onClick={showCroppedImage}>
                                Verifikasi
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Result */}
                {step === "result" && (
                    <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
                        {croppedImage && (
                            <img src={croppedImage} alt="Captured" className="h-20 mx-auto border rounded shadow-sm" />
                        )}

                        {isVerifying ? (
                            <div className="py-8">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                                <p className="mt-2 text-sm text-muted-foreground">Menganalisis tanda tangan...</p>
                                <p className="text-xs text-muted-foreground mt-1">Mencocokkan dengan 42 responden</p>
                            </div>
                        ) : error ? (
                            <div className="py-4 text-red-500 bg-red-50 rounded-lg">
                                <Cancel01Icon className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        ) : result ? (
                            <div className={cn(
                                "p-6 rounded-xl border-2",
                                result.isMatch ? "border-green-100 bg-green-50" : "border-amber-100 bg-amber-50"
                            )}>
                                <div className="flex justify-center mb-3">
                                    {result.isMatch ? (
                                        <CheckmarkCircle01Icon className="w-12 h-12 text-green-600" />
                                    ) : (
                                        <Cancel01Icon className="w-12 h-12 text-amber-600" />
                                    )}
                                </div>

                                <h3 className="text-3xl font-bold text-slate-800">
                                    {result.similarity.toFixed(1)}%
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">Kemiripan</p>

                                <div className={cn(
                                    "flex items-center justify-center gap-2 py-3 px-4 rounded-lg",
                                    result.isMatch ? "bg-green-100" : "bg-amber-100"
                                )}>
                                    <UserIcon className="w-5 h-5 text-slate-600" />
                                    <span className="font-semibold text-slate-800">{result.matchedRespondent}</span>
                                </div>

                                <p className={cn(
                                    "mt-4 font-medium text-sm",
                                    result.isMatch ? "text-green-700" : "text-amber-700"
                                )}>
                                    {result.isMatch
                                        ? "✓ Tanda Tangan Terverifikasi (Asli)"
                                        : "⚠ Kemiripan Rendah - Perlu Verifikasi Manual"}
                                </p>
                            </div>
                        ) : null}

                        <Button className="w-full" onClick={reset}>Verifikasi Lagi</Button>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}

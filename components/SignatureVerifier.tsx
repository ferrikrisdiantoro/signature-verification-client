"use client";

import React, { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Camera01Icon, CheckmarkCircle01Icon, Cancel01Icon, UserIcon, RefreshIcon } from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { verifySignature, ANCHOR_FILES, dummyVerifySignature } from "@/lib/inference";

// Dynamic import for Webcam and Cropper to avoid SSR issues
// @ts-expect-error - dynamic import type mismatch with react-webcam
const Webcam = dynamic(() => import("react-webcam").then(mod => mod.default), { ssr: false });
const Cropper = dynamic(() => import("react-easy-crop").then(mod => mod.default), { ssr: false });

// Configuration: set to true to use real ONNX model, false for dummy
const USE_REAL_MODEL = true;

export default function SignatureVerifier() {
    const [step, setStep] = useState<"select" | "capture" | "crop" | "result">("select");
    const [selectedUser, setSelectedUser] = useState<string>("");

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
        distance: number;
        similarity: number;
        isMatch: boolean
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const webcamRef = useRef<any>(null);

    // Check if component is mounted (client-side only)
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleSelectUser = (value: string) => {
        setSelectedUser(value);
    };

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

    // Verification Logic for 1:1
    const handleVerify = async (capturedImg: string) => {
        setIsVerifying(true);
        setError(null);
        try {
            // Find filename for selected user
            const anchor = ANCHOR_FILES.find(a => a[0] === selectedUser);
            if (!anchor) throw new Error("Anchor not found");

            const anchorPath = `/anchors/${encodeURIComponent(anchor[1])}`; // Path to public folder

            let res;
            if (USE_REAL_MODEL) {
                // Use real ONNX model (1:1 Verification)
                res = await verifySignature(capturedImg, anchorPath);
            } else {
                // Use dummy verification
                const dummy = dummyVerifySignature();
                await new Promise(resolve => setTimeout(resolve, 1500));
                res = {
                    distance: 0,
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
        setStep("select");
        setSelectedUser("");
        setImageSrc(null);
        setCroppedImage(null);
        setResult(null);
        setError(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    // Loading state for SSR
    if (!isMounted) return null;

    return (
        <Card className="w-full max-w-md mx-auto shadow-lg border-slate-200">
            <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-bold text-slate-800">Verifikasi Tanda Tangan</CardTitle>
                <CardDescription>Sistem Kontrol Keaslian 1:1</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Step 1: Select Respondent */}
                {step === "select" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Pilih Nama Responden</label>
                            <select
                                className="w-full p-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:ring-2 focus:ring-slate-400 focus:outline-none"
                                value={selectedUser}
                                onChange={(e) => handleSelectUser(e.target.value)}
                            >
                                <option value="" disabled>Cari nama...</option>
                                {ANCHOR_FILES.map(([name], idx) => (
                                    <option key={idx} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedUser && (() => {
                            const anchor = ANCHOR_FILES.find(a => a[0] === selectedUser);
                            return anchor ? (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-slate-700">Contoh Tanda Tangan Asli:</p>
                                    <div className="border rounded-lg p-4 bg-slate-50 flex justify-center">
                                        <img
                                            src={`/anchors/${encodeURIComponent(anchor[1])}`}
                                            alt="Reference Signature"
                                            className="h-24 object-contain mix-blend-multiply opacity-80"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">Pastikan tanda tangan mirip dengan contoh di atas.</p>
                                </div>
                            ) : null;
                        })()}

                        <Button
                            className="w-full"
                            disabled={!selectedUser}
                            onClick={() => setStep("capture")}
                        >
                            Lanjut ke Kamera
                        </Button>
                    </div>
                )}

                {/* Step 2: Capture */}
                {step === "capture" && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center px-1">
                            <p className="text-sm font-semibold text-slate-700">User: {selectedUser}</p>
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setStep("select")}>Ganti</Button>
                        </div>

                        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden ring-1 ring-slate-200">
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
                                {/* Rectangular Guide (3:1 ratio as per client request) */}
                                <div className="w-[80%] aspect-[3/1] border-2 border-green-400 rounded-md box-content shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                                <p className="absolute bottom-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
                                    Posisikan tanda tangan di kotak hijau
                                </p>
                            </div>
                        </div>

                        <Button className="w-full" onClick={capture}>
                            <Camera01Icon className="mr-2 w-4 h-4" /> Ambil Foto
                        </Button>
                    </div>
                )}

                {/* Step 3: Crop */}
                {step === "crop" && imageSrc && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                            {/* @ts-ignore - dynamic import weirdness workaround */}
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={3} // Rectangular 3:1 ratio (3cm x 1cm as per client)
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                            Cubit/geser untuk sesuaikan area tanda tangan.
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

                {/* Step 4: Result */}
                {step === "result" && (
                    <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
                        {/* Comparison View */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Input</p>
                                {croppedImage && (
                                    <img src={croppedImage} alt="Input" className="h-20 w-full object-contain border rounded bg-white" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Referensi ({selectedUser})</p>
                                {selectedUser && (() => {
                                    const anchor = ANCHOR_FILES.find(a => a[0] === selectedUser);
                                    return anchor ? (
                                        <img
                                            src={`/anchors/${encodeURIComponent(anchor[1])}`}
                                            alt="Ref"
                                            className="h-20 w-full object-contain border rounded bg-slate-50 mix-blend-multiply"
                                        />
                                    ) : null;
                                })()}
                            </div>
                        </div>

                        {isVerifying ? (
                            <div className="py-8">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                                <p className="mt-2 text-sm text-muted-foreground">Menganalisis kemiripan...</p>
                            </div>
                        ) : error ? (
                            <div className="py-4 text-red-500 bg-red-50 rounded-lg">
                                <Cancel01Icon className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        ) : result ? (
                            <div className={cn(
                                "p-6 rounded-xl border-2 transition-all duration-500",
                                result.isMatch ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"
                            )}>
                                <div className="flex justify-center mb-3">
                                    {result.isMatch ? (
                                        <CheckmarkCircle01Icon className="w-12 h-12 text-green-600 animate-in bounce-in duration-700" />
                                    ) : (
                                        <Cancel01Icon className="w-12 h-12 text-red-600 animate-in shake duration-500" />
                                    )}
                                </div>

                                <h3 className="text-3xl font-bold text-slate-800">
                                    {result.similarity.toFixed(1)}%
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">Tingkat Kemiripan</p>

                                <p className={cn(
                                    "font-bold text-lg",
                                    result.isMatch ? "text-green-700" : "text-red-700"
                                )}>
                                    {result.isMatch
                                        ? "VERIFIED (Cocok)"
                                        : "REJECTED (Tidak Cocok)"}
                                </p>
                            </div>
                        ) : null}

                        <Button className="w-full" variant="outline" onClick={reset}>
                            <RefreshIcon className="mr-2 w-4 h-4" /> Verifikasi User Lain
                        </Button>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}

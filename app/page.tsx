import type { Metadata } from 'next';
import SignatureVerifier from '@/components/SignatureVerifier';

export const metadata: Metadata = {
  title: 'Signature AI Verifier',
  description: 'Prototyping Machine Learning Lite Application',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter text-slate-900">
            Sign<span className="text-blue-600">Guard</span> AI
          </h1>
          <p className="text-slate-500">Security & Authenticity Control System</p>
        </div>

        <SignatureVerifier />

        <p className="text-center text-xs text-slate-400 mt-8">
          Powered by GAN & Siamese Networks • ONNX Runtime Web
        </p>
      </div>
    </main>
  );
}

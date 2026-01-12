import * as ort from 'onnxruntime-web';

// Configuration
const MODEL_PATH = '/signature_feature_extractor.onnx';
const IMG_SIZE = 128;

// Helper to load image from URL
async function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}

// Preprocess image to Tensor (1, 128, 128, 1)
async function preprocess(imageSource: string | HTMLImageElement): Promise<ort.Tensor> {
    let img_element: HTMLImageElement;
    if (typeof imageSource === 'string') {
        img_element = await loadImage(imageSource);
    } else {
        img_element = imageSource;
    }

    const canvas = document.createElement('canvas');
    canvas.width = IMG_SIZE;
    canvas.height = IMG_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context failed");

    // Draw and Resize
    ctx.drawImage(img_element, 0, 0, IMG_SIZE, IMG_SIZE);

    // Get Data
    const imageData = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
    const { data } = imageData;
    const input = new Float32Array(IMG_SIZE * IMG_SIZE * 1); // 1 channel

    // Grayscale & Normalize
    for (let i = 0; i < data.length; i += 4) {
        // Simple RGB to Grayscale
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Luminosity method or simple average
        const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

        // Target index (Batch, Height, Width, Channel) -> Flattened
        // ONNX Runtime Web expects specific layout. 
        // If model input is (None, 128, 128, 1) (NHWC with TF2ONNX usually keeps NHWC or converts to NCHW depending on opset)
        // Keras default is NHWC. TF2ONNX default usually keeps it.
        // We fill the float array.
        input[i / 4] = gray;
    }

    return new ort.Tensor('float32', input, [1, IMG_SIZE, IMG_SIZE, 1]);
}

let session: ort.InferenceSession | null = null;

export async function loadModel() {
    if (!session) {
        try {
            // Needed to point to public folder for WASM if not finding it
            // ort.env.wasm.wasmPaths = "/"; 
            session = await ort.InferenceSession.create(MODEL_PATH, {
                executionProviders: ['wasm'],
            });
            console.log("Model loaded successfully");
        } catch (e) {
            console.error("Failed to load model", e);
            throw e;
        }
    }
    return session;
}

export async function verifySignature(capturedImageSrc: string, referenceImageSrc: string) {
    const sess = await loadModel();

    // Preprocess
    const tensorA = await preprocess(capturedImageSrc);
    const tensorB = await preprocess(referenceImageSrc);

    // Run Inference
    // Assuming input name is "input". Check model if fails.
    const inputName = sess.inputNames[0];

    const feedsA = { [inputName]: tensorA };
    const feedsB = { [inputName]: tensorB };

    const resultsA = await sess.run(feedsA);
    const resultsB = await sess.run(feedsB);

    // Get Embeddings
    const outputName = sess.outputNames[0];
    const embA = resultsA[outputName].data as Float32Array;
    const embB = resultsB[outputName].data as Float32Array;

    // Calculate Euclidean Distance
    let sum = 0;
    for (let i = 0; i < embA.length; i++) {
        sum += Math.pow(embA[i] - embB[i], 2);
    }
    const distance = Math.sqrt(sum);

    // Convert to Similarity Score (Probabilistic)
    // Sigmoid-ish or simple threshold mapping
    // If distance is 0 -> 100%. If distance > threshold, score drops.
    // Let's assume a margin of 1.0 from training.
    // Score = max(0, 1 - distance) ? Or exponential.
    const score = Math.max(0, 100 * (1 - distance)); // Simplistic

    return {
        distance: distance,
        score: score,
        isMatch: distance < 0.5 // Threshold
    };
}

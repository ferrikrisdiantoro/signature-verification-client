import * as ort from 'onnxruntime-web';

// Configuration
const MODEL_PATH = '/models/signature_feature_extractor.onnx';
const IMG_SIZE = 128;
const OPTIMAL_THRESHOLD = 0.425; // Optimized for 85.1% accuracy

// Anchor files mapping: [Display Name, Filename]
const ANCHOR_FILES: [string, string][] = [
    ['Annah', 'Annah 1_grayscale.jpg'],
    ['Aprisal', 'Aprisal 1_grayscale.jpg'],
    ['Ardimansyah', 'Ardimansyah 1_grayscale.jpg'],
    ['Arwansyah', 'Arwansyah 1_grayscale.jpg'],
    ['Baharruddin', 'Baharruddin 1_grayscale.jpg'],
    ['Fatmawati', 'Fatmawati 1_grayscale.jpg'],
    ['Fitriani', 'Fitriani 1_grayscale.jpg'],
    ['Hardi', 'Hardi 1_grayscale.jpg'],
    ['Herenal', 'Herenal 1_grayscale.jpg'],
    ['Husain', 'Husain 1_grayscale.jpg'],
    ['Imran', 'Imran 1_grayscale.jpg'],
    ['Irmawati', 'Irmawati 1_grayscale.jpg'],
    ['Irsal', 'Irsal 1_grayscale.jpg'],
    ['Joseph', 'Joseph 1_grayscale.jpg'],
    ['M Syukri', 'M Syukri 1_grayscale.jpg'],
    ['Nur Salman', 'Nur Salman 1_grayscale.jpg'],
    ['Nurdiana', 'Nurdiana 1_grayscale.jpg'],
    ['Nurdiansah', 'Nurdiansah 1_grayscale.jpg'],
    ['Nurdiansyah', 'Nurdiansyah 1_grayscale.jpg'],
    ['Nurul Aini', 'Nurul Aini 1_grayscale.jpg'],
    ['Rahmat', 'Rahmat 1_grayscale.jpg'],
    ['Santi', 'Santi 1_grayscale.jpg'],
    ['Siti Aminah', 'Siti Aminah 1_grayscale.jpg'],
    ['Sri Wahyuni', 'Sri Wahyuni 1_grayscale.jpg'],
    ['Suryani', 'Suryani 1_grayscale.jpg'],
    ['Abdul Ibrahim', 'abdulibrahim1_grayscale.jpg'],
    ['Ahyuna', 'ahyuna1_grayscale.jpg'],
    ['Akram', 'akram1_grayscale.jpg'],
    ['Andrew', 'andrew1_grayscale.jpg'],
    ['Arham', 'arham1_grayscale.jpg'],
    ['Asmah', 'asmah1_grayscale.jpg'],
    ['Cucut', 'cucut1_grayscale.jpg'],
    ['Irma', 'irma1_grayscale.jpg'],
    ['Juan', 'juan1_grayscale.jpg'],
    ['Khairunnisa', 'khairunnisa1_grayscale.jpg'],
    ['Nuel', 'nuel1_grayscale.jpg'],
    ['Nurlinda Sari', 'nurlindasari1_grayscale.jpg'],
    ['Rian', 'rian1_grayscale.jpg'],
    ['Siti Aisa', 'sitiaisa1_grayscale.jpg'],
    ['Sri Wahyuningsih', 'sriwahyuningsih1_grayscale.jpg'],
    ['Suci Arifin', 'suciarifin1_grayscale.jpg'],
    ['Usman', 'usman1_grayscale.jpg'],
];

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
    const input = new Float32Array(IMG_SIZE * IMG_SIZE * 1);

    // Grayscale & Normalize
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Luminosity method
        const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
        input[i / 4] = gray;
    }

    return new ort.Tensor('float32', input, [1, IMG_SIZE, IMG_SIZE, 1]);
}

let session: ort.InferenceSession | null = null;

export async function loadModel() {
    if (!session) {
        try {
            session = await ort.InferenceSession.create(MODEL_PATH, {
                executionProviders: ['wasm'],
            });
            console.log("ONNX Model loaded successfully");
        } catch (e) {
            console.error("Failed to load model", e);
            throw e;
        }
    }
    return session;
}

// Get embedding for an image
async function getEmbedding(imageSrc: string): Promise<Float32Array> {
    const sess = await loadModel();
    const tensor = await preprocess(imageSrc);
    const inputName = sess.inputNames[0];
    const feeds = { [inputName]: tensor };
    const results = await sess.run(feeds);
    const outputName = sess.outputNames[0];
    return results[outputName].data as Float32Array;
}

// Calculate Euclidean distance between two embeddings
function euclideanDistance(embA: Float32Array, embB: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < embA.length; i++) {
        sum += Math.pow(embA[i] - embB[i], 2);
    }
    return Math.sqrt(sum);
}

// Convert distance to similarity percentage
function distanceToSimilarity(distance: number): number {
    // With L2 normalized embeddings, max distance is 2 (opposite vectors)
    // Threshold 0.557 corresponds to ~72% similarity
    const maxDistance = 2.0;
    const similarity = Math.max(0, (1 - distance / maxDistance) * 100);
    return Math.round(similarity * 10) / 10; // Round to 1 decimal
}

// Verify signature against a reference image
export async function verifySignature(capturedImageSrc: string, referenceImageSrc: string) {
    const embA = await getEmbedding(capturedImageSrc);
    const embB = await getEmbedding(referenceImageSrc);

    const distance = euclideanDistance(embA, embB);
    const similarity = distanceToSimilarity(distance);
    const isMatch = distance < OPTIMAL_THRESHOLD;

    return {
        distance,
        similarity,
        isMatch
    };
}

// Find best matching respondent from all anchors
export async function findBestMatch(capturedImageSrc: string): Promise<{
    respondent: string;
    similarity: number;
    distance: number;
    isMatch: boolean;
}> {
    const capturedEmb = await getEmbedding(capturedImageSrc);

    let bestMatch = {
        respondent: 'Unknown',
        similarity: 0,
        distance: Infinity,
        isMatch: false
    };

    // Compare against all respondent anchors
    for (const [displayName, filename] of ANCHOR_FILES) {
        try {
            // URL encode the filename to handle spaces
            const anchorPath = `/anchors/${encodeURIComponent(filename)}`;
            const anchorEmb = await getEmbedding(anchorPath);
            const distance = euclideanDistance(capturedEmb, anchorEmb);
            const similarity = distanceToSimilarity(distance);

            if (distance < bestMatch.distance) {
                bestMatch = {
                    respondent: displayName,
                    similarity,
                    distance,
                    isMatch: distance < OPTIMAL_THRESHOLD
                };
            }
        } catch (e) {
            // Skip if anchor image not found
            console.warn(`Anchor not found for ${displayName}: ${filename}`);
        }
    }

    return bestMatch;
}

// Dummy verification for testing without model
export function dummyVerifySignature(): {
    respondent: string;
    similarity: number;
    isMatch: boolean;
} {
    // Return random respondent with simulated similarity
    const randomIndex = Math.floor(Math.random() * ANCHOR_FILES.length);
    const similarity = 70 + Math.random() * 25; // 70-95%

    return {
        respondent: ANCHOR_FILES[randomIndex][0],
        similarity: Math.round(similarity * 10) / 10,
        isMatch: similarity > 75
    };
}

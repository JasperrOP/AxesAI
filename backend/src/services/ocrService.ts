import { createWorker } from 'tesseract.js';
import * as PDFJS from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import Groq from 'groq-sdk';

// HEIC/HEIF mime types that need conversion before OCR
const HEIC_MIMES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Candidate Groq multimodal (vision) models, tried in order until one succeeds.
// GROQ_VISION_MODEL (if set) is tried first. Groq occasionally renames these, so
// we probe several rather than hard-coding a single id that may 404.
const VISION_MODEL_CANDIDATES = [
  process.env.GROQ_VISION_MODEL,
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
].filter(Boolean) as string[];

const OCR_PROMPT =
  'You are an OCR engine for scanned exam answer sheets, including messy handwriting. ' +
  'Transcribe ALL text in the image exactly as written, preserving line breaks and math where possible. ' +
  'Do not summarise, explain, correct spelling, or add anything not present. ' +
  'Then rate how legible/clear the scan was from 0 (unreadable) to 100 (perfectly clear). ' +
  'Respond with ONLY a JSON object: {"text": "<transcription>", "confidence": <0-100 integer>}';

/**
 * Transcribe an image (incl. handwriting) using a Groq vision model.
 * Tries each candidate model until one works; throws with the collected errors
 * (so the caller can surface WHY vision failed instead of silently degrading).
 */
export const performVisionOCR = async (
  fileBuffer: Buffer
): Promise<{ text: string; confidence: number; model: string }> => {
  // Normalise: auto-orient, cap size, convert to JPEG so any input format works.
  const normalized = await sharp(fileBuffer)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: 92 })
    .toBuffer();

  const base64 = normalized.toString('base64');
  const errors: string[] = [];

  for (const model of VISION_MODEL_CANDIDATES) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: OCR_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ] as any,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content || '{}';
      let parsed: { text?: string; confidence?: number };
      try {
        parsed = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { text: raw };
      }

      const text = (parsed.text || '').trim();
      if (text.length > 0) {
        console.log(`✅ Groq vision OCR succeeded with model: ${model}`);
        return { text, confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 80, model };
      }
      errors.push(`${model}: returned empty text`);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || String(err);
      console.warn(`Groq vision model "${model}" failed: ${msg}`);
      errors.push(`${model}: ${msg}`);
    }
  }

  throw new Error(`All Groq vision models failed → ${errors.join(' | ')}`);
};

export interface OCRResult { text: string; confidence: number; engine: 'pdf-text' | 'groq-vision' | 'tesseract'; visionError?: string; }

export const performOCR = async (fileBuffer: Buffer, mimeType: string): Promise<OCRResult> => {
  let visionError: string | undefined;

  // Digital PDFs: extract the embedded text layer directly (fast + accurate).
  if (mimeType === 'application/pdf') {
    try {
      const data = new Uint8Array(fileBuffer);
      const pdf = PDFJS.getDocument({ data });
      const doc = await pdf.promise;
      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
        text += pageText + '\n';
      }
      if (text.trim().length > 10) {
        return { text: text.trim(), confidence: 95, engine: 'pdf-text' };
      }
    } catch (err) {
      console.warn('PDF raw text extraction failed, falling back to OCR if possible:', err);
    }
    // Scanned/image-only PDF with no text layer — Groq vision can't read PDF bytes directly,
    // so fall through to Tesseract below (limited, but better than nothing).
  } else if (mimeType.startsWith('image/')) {
    // Images (incl. photos of handwritten answers): prefer Groq vision.
    if (process.env.GROQ_API_KEY) {
      try {
        console.log('🖼️  Running Groq vision OCR...');
        const result = await performVisionOCR(fileBuffer);
        if (result.text.trim().length > 0) {
          return { text: result.text, confidence: result.confidence, engine: 'groq-vision' };
        }
        visionError = 'Groq vision returned no text';
      } catch (err: any) {
        visionError = err?.message || String(err);
        console.warn('Groq vision OCR failed, falling back to Tesseract:', visionError);
      }
    } else {
      visionError = 'GROQ_API_KEY not set';
    }
  }

  // Fallback: Tesseract. Convert HEIC/HEIF to JPEG so Tesseract can process it.
  let ocrBuffer = fileBuffer;
  if (HEIC_MIMES.includes(mimeType.toLowerCase())) {
    console.log('🔄 Converting HEIC/HEIF to JPEG for OCR...');
    ocrBuffer = await sharp(fileBuffer).jpeg({ quality: 90 }).toBuffer();
  }

  const worker = await createWorker('eng');
  try {
    const ret = await worker.recognize(ocrBuffer);
    const text = ret.data.text || '';
    const confidence = ret.data.confidence || 0;
    return { text, confidence, engine: 'tesseract', visionError };
  } finally {
    await worker.terminate();
  }
};

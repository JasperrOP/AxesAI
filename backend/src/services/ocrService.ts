import { createWorker } from 'tesseract.js';
import * as PDFJS from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import Groq from 'groq-sdk';

// HEIC/HEIF mime types that need conversion before OCR
const HEIC_MIMES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

// Groq multimodal (vision) model — reads handwriting far better than Tesseract.
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Transcribe an image (incl. handwriting) using a Groq vision model.
 * Returns extracted text plus a self-reported legibility confidence (0-100)
 * the teacher can use to flag low-quality scans for manual review.
 */
export const performVisionOCR = async (fileBuffer: Buffer): Promise<{ text: string; confidence: number }> => {
  // Normalise: auto-orient, cap size, convert to JPEG so any input format works.
  const normalized = await sharp(fileBuffer)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: 92 })
    .toBuffer();

  const base64 = normalized.toString('base64');

  const completion = await groq.chat.completions.create({
    model: VISION_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'You are an OCR engine for scanned exam answer sheets, including messy handwriting. ' +
              'Transcribe ALL text in the image exactly as written, preserving line breaks and math where possible. ' +
              'Do not summarise, explain, correct spelling, or add anything not present. ' +
              'Then rate how legible/clear the scan was from 0 (unreadable) to 100 (perfectly clear). ' +
              'Respond with ONLY a JSON object: {"text": "<transcription>", "confidence": <0-100 integer>}',
          },
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

  return {
    text: (parsed.text || '').trim(),
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 80,
  };
};

export const performOCR = async (fileBuffer: Buffer, mimeType: string): Promise<{ text: string; confidence: number }> => {
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
        return { text: text.trim(), confidence: 95 };
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
        console.log(`🖼️  Running Groq vision OCR (${VISION_MODEL})...`);
        const result = await performVisionOCR(fileBuffer);
        if (result.text.trim().length > 0) {
          return result;
        }
        console.warn('Groq vision OCR returned no text, falling back to Tesseract.');
      } catch (err: any) {
        console.warn('Groq vision OCR failed, falling back to Tesseract:', err?.message || err);
      }
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
    return { text, confidence };
  } finally {
    await worker.terminate();
  }
};

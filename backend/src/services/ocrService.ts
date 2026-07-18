import { createWorker } from 'tesseract.js';
import * as PDFJS from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';

// HEIC/HEIF mime types that need conversion before OCR
const HEIC_MIMES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

export const performOCR = async (fileBuffer: Buffer, mimeType: string): Promise<{ text: string; confidence: number }> => {
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
  }

  // Convert HEIC/HEIF to JPEG so Tesseract can process it
  let ocrBuffer = fileBuffer;
  if (HEIC_MIMES.includes(mimeType.toLowerCase())) {
    console.log('🔄 Converting HEIC/HEIF to JPEG for OCR...');
    ocrBuffer = await sharp(fileBuffer).jpeg({ quality: 90 }).toBuffer();
  }

  // Perform Tesseract OCR for images (or fallback)
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

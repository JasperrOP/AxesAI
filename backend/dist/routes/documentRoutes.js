import express from 'express';
import multer from 'multer';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import * as PDFJS from 'pdfjs-dist/legacy/build/pdf.mjs';
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }
        const data = new Uint8Array(req.file.buffer);
        const pdf = PDFJS.getDocument({ data });
        const doc = await pdf.promise;
        let rawText = '';
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str || '').join(' ');
            rawText += pageText + '\n';
        }
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunks = await splitter.createDocuments([rawText]);
        console.log(`📄 Successfully parsed PDF into ${chunks.length} chunks!`);
        // Return ALL chunk text joined together so the frontend sends full context to the AI
        const fullText = chunks.map(c => c.pageContent).join('\n\n');
        res.status(200).json({
            message: 'File successfully processed',
            totalChunks: chunks.length,
            fullText,
            sampleChunk: chunks[0]?.pageContent || ''
        });
    }
    catch (error) {
        console.error('Error processing document:', error);
        res.status(500).json({ error: 'Failed to process the document' });
    }
});
export default router;

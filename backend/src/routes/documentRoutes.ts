import express from 'express';
import multer from 'multer';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
// Use the legacy build for Node.js environments
import * as PDFJS from 'pdfjs-dist/legacy/build/pdf.mjs';

const router = express.Router();

// Configure Multer to keep the file in memory (no need to save to disk yet)
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req, res): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        // 1. Parse PDF using pdfjs-dist legacy build
        const pdf = PDFJS.getDocument({ data: req.file.buffer });
        const doc = await pdf.promise;
        
        let rawText = '';
        
        // 2. Extract text from all pages
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
            rawText += pageText + '\n';
        }

        
        // 3. Initialize LangChain's Text Splitter
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200, 
        });

        // 4. Split the text into an array of smaller documents
        const chunks = await splitter.createDocuments([rawText]);

        console.log(`📄 Successfully parsed PDF into ${chunks.length} chunks!`);

        res.status(200).json({
            message: 'File successfully processed',
            totalChunks: chunks.length,
            sampleChunk: chunks[0].pageContent
        });

    } catch (error) {
        console.error('Error processing document:', error);
        res.status(500).json({ error: 'Failed to process the document' });
    }
});

export default router;
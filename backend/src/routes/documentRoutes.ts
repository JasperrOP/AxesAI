import express, { Request, Response } from 'express';
import multer from 'multer';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import * as PDFJS from 'pdfjs-dist/legacy/build/pdf.mjs';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
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
            const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
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

    } catch (error) {
        console.error('Error processing document:', error);
        res.status(500).json({ error: 'Failed to process the document' });
    }
});

import { performOCR } from '../services/ocrService.js';
import { gradeHandwrittenAnswer } from '../services/aiService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

router.post('/grade-handwritten', authenticateToken as any, upload.single('file'), async (req: any, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No image or PDF file provided' });
            return;
        }

        const { question, rubric } = req.body;
        if (!question || !rubric) {
            res.status(400).json({ error: 'Question and rubric are required' });
            return;
        }

        console.log(`🔍 Running OCR on file: ${req.file.originalname} (${req.file.mimetype})...`);
        const ocrResult = await performOCR(req.file.buffer, req.file.mimetype);

        console.log(`🤖 Grading extracted text with AI...`);
        const gradeResult = await gradeHandwrittenAnswer({
            question,
            studentAnswerText: ocrResult.text,
            rubric
        });

        res.status(200).json({
            message: 'Grading complete',
            extractedText: ocrResult.text,
            confidence: ocrResult.confidence,
            engine: ocrResult.engine,
            visionError: ocrResult.visionError,
            criteriaScores: gradeResult.criteriaScores,
            totalScore: gradeResult.totalScore,
            feedback: gradeResult.feedback
        });
    } catch (error: any) {
        console.error('Error in grading handwritten answer:', error);
        res.status(500).json({ error: error.message || 'Failed to grade handwritten answer' });
    }
});

import ClassroomDocument from '../models/ClassroomDocument.js';
import { generatePageIndex, queryPageIndex } from '../services/aiService.js';

router.post('/upload-classroom-doc', authenticateToken as any, upload.single('file'), async (req: any, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file provided' });
            return;
        }

        const { classroomId } = req.body;
        if (!classroomId) {
            res.status(400).json({ error: 'classroomID is required' });
            return;
        }

        console.log(`📄 Parsing text from ${req.file.originalname} for classroom ${classroomId}...`);
        
        // Use OCR performOCR directly to be generic (handles PDF text extraction or image OCR)
        const ocrResult = await performOCR(req.file.buffer, req.file.mimetype);
        const fullText = ocrResult.text;

        if (!fullText.trim()) {
            res.status(400).json({ error: 'Could not extract text from document.' });
            return;
        }

        console.log(`🧠 Generating hierarchical pageIndex tree...`);
        const pageIndex = await generatePageIndex(fullText);

        // Delete any existing document for this classroom to overwrite
        await ClassroomDocument.deleteMany({ classroomId });

        const doc = await ClassroomDocument.create({
            classroomId,
            title: req.file.originalname,
            fullText,
            pageIndex
        });

        res.status(201).json({
            message: 'Classroom document indexed successfully',
            documentId: doc._id,
            title: doc.title,
            pageIndex
        });
    } catch (error: any) {
        console.error('Failed to upload and index document:', error);
        res.status(500).json({ error: error.message || 'Failed to process document' });
    }
});

router.post('/query-classroom-doc', authenticateToken as any, async (req: any, res: Response): Promise<void> => {
    try {
        const { classroomId, query } = req.body;
        if (!classroomId || !query) {
            res.status(400).json({ error: 'classroomId and query are required' });
            return;
        }

        const doc = await ClassroomDocument.findOne({ classroomId });
        if (!doc) {
            res.status(404).json({ error: 'No indexed document found for this classroom. Ask teacher to upload study notes.' });
            return;
        }

        console.log(`🔍 Routing doubt query via PageIndex RAG...`);
        const ragResult = await queryPageIndex(doc.pageIndex, doc.fullText, query);

        res.status(200).json(ragResult);
    } catch (error: any) {
        console.error('Error answering doubt:', error);
        res.status(500).json({ error: error.message || 'Failed to answer doubt' });
    }
});

router.get('/classroom-doc/:classroomId', authenticateToken as any, async (req: any, res: Response): Promise<void> => {
    try {
        const { classroomId } = req.params;
        const doc = await ClassroomDocument.findOne({ classroomId }).select('title pageIndex createdAt');
        res.status(200).json({ doc });
    } catch (error: any) {
        console.error('Error fetching classroom doc:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch classroom document' });
    }
});

export default router;
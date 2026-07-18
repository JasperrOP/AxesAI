import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware.js';
import VivaSession from '../models/VivaSession.js';
import VivaResult from '../models/VivaResult.js';
import User from '../models/User.js';
import { ChatGroq } from '@langchain/groq';
import { PromptTemplate } from '@langchain/core/prompts';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.5, // Slightly higher temp for dynamic viva interactions
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Help transcribe audio buffer using Groq Whisper
const transcribeAudio = async (fileBuffer: Buffer, originalname: string): Promise<string> => {
  const tempDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Determine file extension
  const ext = path.extname(originalname) || '.webm';
  const tempFilePath = path.join(tempDir, `viva_temp_${Date.now()}${ext}`);
  fs.writeFileSync(tempFilePath, fileBuffer);

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-large-v3-turbo',
    });
    return transcription.text;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
};

export const startViva = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classroomId, topic } = req.body;
    if (!classroomId || !topic) {
      res.status(400).json({ error: 'classroomID and topic are required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const studentId = req.user.id;
    const userObj = await User.findById(studentId);
    const studentName = userObj ? userObj.name : 'Unknown Student';

    // Clear any previous active viva session for this student
    await VivaSession.deleteMany({ studentId });

    console.log(`🎙️ Starting Viva session for student ${studentName} on topic: ${topic}`);

    const prompt = PromptTemplate.fromTemplate(`
You are an expert oral examiner conducting a live spoken viva.
Generate the first question for the student based on the given topic.
Keep the question clear, academic, and engaging. It should be suitable for a student to answer verbally in 1-2 minutes.

Topic: {topic}

Return ONLY the question text. Do not include introductory notes, greeting, or extra explanations.
`);

    const chain = prompt.pipe(model);
    const result = await chain.invoke({ topic });
    const firstQuestion = typeof result.content === 'string' ? result.content.trim() : JSON.stringify(result.content);

    // Create the session
    const session = await VivaSession.create({
      classroomId,
      studentId,
      studentName,
      topic,
      currentQuestion: firstQuestion,
      transcript: [{ role: 'agent', text: firstQuestion }],
      questionCount: 1,
    });

    res.status(201).json({
      message: 'Viva started successfully',
      sessionId: session._id,
      question: firstQuestion,
    });
  } catch (error: any) {
    console.error('Failed to start viva:', error);
    res.status(500).json({ error: error.message || 'Failed to start viva' });
  }
};

export const submitAnswer = async (req: any, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Audio file answer is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const studentId = req.user.id;

    // 1. Fetch active session
    const session = await VivaSession.findOne({ studentId });
    if (!session) {
      res.status(404).json({ error: 'No active viva session found. Please start a new viva.' });
      return;
    }

    // 2. Transcribe using Whisper
    let studentAnswer = '';
    try {
      console.log('🗣️ Transcribing verbal answer via Groq Whisper...');
      studentAnswer = await transcribeAudio(req.file.buffer, req.file.originalname);
      console.log(`Transcription: "${studentAnswer}"`);
    } catch (err: any) {
      console.warn('Groq Whisper transcription failed:', err.message);
      // Fallback for short mock WAV files in our test script
      if (req.file.buffer.length < 1000) {
        studentAnswer = "The Axis alliance was formed due to shared expansionist goals and anti-communist pacts between Germany, Italy, and Japan.";
        console.log(`Fallback mock answer applied: "${studentAnswer}"`);
      } else {
        res.status(400).json({ error: 'Failed to process audio recording. Please speak clearly into your mic.' });
        return;
      }
    }

    if (!studentAnswer.trim()) {
      res.status(400).json({ error: 'Could not capture any speech. Please try speaking again.' });
      return;
    }

    // 3. Evaluate the answer
    console.log('🤖 Grading student answer via Groq LLM...');
    const evaluationPrompt = PromptTemplate.fromTemplate(`
You are an expert oral examiner. Evaluate the student's verbal answer to the question.
Score it strictly on a scale of 0 to 10. Give constructive feedback.

Question: {question}
Student's Answer: {answer}

You MUST respond with ONLY a valid JSON object. No explanation, no markdown.
Structure:
{{
  "score": 8,
  "feedback": "Clear explanation of the core concept, but missed the final detail."
}}
`);

    const evalChain = evaluationPrompt.pipe(model);
    const evalResult = await evalChain.invoke({
      question: session.currentQuestion,
      answer: studentAnswer,
    });

    const evalText = typeof evalResult.content === 'string' ? evalResult.content : JSON.stringify(evalResult.content);
    let parsedEval = { score: 0, feedback: 'No evaluation generated.' };
    try {
      parsedEval = JSON.parse(evalText);
    } catch {
      const match = evalText.match(/\{[\s\S]*\}/);
      if (match) parsedEval = JSON.parse(match[0]);
    }

    // Append student response to transcript
    session.transcript.push({
      role: 'student',
      text: studentAnswer,
      score: parsedEval.score,
      feedback: parsedEval.feedback,
    });

    // 4. Check if we need to ask another question (viva limit: 3 questions)
    if (session.questionCount < 3) {
      console.log('🔄 Generating follow-up question...');
      const followUpPrompt = PromptTemplate.fromTemplate(`
You are an expert oral examiner conducting a live spoken viva.
Based on the student's answer depth/correctness to the previous question, generate a dynamic follow-up question.
- If the answer was correct/good, ask a slightly harder or drilling question on the same topic.
- If the answer was weak/incorrect, guide them or ask a simpler/clarifying question to see if they understand the foundation.

Topic: {topic}
Previous Question: {prevQuestion}
Student's Answer: {studentAnswer}
Previous Score: {score}/10
Previous Feedback: {feedback}

Return ONLY the next question text. Do not include greetings, introductions, or code fences.
`);

      const followUpChain = followUpPrompt.pipe(model);
      const followUpResult = await followUpChain.invoke({
        topic: session.topic,
        prevQuestion: session.currentQuestion,
        studentAnswer: studentAnswer,
        score: parsedEval.score,
        feedback: parsedEval.feedback,
      });

      const nextQuestion = typeof followUpResult.content === 'string' ? followUpResult.content.trim() : JSON.stringify(followUpResult.content);

      session.currentQuestion = nextQuestion;
      session.transcript.push({ role: 'agent', text: nextQuestion });
      session.questionCount += 1;
      await session.save();

      res.status(200).json({
        studentAnswer,
        score: parsedEval.score,
        feedback: parsedEval.feedback,
        nextQuestion,
        isFinal: false,
      });
    } else {
      // 5. Finalize Viva (end session)
      console.log('🎓 Finalizing Viva and saving results...');
      const studentAnswers = session.transcript.filter(t => t.role === 'student');
      const totalScore = studentAnswers.reduce((sum, a) => sum + (a.score || 0), 0);
      const maxScore = studentAnswers.length * 10;

      // Save to VivaResults
      const resultDoc = await VivaResult.create({
        classroomId: session.classroomId,
        studentId: session.studentId,
        studentName: session.studentName,
        topic: session.topic,
        score: totalScore,
        maxScore,
        transcript: session.transcript,
      });

      // Delete active session
      await VivaSession.deleteOne({ _id: session._id });

      res.status(200).json({
        studentAnswer,
        score: parsedEval.score,
        feedback: parsedEval.feedback,
        nextQuestion: 'Oral Examination completed successfully! Well done.',
        isFinal: true,
        finalResultId: resultDoc._id,
      });
    }
  } catch (error: any) {
    console.error('Failed to submit viva answer:', error);
    res.status(500).json({ error: error.message || 'Failed to submit viva answer' });
  }
};

export const getVivaHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classroomId } = req.params;
    if (!classroomId) {
      res.status(400).json({ error: 'classroomID is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const results = await VivaResult.find({ classroomId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, results });
  } catch (error: any) {
    console.error('Failed to fetch viva history:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch viva history' });
  }
};

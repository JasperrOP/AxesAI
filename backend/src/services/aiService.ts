import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import dotenv from 'dotenv';

dotenv.config();

const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
});

interface QuestionTypeConfig {
    type: string;
    count: number;
    marks: number;
}

export const generateQuestionPaper = async (params: any) => {
    const topic = params.additionalInstructions || "General Academic Assessment";
    const questionTypes: QuestionTypeConfig[] = params.questionTypes || [];
    const contextText = params.contextText || "Generate standard academic questions based on general knowledge.";

    // Build a human-readable requirement string from the structured config
    const requirementLines = questionTypes.map(qt => {
        const typeLabel = qt.type === 'mcq' ? 'Multiple Choice Questions (4 options each)' :
                          qt.type === 'short' ? 'Short Answer Questions' :
                          qt.type === 'essay' ? 'Essay/Long Answer Questions' :
                          qt.type === 'numerical' ? 'Numerical Problems' :
                          qt.type === 'diagram' ? 'Diagram/Graph-Based Questions' :
                          `${qt.type} Questions`;
        return `- ${qt.count} ${typeLabel}, each worth ${qt.marks} mark(s)`;
    }).join('\n');

    const totalQuestions = questionTypes.reduce((sum, qt) => sum + qt.count, 0);
    const totalMarks = questionTypes.reduce((sum, qt) => sum + (qt.count * qt.marks), 0);

    try {
        const prompt = PromptTemplate.fromTemplate(`
You are an expert academic assessment creator. Generate a professional question paper.

Topic/Instructions: {topic}

Requirements:
{requirementLines}

Total Questions: {totalQuestions}
Total Marks: {totalMarks}

Use the following extracted notes/context to ground your questions. Do NOT hallucinate or use facts outside this context:
---
{contextText}
---

You MUST respond with ONLY a valid JSON array. No markdown, no explanation, no code fences.
Each element in the array represents one section of the paper and must have this exact structure:
[
  {{
    "title": "Section A: Multiple Choice Questions",
    "instruction": "Choose the correct option for each question.",
    "questions": [
      {{
        "type": "mcq",
        "prompt": "What is the capital of France?",
        "options": ["London", "Berlin", "Paris", "Madrid"],
        "answerKey": "Paris",
        "difficulty": "Easy",
        "marks": 1
      }}
    ]
  }}
]

Rules:
- Group questions by type into sections. Each section gets a title like "Section A: Multiple Choice Questions"
- For MCQ questions, ALWAYS include exactly 4 options in the "options" array
- For short/essay/numerical/diagram questions, set "options" to an empty array []
- Every question MUST have: type, prompt, options, answerKey, difficulty, marks
- difficulty must be one of: "Easy", "Moderate", "Hard"
- Respond with ONLY the JSON array, nothing else
`);

        console.log("🧠 Sending prompt to Groq (Llama 3)...");

        const chain = prompt.pipe(model);

        const result = await chain.invoke({
            topic,
            requirementLines: requirementLines || "- 5 Multiple Choice Questions, each worth 1 mark\n- 3 Short Answer Questions, each worth 2 marks",
            totalQuestions: totalQuestions.toString(),
            totalMarks: totalMarks.toString(),
            contextText: contextText.substring(0, 15000)
        });

        // Parse the response - extract JSON from the LLM output
        const responseText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        
        // Try to extract JSON array from the response
        let parsed;
        try {
            // Try direct parse first
            parsed = JSON.parse(responseText);
        } catch {
            // Try to find JSON array in the response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not extract valid JSON from LLM response');
            }
        }

        // Ensure we have an array
        const sections = Array.isArray(parsed) ? parsed : [parsed];

        // Normalize field names to match DB schema
        const normalizedSections = sections.map((section: any) => ({
            title: section.title || section.sectionTitle || 'Untitled Section',
            instruction: section.instruction || section.instructions || 'Answer all questions.',
            questions: (section.questions || []).map((q: any) => ({
                type: q.type || 'mcq',
                prompt: q.prompt || q.text || '',
                options: q.options || [],
                answerKey: q.answerKey || q.answer || '',
                difficulty: q.difficulty || 'Moderate',
                marks: q.marks || 1,
            }))
        }));

        console.log(`✅ Successfully generated ${normalizedSections.length} sections with ${normalizedSections.reduce((s: number, sec: any) => s + sec.questions.length, 0)} total questions`);

        return normalizedSections;
    } catch (error) {
        console.error("❌ Error generating assessment via Groq:", error);
        throw new Error("Failed to generate assessment via AI");
    }
};

export const gradeHandwrittenAnswer = async (params: { question: string; studentAnswerText: string; rubric: string }) => {
    const { question, studentAnswerText, rubric } = params;

    try {
        const prompt = PromptTemplate.fromTemplate(`
You are an expert examiner. Grade the student's answer based on the question and the rubric.
Evaluate strictly and provide clear constructive feedback.

Question:
{question}

Student's Answer:
{studentAnswerText}

Rubric / Criteria:
{rubric}

You MUST respond with ONLY a valid JSON object. No markdown, no explanation, no code fences.
The JSON object must have this exact structure:
{{
  "criteriaScores": {{
    "Understanding": 4,
    "Accuracy": 3
  }},
  "totalScore": 7,
  "feedback": "The student demonstrated a good understanding but missed a key detail..."
}}
`);

        const chain = prompt.pipe(model);
        const result = await chain.invoke({
            question,
            studentAnswerText,
            rubric
        });

        const responseText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not extract valid JSON from LLM response');
            }
        }

        return {
            criteriaScores: parsed.criteriaScores || {},
            totalScore: parsed.totalScore || 0,
            feedback: parsed.feedback || "No feedback generated."
        };
    } catch (error) {
        console.error("❌ Error grading handwritten answer via Groq:", error);
        throw new Error("Failed to grade answer via AI");
    }
};

export const generatePageIndex = async (fullText: string) => {
    try {
        const prompt = PromptTemplate.fromTemplate(`
You are a document structure parser. Analyze this academic document and generate a hierarchical Table of Contents (PageIndex).
For each section/sub-section, provide a descriptive summary and key keywords that exist in that section.
Keep the hierarchy clean and concise.

Document content:
{documentContent}

You MUST respond with ONLY a valid JSON object. No markdown, no explanation, no code fences.
Format the output as a nested array of sections:
{{
  "sections": [
    {{
      "title": "Chapter 1: Introduction to Mechanics",
      "summary": "Covers Newton's laws of motion, velocity, and basic definitions.",
      "keywords": ["newton", "velocity", "acceleration", "force"],
      "subsections": [
        {{
          "title": "1.1 Newton's First Law",
          "summary": "Describes inertia and state of rest or uniform motion.",
          "keywords": ["inertia", "first law", "rest"]
        }}
      ]
    }}
  ]
}}
`);

        const chain = prompt.pipe(model);
        const result = await chain.invoke({
            documentContent: fullText.substring(0, 15000) // Safeguard LLM context limits
        });

        const responseText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not extract valid JSON from LLM response');
            }
        }
        return parsed;
    } catch (error) {
        console.error("❌ Error generating PageIndex:", error);
        throw new Error("Failed to parse PageIndex via AI");
    }
};

export const queryPageIndex = async (pageIndex: any, fullText: string, query: string) => {
    try {
        // Step 1: Let LLM look at the hierarchy and select the most relevant sections
        const selectPrompt = PromptTemplate.fromTemplate(`
You are an intelligent router. Given a user query and a document's hierarchical page index structure, determine which section(s) contain the information needed to answer the query.

User Query:
{query}

Document Page Index Structure:
{pageIndexJson}

You MUST respond with ONLY a valid JSON array of selected section/subsection titles. No explanation, no code fences.
Example output:
["1.1 Newton's First Law", "Chapter 1: Introduction to Mechanics"]
`);

        const routerChain = selectPrompt.pipe(model);
        const routerResult = await routerChain.invoke({
            query,
            pageIndexJson: JSON.stringify(pageIndex)
        });

        const routerText = typeof routerResult.content === 'string' ? routerResult.content : JSON.stringify(routerResult.content);
        let selectedSections: string[] = [];
        try {
            selectedSections = JSON.parse(routerText);
        } catch {
            const jsonMatch = routerText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                selectedSections = JSON.parse(jsonMatch[0]);
            }
        }

        if (!Array.isArray(selectedSections)) {
            selectedSections = [];
        }

        // Step 2: Extract text chunks corresponding to selected sections (or fallback to top context if none selected)
        // Since we are vector-less, we can gather text matching keyword filters or retrieve the raw text to feed the generator.
        // Let's create a grounded generator prompt using relevant context:
        const groundedContext = fullText.substring(0, 15000); 

        const answerPrompt = PromptTemplate.fromTemplate(`
You are a helpful classroom assistant. Answer the student query using only the provided context.
If the answer is not in the context, politely state that it's not covered in the notes.

Student Query:
{query}

Relevant Sections Selected:
{selectedSections}

Document Content:
{context}

Provide a direct, clear answer. CITE the section names you used to answer the query at the bottom of your response in the format "Source: [Section Name]".
`);

        const answerChain = answerPrompt.pipe(model);
        const answerResult = await answerChain.invoke({
            query,
            selectedSections: selectedSections.join(', ') || 'General document context',
            context: groundedContext
        });

        return {
            answer: typeof answerResult.content === 'string' ? answerResult.content : JSON.stringify(answerResult.content),
            citations: selectedSections
        };
    } catch (error) {
        console.error("❌ Error in PageIndex RAG:", error);
        throw new Error("Failed to answer query via PageIndex RAG");
    }
};
// Generate a structured lesson plan for a topic (AI Lesson Planner sidebar feature)
export const generateLessonPlan = async (params: { topic: string; gradeLevel?: string; durationMins?: number; contextText?: string }) => {
    const { topic, gradeLevel, durationMins, contextText } = params;
    try {
        const prompt = PromptTemplate.fromTemplate(`
You are an expert curriculum designer. Create a clear, practical lesson plan.

Topic: {topic}
Target level: {gradeLevel}
Total duration: {durationMins} minutes
{contextBlock}

You MUST respond with ONLY a valid JSON object. No markdown, no code fences.
Use this exact structure:
{{
  "title": "Lesson title",
  "summary": "1-2 sentence overview",
  "objectives": ["learners will be able to ...", "..."],
  "prerequisites": ["..."],
  "materials": ["..."],
  "outline": [
    {{ "phase": "Introduction / Hook", "durationMins": 5, "activities": ["..."] }},
    {{ "phase": "Direct Instruction", "durationMins": 15, "activities": ["..."] }},
    {{ "phase": "Guided Practice", "durationMins": 15, "activities": ["..."] }},
    {{ "phase": "Independent Practice", "durationMins": 10, "activities": ["..."] }},
    {{ "phase": "Assessment / Wrap-up", "durationMins": 5, "activities": ["..."] }}
  ],
  "assessmentIdeas": ["..."],
  "homework": ["..."]
}}
`);
        const chain = prompt.pipe(model);
        const result = await chain.invoke({
            topic,
            gradeLevel: gradeLevel || 'General / mixed ability',
            durationMins: (durationMins || 45).toString(),
            contextBlock: contextText ? `Ground the plan in these teacher notes where relevant:\n---\n${contextText.substring(0, 8000)}\n---` : ''
        });
        const responseText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
            else throw new Error('Could not extract lesson plan JSON');
        }
        return parsed;
    } catch (error) {
        console.error('❌ Error generating lesson plan:', error);
        throw new Error('Failed to generate lesson plan via AI');
    }
};

// Analyze quiz performance and produce learning gaps + recommended actions (Analytics infographic)
export const analyzeLearningGaps = async (params: { classroomName: string; questionStats: any[]; studentStats: any[] }) => {
    const { classroomName, questionStats, studentStats } = params;
    try {
        const prompt = PromptTemplate.fromTemplate(`
You are a teaching analytics assistant. Based on aggregated quiz performance, identify the concepts students struggle with most and give the teacher concrete recommended actions.

Classroom: {classroomName}

Per-question performance (question text and % of students who got it wrong):
{questionStats}

Per-student summary (name and average score %):
{studentStats}

You MUST respond with ONLY a valid JSON object. No markdown, no code fences.
Structure:
{{
  "learningGaps": [ {{ "concept": "short concept name", "missRate": 23 }} ],
  "recommendedActions": [ "specific action a teacher can take", "..." ]
}}
Return at most 5 learning gaps (highest miss rate first) and at most 5 actions.
`);
        const chain = prompt.pipe(model);
        const result = await chain.invoke({
            classroomName,
            questionStats: JSON.stringify(questionStats).substring(0, 6000),
            studentStats: JSON.stringify(studentStats).substring(0, 3000),
        });
        const responseText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { learningGaps: [], recommendedActions: [] };
        }
        return {
            learningGaps: parsed.learningGaps || [],
            recommendedActions: parsed.recommendedActions || [],
        };
    } catch (error) {
        console.error('❌ Error analyzing learning gaps:', error);
        return { learningGaps: [], recommendedActions: [] };
    }
};

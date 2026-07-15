import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import dotenv from 'dotenv';
dotenv.config();
const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
});
export const generateQuestionPaper = async (params) => {
    const topic = params.additionalInstructions || "General Academic Assessment";
    const questionTypes = params.questionTypes || [];
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
        }
        catch {
            // Try to find JSON array in the response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            }
            else {
                throw new Error('Could not extract valid JSON from LLM response');
            }
        }
        // Ensure we have an array
        const sections = Array.isArray(parsed) ? parsed : [parsed];
        // Normalize field names to match DB schema
        const normalizedSections = sections.map((section) => ({
            title: section.title || section.sectionTitle || 'Untitled Section',
            instruction: section.instruction || section.instructions || 'Answer all questions.',
            questions: (section.questions || []).map((q) => ({
                type: q.type || 'mcq',
                prompt: q.prompt || q.text || '',
                options: q.options || [],
                answerKey: q.answerKey || q.answer || '',
                difficulty: q.difficulty || 'Moderate',
                marks: q.marks || 1,
            }))
        }));
        console.log(`✅ Successfully generated ${normalizedSections.length} sections with ${normalizedSections.reduce((s, sec) => s + sec.questions.length, 0)} total questions`);
        return normalizedSections;
    }
    catch (error) {
        console.error("❌ Error generating assessment via Groq:", error);
        throw new Error("Failed to generate assessment via AI");
    }
};

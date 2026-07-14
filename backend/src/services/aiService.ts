import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Groq Model (Llama 3 for fast inference)
const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama3-8b-8192", 
    temperature: 0.2, // Low temperature for more factual, grounded questions
});

// Define the exact schema we expect the LLM to return
const questionSchema = z.object({
    type: z.enum(['mcq', 'short', 'essay']),
    prompt: z.string().describe("The actual question text"),
    options: z.array(z.string()).optional().describe("Provide 4 options if type is mcq, otherwise omit"),
    answerKey: z.string().describe("The correct answer or grading rubric"),
    difficulty: z.enum(['Easy', 'Moderate', 'Hard']),
    marks: z.number(),
});

const paperSchema = z.object({
    title: z.string(),
    instruction: z.string(),
    questions: z.array(questionSchema)
});

// We expect an array of sections (e.g., Section A: MCQs, Section B: Short Answers)
const assessmentOutputSchema = z.array(paperSchema);
const parser = StructuredOutputParser.fromZodSchema(assessmentOutputSchema);

// We now accept a single 'params' object that matches what your queue hands over
export const generateQuestionPaper = async (params: any) => {
    
    // We map the data coming from your Next.js frontend (additionalInstructions and totalQuestions)
    const topic = params.additionalInstructions || "General Academic Assessment";
    const total = Number(params.totalQuestions) || 10;
    
    // Automatically split the total questions (e.g., 60% MCQs, 40% Short Answer)
    const mcqCount = Math.floor(total * 0.6);
    const shortCount = total - mcqCount;
    const essayCount = 0; 

    const contextText = params.contextText || "Generate standard academic questions based on general knowledge.";

    try {
        const formatInstructions = parser.getFormatInstructions();

        const prompt = new PromptTemplate({
            template: `You are an expert academic assessment creator.
            Generate a highly accurate assessment on the topic: {topic}.

            Requirements:
            - {mcqCount} Multiple Choice Questions
            - {shortCount} Short Answer Questions
            - {essayCount} Essay Questions

            Use the following extracted notes to ground your questions. Do not hallucinate outside this context:
            ---
            {contextText}
            ---

            {formatInstructions}`,
            inputVariables: ["topic", "mcqCount", "shortCount", "essayCount", "contextText"],
            partialVariables: { formatInstructions },
        });

        // The LangChain sequence: Prompt -> LLM -> JSON Parser
        const chain = prompt.pipe(model).pipe(parser);

        const result = await chain.invoke({
            topic,
            mcqCount: mcqCount.toString(),
            shortCount: shortCount.toString(),
            essayCount: essayCount.toString(),
            contextText
        });

        return result;
    } catch (error) {
        console.error("Error generating assessment:", error);
        throw new Error("Failed to generate assessment via AI");
    }
};
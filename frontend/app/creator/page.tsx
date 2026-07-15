'use client';

import React, { useState } from 'react';
import { PlusCircle, FileText, LayoutDashboard, Settings, Layers, Loader2, CheckCircle2, Download, UploadCloud } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAssignmentStore } from '../../store/useAssignmentStore';

const socket = io('http://localhost:5001');

export default function CreatorPage() {
  const { 
    totalQuestions, 
    totalMarks, 
    additionalInstructions, 
    contextText,
    status,
    generatedPaper,
    updateForm,
    setStatus,
    setResult 
  } = useAssignmentStore();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:5001/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log("Extracted chunks:", response.data);
      updateForm('contextText', response.data.sampleChunk); 
      setUploadSuccess(true);
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to process the PDF. Make sure the backend is running.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (totalQuestions <= 0 || totalMarks <= 0) {
      alert("Please enter valid numbers for questions and marks.");
      return;
    }

    try {
      setStatus('generating');

      const response = await axios.post('http://localhost:5001/api/assignments/create', {
        dueDate: new Date().toISOString(),
        questionTypes: ['Multiple Choice', 'Short Answer'], 
        totalQuestions: Number(totalQuestions),
        totalMarks: Number(totalMarks),
        additionalInstructions,
        contextText 
      });

      const newAssignmentId = response.data.assignmentId;
      
      socket.on(`assignment-complete-${newAssignmentId}`, async (data) => {
        if (data.status === 'success') {
          const result = await axios.get(`http://localhost:5001/api/assignments/${newAssignmentId}`);
          setResult(newAssignmentId, result.data.assignment.generatedPaper);
          socket.off(`assignment-complete-${newAssignmentId}`);
        } else {
          setStatus('failed');
          alert("AI Generation failed.");
          socket.off(`assignment-complete-${newAssignmentId}`);
        }
      });

    } catch (error) {
      console.error("Failed to start generation", error);
      setStatus('failed');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setUploadSuccess(false);
    updateForm('totalQuestions', 0);
    updateForm('totalMarks', 0);
    updateForm('additionalInstructions', '');
    updateForm('contextText', '');
  };

  return (
    <main className="flex min-h-screen relative overflow-hidden bg-[#0A0A0A]">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-orange-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[140px] pointer-events-none" />

      <aside className="w-64 glass-sidebar flex flex-col relative z-10 border-r border-white/5 bg-white/[0.02] backdrop-blur-xl">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-xl border border-orange-500/30">
            <Layers className="w-5 h-5 text-orange-500" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            AxesAI
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 mt-4">
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium transition-all shadow-sm">
            <LayoutDashboard className="w-4 h-4" /> Home
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-all">
            <FileText className="w-4 h-4" /> Assignments
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-all">
            <Settings className="w-4 h-4" /> Settings
          </a>
        </nav>
      </aside>

      <section className="flex-1 p-8 overflow-y-auto relative z-10 flex flex-col justify-start items-center pt-16">
        
        {status !== 'completed' ? (
          <div className="w-full max-w-2xl bg-[#111111]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 transition-all shadow-2xl">
            <header className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Create New Assessment</h2>
              <p className="text-sm text-gray-400">Deploy elite background workers powered by Groq LPUs.</p>
            </header>

            <hr className="border-white/5 mb-6" />

            <div className="space-y-5">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Questions</label>
                  <input 
                    type="number"
                    value={totalQuestions || ''}
                    onChange={(e) => updateForm('totalQuestions', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-orange-500/50 rounded-xl p-3 text-white placeholder-gray-600 outline-none transition-all"
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Marks</label>
                  <input 
                    type="number"
                    value={totalMarks || ''}
                    onChange={(e) => updateForm('totalMarks', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-orange-500/50 rounded-xl p-3 text-white placeholder-gray-600 outline-none transition-all"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Additional Instructions</label>
                <textarea 
                  value={additionalInstructions}
                  onChange={(e) => updateForm('additionalInstructions', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-orange-500/50 rounded-xl p-4 text-white placeholder-gray-600 outline-none min-h-[100px] text-sm resize-none transition-all"
                  placeholder="e.g., Generate a question paper for 8th grade science focusing on cell biology..."
                />
              </div>

              <div className="mt-4 p-5 rounded-xl border-2 border-dashed border-white/10 hover:border-orange-500/50 transition-all bg-white/5 flex flex-col items-center justify-center relative cursor-pointer group">
                <input 
                  type="file" 
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3 text-orange-500">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm font-medium">Extracting text via LangChain...</span>
                  </div>
                ) : uploadSuccess ? (
                  <div className="flex flex-col items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-8 h-8 mb-1" />
                    <span className="text-sm font-medium">Syllabus Context Uploaded!</span>
                    <span className="text-xs text-green-500/70">AI will now ground questions using this text.</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-white/5 rounded-full mb-3 group-hover:bg-orange-500/10 group-hover:text-orange-500 transition-all">
                      <UploadCloud className="w-6 h-6 text-gray-400 group-hover:text-orange-500" />
                    </div>
                    <p className="text-sm font-medium text-white mb-1">Upload Syllabus or Notes (PDF)</p>
                    <p className="text-xs text-gray-500">Drag & drop or click to browse</p>
                  </div>
                )}
              </div>

              <button 
                onClick={handleGenerate}
                disabled={status === 'generating'}
                className="w-full bg-white text-gray-900 font-semibold py-3.5 px-4 rounded-xl hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.99] flex items-center justify-center gap-2 mt-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'generating' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    AI is crafting your paper...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-5 h-5" />
                    Initialize Generation
                  </>
                )}
              </button>

            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl bg-[#111111]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-10 transition-all shadow-2xl">
            <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Generated Assessment</h2>
                <p className="text-gray-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" /> Successfully generated via Groq
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleReset} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-all">
                  Create Another
                </button>
                <button className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-500/90 text-white text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20">
                  <Download className="w-4 h-4" /> Export PDF
                </button>
              </div>
            </div>

            <div className="mb-10 text-center text-white">
              <h3 className="text-2xl font-bold mb-1">AxesAI Academy</h3>
              <h4 className="text-lg text-gray-300 mb-6">Subject: AI Generated Assessment</h4>
              <div className="flex justify-between text-sm border-b border-white/10 pb-4 mb-4 text-gray-400">
                <p>Time Allowed: 3 Hours</p>
                <p>Maximum Marks: {totalMarks}</p>
              </div>
              <div className="flex gap-4 justify-between text-left text-sm mt-6">
                <div className="flex-1"><span className="text-gray-500">Name:</span> <div className="border-b border-gray-600 mt-2 h-4"></div></div>
                <div className="flex-1"><span className="text-gray-500">Roll No:</span> <div className="border-b border-gray-600 mt-2 h-4"></div></div>
                <div className="flex-1"><span className="text-gray-500">Section:</span> <div className="border-b border-gray-600 mt-2 h-4"></div></div>
              </div>
            </div>

            {generatedPaper?.map((section: any, sIndex: number) => (
              <div key={sIndex} className="mb-12">
                <div className="mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
                  <h4 className="text-xl font-bold text-white mb-1">{section.title}</h4>
                  <p className="text-sm text-gray-400 italic">{section.instruction}</p>
                </div>
                
                <div className="space-y-8 pl-2">
                  {section.questions.map((q: any, qIndex: number) => (
                    <div key={qIndex} className="flex gap-4 group">
                      <span className="text-gray-500 font-medium text-lg">{qIndex + 1}.</span>
                      <div className="flex-1">
                        <p className="text-gray-200 mb-3 leading-relaxed text-[15px]">{q.prompt}</p>
                        
                        {q.options && q.options.length > 0 && (
                          <div className="mt-4 space-y-2.5 mb-5 pl-2">
                            {q.options.map((opt: string, i: number) => (
                              <div key={i} className="flex items-center gap-3 text-[14px] text-gray-300 bg-white/[0.03] hover:bg-white/[0.06] p-3 rounded-lg border border-white/5 transition-all cursor-default">
                                <span className="font-semibold text-gray-500 bg-black/20 w-6 h-6 flex items-center justify-center rounded-md text-xs border border-white/5">
                                  {String.fromCharCode(65 + i)}
                                </span> 
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-3">
                          <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md font-semibold border
                            ${q.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                              q.difficulty === 'Moderate' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                              'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                            {q.difficulty}
                          </span>
                        </div>
                      </div>
                      <div className="text-gray-500 font-medium whitespace-nowrap text-sm mt-1">
                        [{q.marks} Marks]
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

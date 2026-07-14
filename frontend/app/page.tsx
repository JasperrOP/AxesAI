'use client';

import React from 'react';
import { PlusCircle, FileText, LayoutDashboard, Settings, Layers, Loader2, CheckCircle2, Download } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAssignmentStore } from '../store/useAssignmentStore';

// Connect to our backend server outside the component to avoid multiple reconnections
const socket = io('http://localhost:5001');

export default function Home() {
  const { 
    totalQuestions, 
    totalMarks, 
    additionalInstructions, 
    status,
    generatedPaper,
    updateForm,
    setStatus,
    setResult 
  } = useAssignmentStore();

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
        additionalInstructions
      });

      const newAssignmentId = response.data.assignmentId;
      console.log("Job queued! Listening for completion on ID:", newAssignmentId);

      // Start listening for THIS specific assignment to finish
      socket.on(`assignment-complete-${newAssignmentId}`, async (data) => {
        if (data.status === 'success') {
          console.log("AI Finished! Fetching final paper...");
          
          // Fetch the completed paper from the database
          const result = await axios.get(`http://localhost:5001/api/assignments/${newAssignmentId}`);
          
          // Save it to our Zustand store and switch status to 'completed'
          setResult(newAssignmentId, result.data.assignment.generatedPaper);
          
          // Stop listening to prevent memory leaks
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
      alert("Server error. Make sure your backend is running on port 5001!");
    }
  };

  const handleReset = () => {
    setStatus('idle');
    updateForm('totalQuestions', 0);
    updateForm('totalMarks', 0);
    updateForm('additionalInstructions', '');
  };

  return (
    <main className="flex min-h-screen relative overflow-hidden">
      
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-orange/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[140px] pointer-events-none" />

      {/* Sidebar */}
      <aside className="w-64 glass-sidebar flex flex-col relative z-10">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="p-2 bg-brand-orange/20 rounded-xl border border-brand-orange/30">
            <Layers className="w-5 h-5 text-brand-orange" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            AxesAI
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 mt-4">
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium transition-all">
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

      {/* Main Workspace */}
      <section className="flex-1 p-8 overflow-y-auto relative z-10 flex flex-col justify-start items-center pt-16">
        
        {status !== 'completed' ? (
          /* Form Layout */
          <div className="w-full max-w-2xl glass-card rounded-2xl p-8 transition-all">
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
                    className="w-full glass-input rounded-xl p-3 text-white placeholder-gray-600 outline-none"
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Marks</label>
                  <input 
                    type="number"
                    value={totalMarks || ''}
                    onChange={(e) => updateForm('totalMarks', e.target.value)}
                    className="w-full glass-input rounded-xl p-3 text-white placeholder-gray-600 outline-none"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Additional Instructions</label>
                <textarea 
                  value={additionalInstructions}
                  onChange={(e) => updateForm('additionalInstructions', e.target.value)}
                  className="w-full glass-input rounded-xl p-4 text-white placeholder-gray-600 outline-none min-h-[100px] text-sm resize-none"
                  placeholder="e.g., Generate a question paper for 8th grade science focusing on cell biology..."
                />
              </div>

              <button 
                onClick={handleGenerate}
                disabled={status === 'generating'}
                className="w-full bg-white text-graphite-900 font-semibold py-3.5 px-4 rounded-xl hover:bg-gray-100 transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 mt-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
          /* Output UI Layout */
          <div className="w-full max-w-4xl glass-card rounded-2xl p-10 transition-all">
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
                <button className="px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-sm font-medium flex items-center gap-2 transition-all">
                  <Download className="w-4 h-4" /> Export PDF
                </button>
              </div>
            </div>

            {/* Paper Header / Student Details */}
            <div className="mb-10 text-center text-white">
              <h3 className="text-2xl font-bold mb-1">AxesAI Academy</h3>
              <h4 className="text-lg text-gray-300 mb-6">Subject: General Assessment</h4>
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

            {/* Render the Sections */}
            {generatedPaper?.map((section, sIndex) => (
              <div key={sIndex} className="mb-10">
                <div className="mb-4">
                  <h4 className="text-xl font-bold text-white">{section.title}</h4>
                  <p className="text-sm text-gray-400 italic">{section.instruction}</p>
                </div>
                
                <div className="space-y-6">
                  {section.questions.map((q, qIndex) => (
                    <div key={qIndex} className="flex gap-4 group">
                      <span className="text-gray-500 font-medium">{qIndex + 1}.</span>
                      <div className="flex-1">
                        <p className="text-gray-200 mb-2 leading-relaxed">{q.text}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold border
                            ${q.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                              q.difficulty === 'Moderate' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                              'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                            {q.difficulty}
                          </span>
                        </div>
                      </div>
                      <div className="text-gray-500 font-medium whitespace-nowrap">
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
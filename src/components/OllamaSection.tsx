"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Bot } from 'lucide-react';
import { useProgress } from '@/context/ProgressContext';
import { useLab } from '@/context/LabContext';

export interface OllamaSectionProps {
  type: 'ollama-mcq' | 'ollama-descriptive';
  topic: string;
  context?: string;
  onComplete: () => void;
  sectionIdx: number;
}

export function OllamaSection({ type, topic, context, onComplete, sectionIdx }: OllamaSectionProps) {
  const [loading, setLoading] = useState(true);
  const [questionData, setQuestionData] = useState<any>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; text: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { addCoins, isSectionCompleted, completeSection } = useProgress();
  const { activeLab } = useLab();

  const isCompleted = activeLab ? isSectionCompleted(activeLab.id, sectionIdx) : false;

  useEffect(() => {
    if (isCompleted && !questionData) {
      setQuestionData({
        question: "This section was already completed. The question was generated dynamically.",
        options: type === 'ollama-mcq' ? ["Completed", "Completed", "Completed", "Completed"] : undefined,
        correct: 0,
      });
      setLoading(false);
      return;
    }

    if (questionData || !activeLab) return;

    const generateQuestion = async () => {
      setLoading(true);
      try {
        // Random seed ensures a unique question every time
        const seed = Math.random().toString(36).slice(2, 8);
        let prompt = '';
        if (type === 'ollama-mcq') {
          prompt = `[${seed}] Cybersecurity MCQ on "${topic}"${context ? ` (${context})` : ''}. Return ONLY valid JSON:
{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}`;
        } else {
          prompt = `[${seed}] Cybersecurity descriptive question on "${topic}"${context ? ` (${context})` : ''}. Return ONLY valid JSON:
{"question":"...","expected_answer_concepts":["concept1","concept2"]}`;
        }

        const res = await fetch('/api/ollama', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, format: 'json' })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const parsed = JSON.parse(data.response.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
        setQuestionData(parsed);
      } catch (err: any) {
        console.error("Failed to generate question:", err);
        const errMsg = err.message || 'Unknown error';
        
        // Fallback question
        if (type === 'ollama-mcq') {
          setQuestionData({
            question: `[ERROR] ${errMsg}. (Fallback Question: What is the primary goal of ${topic}?)`,
            options: ["To secure systems", "To compromise systems", "To monitor networks", "To ignore security"],
            correct: 0,
            explanation: "Basic fallback explanation due to Ollama error."
          });
        } else {
          setQuestionData({
            question: `[ERROR] ${errMsg}. (Fallback: Describe the methodology for ${topic}.)`,
            expected_answer_concepts: ["methodology", "security"]
          });
        }
      } finally {
        setLoading(false);
      }
    };

    generateQuestion();
  }, [type, topic, context, questionData, isCompleted, activeLab]);

  const handleVerify = async () => {
    if (type === 'ollama-mcq' && selectedOption === null) return;
    if (type === 'ollama-descriptive' && !userAnswer.trim()) return;

    setVerifying(true);
    let isCorrect = false;
    let feedbackText = '';

    if (type === 'ollama-mcq') {
      isCorrect = selectedOption === questionData.correct;
      feedbackText = isCorrect 
        ? `Correct! ${questionData.explanation}` 
        : `Incorrect. ${questionData.explanation}`;
    } else {
      try {
        const seed = Math.random().toString(36).slice(2, 8);
        const prompt = `[${seed}] Grade this cybersecurity answer. Q: "${questionData.question}" A: "${userAnswer}" Concepts: ${JSON.stringify(questionData.expected_answer_concepts)}. Return ONLY valid JSON: {"isCorrect":true,"feedback":"..."}`;
        const res = await fetch('/api/ollama', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, format: 'json' })
        });
        
        const data = await res.json();
        const parsed = JSON.parse(data.response.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
        isCorrect = parsed.isCorrect;
        feedbackText = parsed.feedback;
      } catch (err) {
        console.error("Validation failed", err);
        isCorrect = userAnswer.length > 10;
        feedbackText = isCorrect ? "Good description!" : "Please provide a more detailed answer.";
      }
    }

    setVerifying(false);
    setFeedback({ isCorrect, text: feedbackText });

    if (isCorrect && !isCompleted && activeLab) {
      await addCoins(200, 'Answered AI Question');
      completeSection(activeLab.id, sectionIdx);
      // Auto-advance after 3.5 seconds only on correct answer
      setTimeout(() => {
        onComplete();
      }, 3500);
    }
    // Wrong answers: show feedback but stay on section (user can retry)
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent-orange" />
        <p className="text-sm font-mono text-text-muted animate-pulse">Ollama is generating a unique question...</p>
      </div>
    );
  }

  if (isCompleted && !feedback) {
    return (
      <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded mt-4">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm mb-2">
          <CheckCircle2 className="w-4 h-4" /> Section Completed
        </div>
        <p className="text-xs text-text-muted">You have already completed this dynamic assessment.</p>
        <button 
          onClick={onComplete}
          className="mt-4 bg-bg-secondary hover:bg-border-primary text-text-primary px-4 py-2 rounded text-xs font-mono transition-colors"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-2 text-accent-orange font-mono text-[10px] uppercase font-bold mb-2">
        <Bot className="w-3.5 h-3.5" /> AI Generated Assessment
      </div>
      
      <p className="text-sm font-sans text-text-primary leading-relaxed font-medium">
        {questionData?.question}
      </p>

      {type === 'ollama-mcq' ? (
        <div className="space-y-3">
          {questionData?.options?.map((opt: string, i: number) => (
            <button
              key={i}
              disabled={feedback !== null}
              onClick={() => setSelectedOption(i)}
              className={`w-full text-left px-4 py-3 text-xs rounded border font-mono transition-all duration-200 
                ${selectedOption === i 
                  ? 'border-accent-orange bg-accent-dim text-accent-orange' 
                  : 'bg-bg-primary border-border-primary text-text-muted hover:border-text-secondary hover:text-text-primary hover:bg-bg-secondary'}
                ${feedback !== null ? 'opacity-70 cursor-not-allowed' : ''}
              `}
            >
              <span className="mr-3 font-bold opacity-50">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <textarea
          disabled={feedback?.isCorrect === true}
          value={userAnswer}
          onChange={(e) => {
            setUserAnswer(e.target.value);
            // Clear wrong feedback so user can retry
            if (feedback && !feedback.isCorrect) setFeedback(null);
          }}
          className="w-full bg-bg-primary border border-border-primary rounded px-4 py-3 text-sm text-text-primary font-mono focus:border-accent-orange outline-none disabled:opacity-50 min-h-[120px] resize-y custom-scrollbar"
          placeholder="Describe your answer..."
        />
      )}

      {!feedback ? (
        <button
          disabled={verifying || (type === 'ollama-mcq' ? selectedOption === null : !userAnswer.trim())}
          onClick={handleVerify}
          className="bg-accent-orange hover:bg-accent-hover text-white text-xs px-6 py-2.5 rounded font-mono font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Submit Answer
        </button>
      ) : (
        <div className={`p-4 rounded border text-sm font-sans leading-relaxed mt-4 ${
          feedback.isCorrect 
            ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-600' 
            : 'bg-red-950/20 border-red-900/40 text-red-600'
        }`}>
          <div className="flex items-center gap-2 mb-2 font-mono font-bold text-[10px] uppercase tracking-wider">
            {feedback.isCorrect ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> Correct (+200 Coins)</>
            ) : (
              <><AlertCircle className="w-3.5 h-3.5" /> Incorrect</>
            )}
          </div>
          {feedback.text}
          
          <div className="mt-4 pt-4 border-t border-current/10 flex justify-between items-center">
            <span className="text-[10px] font-mono opacity-70 animate-pulse">Auto-advancing...</span>
            <button 
              onClick={onComplete}
              className="bg-current/10 hover:bg-current/20 px-4 py-1.5 rounded text-xs font-mono transition-colors"
            >
              Continue Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

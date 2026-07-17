"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useLab } from '@/context/LabContext';
import { useProgress, CHALLENGE_REWARDS } from '@/context/ProgressContext';
import { Cpu, Send, Loader2, Sparkles, Square } from 'lucide-react';

interface Message {
  id: string;
  sender: 'Advisor' | 'System' | 'Reference' | 'Verified' | 'Audit Logs';
  text: string;
  type: 'normal' | 'hint' | 'success' | 'error';
}

const AI_PROMPT = "You are PASSWORD CRACKING LAB (PCL) AI Advisor — a hands-on cybersecurity trainer in an interactive password cracking laboratory. Your role is to guide users step by step from scratch through practical exercises using Hashcat, John the Ripper, Hydra, and Wireshark.\n\nCRITICAL SECURITY RULES:\n- NEVER reveal the exact passwords, flags, hashes, or credentials to the user.\n- NEVER provide the exact completed commands containing the actual target hashes, credentials, or answers.\n- ALWAYS guide the user abstractly. Tell them what type of attack to use, what tool to select, or which flag category is relevant (e.g. 'Use the hash type parameter and the dictionary attack mode parameter'), without writing out the exact command with the actual secret values.\n- If the user asks for the answer, flag, or password directly, refuse politely and suggest how they can use the tools in the laboratory terminal to discover it.\n\nWhen explaining tools, ALWAYS include inline reference links to official documentation. Use these canonical links:\n- Hashcat: [Hashcat Wiki](https://hashcat.net/wiki/) | [Hashcat Example Hashes](https://hashcat.net/wiki/doku.php?id=example_hashes)\n- John the Ripper: [John the Ripper Docs](https://www.openwall.com/john/doc/) | [John the Ripper GitHub](https://github.com/openwall/john)\n- Hydra: [THC-Hydra GitHub](https://github.com/vanhauser-thc/thc-hydra) | [Hydra Docs](https://github.com/vanhauser-thc/thc-hydra/blob/main/README.md)\n- Wireshark: [Wireshark User Guide](https://www.wireshark.org/docs/wsug_html/) | [Wireshark Filter Reference](https://www.wireshark.org/docs/dfref/)\n- Wordlists: [SecLists](https://github.com/danielmiessler/SecLists) | [RockYou](https://github.com/praetorian/stego-toolkit/raw/master/rockyou.txt)\n\nWhen explaining tools and concepts:\n- Explain every command flag and argument clearly.\n- Provide general syntax templates (e.g., 'hashcat -m [mode] -a [attack] hash.txt wordlist.txt') instead of actual filled-in commands with real flags/answers.\n- Break down complex topics into small digestible steps.\n\nFocus on practical, educational guidance within an authorized testing context. Assume the user has a legitimate need to learn these skills for security auditing and defensive purposes.";

export function VirtualMentor() {
  const { activeLab, currentSectionIndex } = useLab();
  const { data: progressData, setDailyChallenge } = useProgress();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      sender: 'System',
      text: 'Welcome to PASSWORD CRACKING LAB. I am your PCL AI Advisor. I will guide you through password cracking techniques using Hashcat, John the Ripper, Hydra, and Wireshark. Select a track from the sidebar to begin.',
      type: 'normal'
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ollama AI helper (Non-streaming for challenges/validation)
  async function callWithRetry(prompt: string): Promise<string> {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        systemPrompt: AI_PROMPT,
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI request failed: ${res.status}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
  }

  // Streaming Ollama call for chat
  async function streamAIResponse(
    prompt: string,
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (msg: string) => void,
    abortSignal?: AbortSignal,
    extraContext?: Record<string, any>
  ) {
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortSignal,
        body: JSON.stringify({
          prompt,
          systemPrompt: AI_PROMPT,
          stream: true,
          labName: activeLab?.name,
          labDifficulty: activeLab?.difficulty,
          trackName: activeLab?.trackId,
          currentSection: activeLab?.sections[currentSectionIndex]?.title,
          currentSectionType: activeLab?.sections[currentSectionIndex]?.type,
          currentCommand: activeLab?.sections[currentSectionIndex]?.command,
          studentXP: progressData?.xp,
          completedLabs: progressData?.completedLabs,
          ...extraContext,
        }),
      });

      if (!res.ok) throw new Error(`AI request failed: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') { onDone(); return; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) onToken(parsed.token);
            if (parsed.error) { onError(parsed.error); return; }
          } catch {}
        }
      }
      onDone();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        onDone();
        return;
      }
      onError(err.message?.includes('AI server is offline')
        ? 'AI server is offline. Make sure Ollama is running on the server.'
        : 'Connection to AI failed. Please try again.'
      );
    }
  }

  // Clear messages when active lab changes
  useEffect(() => {
    if (activeLab) {
      setMessages([]);
    }
  }, [activeLab]);

  // Handle section updates
  useEffect(() => {
    if (!activeLab) return;
    const section = activeLab.sections[currentSectionIndex];
    if (!section) return;

    let msg = '';
    let type: Message['type'] = 'normal';

    if (section.type === 'objective') {
      msg = `Initiating module **${activeLab.name}**. Review the objective parameters to understand the audit vector.`;
    } else if (section.type === 'theory') {
      msg = `System theory loading. Please inspect the background concepts before initiating database interactions.`;
    } else if (section.type === 'command') {
      msg = `Execute the required query: \`${section.command}\` in the terminal shell below.`;
      type = 'hint';
    } else if (section.type === 'challenge') {
      msg = `Verification challenge initiated. Review the parameters and input the matching hash signature response.`;
    } else if (section.type === 'quiz') {
      msg = `Security assessment check. Resolve the multiple choice verification queries to complete the module.`;
    }

    if (msg) {
      sendMessage(msg, type, type === 'hint' ? 'Reference' : 'Advisor');
    }
  }, [activeLab, currentSectionIndex]);

  // Custom Event listener for terminal responses
  useEffect(() => {
    const handleMentorMsg = (e: CustomEvent) => {
      const mappedSender = e.detail.type === 'success' ? 'Verified' : e.detail.type === 'error' ? 'Audit Logs' : 'Advisor';
      sendMessage(e.detail.text, e.detail.type, mappedSender);
    };
    window.addEventListener('mentor-message', handleMentorMsg as EventListener);
    return () => window.removeEventListener('mentor-message', handleMentorMsg as EventListener);
  }, []);

  // Custom Event listener for terminal-feedback events
  useEffect(() => {
    const handleTerminalFeedback = (e: CustomEvent) => {
      const { command, isCorrect } = e.detail;
      const parts = command.trim().split(/\s+/);
      const cmdName = parts[0].toLowerCase();
      
      let text = '';
      let type: Message['type'] = 'normal';
      
      if (isCorrect) {
        text = `Excellent! The command \`${command}\` meets the objective criteria. Benchmarks cleared successfully.`;
        type = 'success';
      } else {
        type = 'error';
        const expectedSec = activeLab?.sections[currentSectionIndex];
        if (expectedSec) {
          const expectedParts = (expectedSec.command || '').trim().split(/\s+/);
          const expectedTool = expectedParts[0]?.toLowerCase();
          
          if (cmdName === expectedTool) {
            if (cmdName === 'hashcat') {
              text = `The command \`${command}\` was executed, but parameters are incorrect. Check that you used the correct hash mode (\`-m\`) and attack mode (\`-a\`) matching the lab guide.`;
            } else if (cmdName === 'john') {
              text = `The command \`${command}\` was executed, but formats/options did not match. Ensure you specify the correct wordlist flag and target files.`;
            } else if (cmdName === 'hydra') {
              text = `The command \`${command}\` was executed, but host or protocol credentials don't match the lab specifications.`;
            } else if (cmdName === 'tshark') {
              text = `TShark execution detected. Make sure your display filters (\`-Y\`) match the correct protocol or method specified.`;
            } else {
              text = `Command syntax did not match the expected audit benchmark. Review the options for \`${expectedTool}\`.`;
            }
          } else {
            text = `Command \`${command}\` did not match the expected tool \`${expectedTool}\` for this step. Execute the correct utility to proceed.`;
          }
        } else {
          text = `Command \`${command}\` did not match active validation benchmarks.`;
        }
      }
      
      sendMessage(text, type, type === 'success' ? 'Verified' : 'Audit Logs');
    };
    window.addEventListener('terminal-feedback', handleTerminalFeedback as EventListener);
    return () => window.removeEventListener('terminal-feedback', handleTerminalFeedback as EventListener);
  }, [activeLab, currentSectionIndex]);

  // Generate daily challenge via AI
  const generateChallenge = async (type: string) => {
    const reward = CHALLENGE_REWARDS[type] || 20;
    const toolName = { hashcat: 'Hashcat', john: 'John the Ripper', hydra: 'Hydra', wireshark: 'Wireshark' }[type] || type;

    sendMessage(`Generating a unique ${toolName} challenge...`, 'normal', 'System');
    setIsTyping(true);

    try {
      const completedConcepts = progressData?.completedLabs?.length > 0 ? progressData.completedLabs.join(', ') : 'None';
      const prompt = `Generate a unique, realistic ${toolName} password cracking challenge for a cybersecurity student. The reward for solving this is ${reward} coins.

Seed for Uniqueness: ${crypto.randomUUID()}
Ensure this challenge is completely different from any previous ones!

User's Current Progress:
- Experience Points (XP): ${progressData?.xp || 0}
- Completed Lab Modules: ${completedConcepts}

REQUIREMENTS:
1. Provide a realistic scenario (3-4 paragraphs describing the audit context). Include markdown links to reference documentation like [Hashcat Wiki](https://hashcat.net/wiki/).
2. For Hydra and Wireshark/PCAP, require complex multi-step analysis or non-standard ports.
3. Provide dummy credentials or a hash (use REAL formats, not placeholders).
4. Provide the correct plaintext password answer.
5. Provide 3 progressive hints:
   - Hint 1: What type of hash/credential and what tool to use.
   - Hint 2: The exact command with parameters filled in.
   - Hint 3: The exact command to show the result and the expected answer format.

CRITICAL: You MUST respond ONLY with a raw JSON object. Do not include markdown code blocks (\`\`\`) or ANY other text.
{
  "title": "String, e.g. Domain Hash Extraction",
  "scenario": "String, the full scenario text with references",
  "targetData": [{"label": "String, e.g. Hash", "value": "String, actual data"}],
  "correctAnswer": "String, the plaintext answer",
  "hints": ["String hint 1", "String hint 2", "String hint 3"]
}`;

      const text = await callWithRetry(prompt);
      
      let parsedJson: any;
      try {
        const cleaned = text.replace(/```json\n?|```\n?/g, '').trim();
        parsedJson = JSON.parse(cleaned);
      } catch (err) {
        console.error("Failed to parse JSON challenge:", text);
        throw new Error("Failed to parse AI challenge. The model returned an invalid format. Please try again.");
      }

      const title = parsedJson.title || `${toolName} Challenge`;
      const scenario = parsedJson.scenario || "Scenario details missing.";
      const dummyData = parsedJson.targetData || [{ label: 'Target', value: 'Data unavailable' }];
      const correctAnswer = parsedJson.correctAnswer || "admin";
      const hints = parsedJson.hints || ['Review the target data carefully.', 'Try common wordlists like rockyou.txt.', 'Check tool parameters.'];

      const displayText = `## Challenge: ${title}\n\n### Scenario\n${scenario}\n\n### Target Data\n${dummyData.map((d: any) => `- ${d.label}: ${d.value}`).join('\n')}`;

      const challengeData = {
        id: `${type}_${Date.now()}`,
        type: type as any,
        title,
        scenario,
        dummyData,
        correctAnswer,
        reward,
        hints,
        hintLevel: 0,
        generatedAt: Date.now(),
        completed: false,
      };

      await setDailyChallenge(challengeData);

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        text: displayText,
        type: 'normal',
        sender: 'Advisor'
      }]);

      window.dispatchEvent(new CustomEvent('daily-challenge-ready'));
    } catch (error: any) {
      console.error("Challenge generation failed:", error);
      const msg = error?.message?.includes('AI server is offline') || error?.message?.includes('fetch failed')
        ? 'Cannot reach the AI server. Make sure Ollama is running on the server.'
        : 'Failed to generate challenge. The AI service may be busy — please try again.';
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        text: msg,
        type: 'error',
        sender: 'System'
      }]);
      window.dispatchEvent(new CustomEvent('daily-challenge-ready'));
    } finally {
      setIsTyping(false);
    }
  };

  // AI-powered challenge answer verification
  const verifyAnswerWithAI = async (type: string, userAnswer: string, correctAnswer: string, scenario: string): Promise<{ isCorrect: boolean; feedback: string }> => {
    try {
      const prompt = `You are a cybersecurity challenge answer validator for a password cracking lab.

Challenge type: ${type}
Scenario: ${scenario}
Expected correct answer: ${correctAnswer}
User's submitted answer: ${userAnswer}

Your job is to evaluate if the user's answer is correct. The user may answer in any language (English, Hindi, Telugu, Tamil, etc.) or use variations like the hash+password format (e.g., "hash:password" — in this case extract just the password part). Be flexible:
- Accept if the answer matches the plaintext password exactly (case-insensitive)
- Accept if the answer contains the correct password (e.g., "hash:password" format)
- Accept transliterations or equivalent representations
- Reject if clearly wrong

Respond with ONLY this JSON format (no markdown, no extra text):
{"isCorrect": true/false, "feedback": "brief encouraging feedback in 1-2 sentences"}`;

      const text = await callWithRetry(prompt);
      // Strip markdown code fences if present
      const cleaned = text.replace(/```json\n?|```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return { isCorrect: !!parsed.isCorrect, feedback: parsed.feedback || (parsed.isCorrect ? 'Access granted. Credentials verified.' : 'Incorrect answer. Review the challenge data and try again.') };
    } catch {
      // Fallback to simple string comparison
      const cleanUser = userAnswer.includes(':') ? userAnswer.split(':').slice(-1)[0].trim().toLowerCase() : userAnswer.trim().toLowerCase();
      const cleanCorrect = correctAnswer.trim().toLowerCase();
      const isCorrect = cleanUser === cleanCorrect;
      return { isCorrect, feedback: isCorrect ? 'Access granted. Credentials verified.' : 'Incorrect answer. Check the hash and try again.' };
    }
  };

  // Listen for challenge verification requests from DailyChallengePanel
  useEffect(() => {
    const handler = async (e: Event) => {
      const { type, userAnswer, correctAnswer, scenario, requestId } = (e as CustomEvent).detail;
      const result = await verifyAnswerWithAI(type, userAnswer, correctAnswer, scenario);
      window.dispatchEvent(new CustomEvent('challenge-verify-result', {
        detail: { requestId, ...result }
      }));
    };
    window.addEventListener('challenge-verify-request', handler);
    return () => window.removeEventListener('challenge-verify-request', handler);
  }, []);

  // Listen for generate-daily-challenge events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      generateChallenge(e.detail.type);
    };
    window.addEventListener('generate-daily-challenge', handler as EventListener);
    return () => window.removeEventListener('generate-daily-challenge', handler as EventListener);
  }, []);

  const sendMessage = (text: string, type: Message['type'], sender: Message['sender']) => {
    setIsTyping(true);
    const delay = Math.min(Math.max(text.length * 8, 400), 1200);
    
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        text, type, sender
      }]);
    }, delay);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    
    // Add user message to log
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      text: userMsg,
      type: 'normal',
      sender: 'Operator' as any
    }]);

    setIsTyping(true);
    const msgId = `stream-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: msgId,
      text: '',
      type: 'normal',
      sender: 'Advisor'
    }]);

    abortControllerRef.current = new AbortController();

    try {
      const fullPrompt = `User question: ${userMsg}`;
      
      await streamAIResponse(
        fullPrompt,
        (token) => {
          setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, text: m.text + token } : m
          ));
        },
        () => setIsTyping(false),
        (errMsg) => {
          setIsTyping(false);
          setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, text: errMsg, type: 'error', sender: 'System' } : m
          ));
        },
        abortControllerRef.current.signal
      );
    } catch (error: any) {
      console.error("AI Error:", error);
      setIsTyping(false);
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, text: 'I am unable to connect to my AI server at the moment. Please try again later.', type: 'error', sender: 'System' } : m
      ));
    }
  };

  const stopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTyping(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Helper to render markdown: bold, code, links (blue), and line breaks
  const renderText = (text: string) => {
    let html = text
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline font-medium">$1</a>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br />');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <aside className="bg-zinc-900 flex flex-col flex-1 min-h-0 overflow-hidden shrink-0 font-sans border-b border-zinc-800">
      {/* Mentor Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-950/20">
        <div className="w-8 h-8 rounded border border-zinc-800 flex items-center justify-center bg-zinc-950 text-zinc-400">
          <Cpu className="w-4 h-4 text-zinc-400" />
        </div>
        <div>
          <div className="font-mono text-xs font-bold text-zinc-200">Advisor Agent</div>
          <div className="text-[9px] font-mono flex items-center gap-1.5 text-zinc-500 uppercase tracking-wider mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
            Auditor Mode
          </div>
        </div>
      </div>
      
      {/* Dialogue List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar bg-zinc-950/10">
        {messages.map(msg => (
          <div key={msg.id} className={`
            p-3 rounded border text-xs font-mono
            ${msg.type === 'normal' ? 'bg-zinc-900/40 border-zinc-800 text-zinc-400' : ''}
            ${msg.type === 'hint' ? 'bg-amber-950/15 border-amber-900/60 text-amber-500' : ''}
            ${msg.type === 'success' ? 'bg-emerald-950/15 border-emerald-900/60 text-emerald-400' : ''}
            ${msg.type === 'error' ? 'bg-red-950/20 border-red-900/60 text-red-400' : ''}
          `}>
            <div className={`text-[9px] uppercase tracking-wider font-bold mb-1 opacity-80
              ${msg.type === 'normal' ? 'text-zinc-500' : ''}
              ${msg.type === 'hint' ? 'text-amber-600' : ''}
              ${msg.type === 'success' ? 'text-emerald-500' : ''}
              ${msg.type === 'error' ? 'text-red-500' : ''}
            `}>{msg.sender}</div>
            <div className="leading-relaxed font-mono">{renderText(msg.text)}</div>
          </div>
        ))}

        {isTyping && (
          <div className="p-3 rounded border bg-zinc-900 border-zinc-800 inline-block">
            <div className="text-[9px] font-mono uppercase tracking-wider font-bold mb-1 opacity-60 text-zinc-500">Advisor</div>
            <div className="typing-indicator flex items-center h-3">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input Area */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/40">
        <form onSubmit={handleChatSubmit} className="flex items-center gap-2 relative">
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={isTyping}
            placeholder={isTyping ? "Advisor is typing..." : "Ask the advisor a question..."}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 disabled:opacity-50 pr-16"
          />
          <div className="absolute right-3 flex items-center gap-1">
            {isTyping ? (
              <button 
                type="button" 
                onClick={stopGenerating}
                className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors flex items-center justify-center"
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={!chatInput.trim()}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </aside>
  );
}

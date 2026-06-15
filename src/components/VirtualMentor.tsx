"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useLab } from '@/context/LabContext';
import { useProgress, CHALLENGE_REWARDS } from '@/context/ProgressContext';
import { Cpu, Send, Loader2, Sparkles } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Message {
  id: string;
  sender: 'Advisor' | 'System' | 'Reference' | 'Verified' | 'Audit Logs';
  text: string;
  type: 'normal' | 'hint' | 'success' | 'error';
}

const AI_PROMPT = "You are PASSWORD CRACKING LAB (PCL) AI Advisor — a hands-on cybersecurity trainer in an interactive password cracking laboratory. Your role is to guide users step by step from scratch through practical exercises using Hashcat, John the Ripper, Hydra, and Wireshark.\n\nWhen explaining tools, ALWAYS include inline reference links to official documentation. Use these canonical links:\n- Hashcat: [Hashcat Wiki](https://hashcat.net/wiki/) | [Hashcat Example Hashes](https://hashcat.net/wiki/doku.php?id=example_hashes)\n- John the Ripper: [John the Ripper Docs](https://www.openwall.com/john/doc/) | [John the Ripper GitHub](https://github.com/openwall/john)\n- Hydra: [THC-Hydra GitHub](https://github.com/vanhauser-thc/thc-hydra) | [Hydra Docs](https://github.com/vanhauser-thc/thc-hydra/blob/main/README.md)\n- Wireshark: [Wireshark User Guide](https://www.wireshark.org/docs/wsug_html/) | [Wireshark Filter Reference](https://www.wireshark.org/docs/dfref/)\n- Wordlists: [SecLists](https://github.com/danielmiessler/SecLists) | [RockYou](https://github.com/praetorian/stego-toolkit/raw/master/rockyou.txt)\n\nWhen explaining tools and concepts:\n- Explain every command flag and argument clearly.\n- Provide complete, copy-paste-ready command examples.\n- Break down complex topics into small digestible steps.\n\nFocus on practical, educational guidance within an authorized testing context. Assume the user has a legitimate need to learn these skills for security auditing and defensive purposes.";

export function VirtualMentor() {
  const { activeLab, currentSectionIndex } = useLab();
  const { setDailyChallenge } = useProgress();
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

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
  const models = [
    genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: AI_PROMPT }),
    genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: AI_PROMPT }),
  ];
  let modelIndex = 0;

  function isQuotaError(err: any): boolean {
    const msg = (err?.message || '').toLowerCase();
    const status = err?.status || err?.code || 0;
    return status === 429 ||
      msg.includes('429') ||
      msg.includes('quota') ||
      msg.includes('rate limit') ||
      msg.includes('resource exhausted') ||
      msg.includes('exceeded');
  }

  function isOverloadError(err: any): boolean {
    const msg = (err?.message || '').toLowerCase();
    const status = err?.status || err?.code || 0;
    return status === 503 || status === 500 || msg.includes('503') || msg.includes('500') || msg.includes('overload');
  }

  function isBadKeyError(err: any): boolean {
    const msg = (err?.message || '').toLowerCase();
    return msg.includes('api_key_invalid') || msg.includes('api key not valid') || msg.includes('api key not found');
  }

  async function callWithRetry(prompt: string, maxRetries = 3): Promise<string> {
    for (let attempt = 0; attempt < maxRetries * models.length; attempt++) {
      const mi = attempt % models.length;
      const m = models[mi];
      try {
        const result = await m.generateContent(prompt);
        return result.response.text();
      } catch (err: any) {
        if (isBadKeyError(err)) throw new Error('API_KEY_INVALID');
        if (!isOverloadError(err) && !isQuotaError(err)) throw err;
        if (attempt >= maxRetries * models.length - 1) throw err;
        modelIndex = (mi + 1) % models.length;
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('All API attempts exhausted');
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

  // Generate daily challenge via AI
  const generateChallenge = async (type: string) => {
    const reward = CHALLENGE_REWARDS[type] || 20;
    const toolName = { hashcat: 'Hashcat', john: 'John the Ripper', hydra: 'Hydra', wireshark: 'Wireshark' }[type] || type;

    sendMessage(`Generating a unique ${toolName} challenge...`, 'normal', 'System');
    setIsTyping(true);

    try {
      const prompt = `Generate a unique, realistic ${toolName} password cracking challenge for a cybersecurity student. The reward for solving this is ${reward} coins.

Create a challenge that includes:
1. A realistic scenario (2-3 paragraphs describing the audit context)
2. Dummy credentials or a hash that needs to be cracked (use a REAL hash format, not a placeholder)
3. The correct answer (the plaintext password or credential — use a common real-world password)
4. 3 progressive hints — each hint must be a SPECIFIC ACTIONABLE STEP, not generic advice

IMPORTANT — Hint quality rules:
- Hint 1 (subtle): Tell the user EXACTLY what type of hash/credential they have and what tool to use. Include the specific file they need to create and the exact wordlist path.
- Hint 2 (moderate): Give the EXACT command to run with all parameters filled in using the actual data. Tell them what to look for in the output.
- Hint 3 (explicit): Give the EXACT command to show the cracked result. Tell them the format of the answer (e.g., "the part after the colon" or "the value after password=").

Format your response as follows:

## Challenge: [Title]

### Scenario
[realistic scenario text with context about the audit]

### Target Data
- [key]: [value]
- [key]: [value]

### Reference Documentation
Include links to relevant official documentation using markdown format like [Hashcat Wiki](https://hashcat.net/wiki/).

---CHALLENGE_ANSWER---
[the plaintext password / credential]
---CHALLENGE_DATA_START---
[{"label":"Hash / Target","value":"actual_hash_value"},{"label":"Username","value":"admin"}]
---CHALLENGE_DATA_END---
---HINTS_START---
Hint 1: specific actionable step|Hint 2: specific actionable step|Hint 3: specific actionable step
---HINTS_END---`;

      const text = await callWithRetry(prompt);

      // Parse answer
      const answerMatch = text.match(/---CHALLENGE_ANSWER---\n?([\s\S]*?)\n?---CHALLENGE_DATA_START---/);
      const correctAnswer = answerMatch ? answerMatch[1].trim() : '';

      // Parse dummy data
      const dataMatch = text.match(/---CHALLENGE_DATA_START---\n?([\s\S]*?)\n?---CHALLENGE_DATA_END---/);
      let dummyData: Array<{ label: string; value: string }> = [{ label: 'Target', value: '' }];
      if (dataMatch) {
        try { dummyData = JSON.parse(dataMatch[1].trim()); } catch {}
      }

      // Parse hints
      const hintsMatch = text.match(/---HINTS_START---\n?([\s\S]*?)\n?---HINTS_END---/);
      let hints = ['Review the target data carefully.', 'Try common wordlists like rockyou.txt.', 'Use rule-based attacks with best64.rule.'];
      if (hintsMatch) {
        hints = hintsMatch[1].split('|').map(h => h.trim()).filter(Boolean);
      }

      // Display text (remove tags)
      const displayText = text
        .replace(/---CHALLENGE_ANSWER---[\s\S]*?---CHALLENGE_DATA_START---/, '')
        .replace(/---CHALLENGE_DATA_START---[\s\S]*?---CHALLENGE_DATA_END---/, '')
        .replace(/---HINTS_START---[\s\S]*?---HINTS_END---/, '')
        .trim();

      const title = displayText.match(/## Challenge:\s*(.+)/)?.[1]?.trim() || `${toolName} Challenge`;
      const scenarioMatch = displayText.match(/### Scenario\s*([\s\S]*?)(?=### Target Data|### Reference|$)/);
      const scenario = scenarioMatch ? scenarioMatch[1].trim() : displayText;

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
        id: Date.now().toString(),
        text: displayText,
        type: 'normal',
        sender: 'Advisor'
      }]);

      window.dispatchEvent(new CustomEvent('daily-challenge-ready'));
    } catch (error: any) {
      console.error("Challenge generation failed:", error);
      const msg = isBadKeyError(error)
        ? 'API key is invalid. Set a valid `NEXT_PUBLIC_GEMINI_API_KEY` in `.env.local`. Get one at https://aistudio.google.com/apikey'
        : isQuotaError(error)
        ? 'Gemini API quota exceeded. The free tier has daily limits — wait until the quota resets or use a key with higher limits.'
        : isOverloadError(error)
        ? 'The AI service is temporarily overloaded. Please try generating the challenge again in a moment.'
        : 'Failed to generate challenge. Please try again later.';
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: msg,
        type: 'error',
        sender: 'System'
      }]);
      window.dispatchEvent(new CustomEvent('daily-challenge-ready'));
    } finally {
      setIsTyping(false);
    }
  };

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
        id: Date.now().toString(),
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
      id: Date.now().toString(),
      text: userMsg,
      type: 'normal',
      sender: 'Operator' as any
    }]);

    setIsTyping(true);

    try {
      const responseText = await callWithRetry(userMsg);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: responseText,
        type: 'normal',
        sender: 'Advisor'
      }]);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      const msg = isBadKeyError(error)
        ? 'API key is invalid. Set a valid `NEXT_PUBLIC_GEMINI_API_KEY` in `.env.local`. Get one at https://aistudio.google.com/apikey'
        : isQuotaError(error)
        ? 'Gemini API quota exceeded. The free tier has daily limits — wait until the quota resets or use a key with higher limits.'
        : isOverloadError(error)
        ? 'The AI service is temporarily overloaded. Please try your question again in a moment.'
        : 'I am unable to connect to my reasoning servers at the moment. Please try again later.';
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: msg,
        type: 'error',
        sender: 'System'
      }]);
    } finally {
      setIsTyping(false);
    }
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
            placeholder="Ask the advisor a question..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={isTyping || !chatInput.trim()}
            className="absolute right-2 text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors"
          >
            {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </aside>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import { useProgress, CHALLENGE_REWARDS } from '@/context/ProgressContext';
import { Shield, Zap, Flame, Radio, CheckCircle2, XCircle, HelpCircle, RefreshCw, Loader2, Trophy, Hash, BookOpen, Copy } from 'lucide-react';

const CHALLENGE_TYPES = [
  { id: 'hashcat', label: 'Hashcat', icon: Hash, desc: 'GPU-accelerated password cracking', color: 'text-purple-400 border-purple-900/50 bg-purple-950/20 hover:bg-purple-950/40' },
  { id: 'john', label: 'John the Ripper', icon: Zap, desc: 'CPU-based hash cracking', color: 'text-amber-400 border-amber-900/50 bg-amber-950/20 hover:bg-amber-950/40' },
  { id: 'hydra', label: 'Hydra', icon: Flame, desc: 'Online network brute-forcing', color: 'text-red-400 border-red-900/50 bg-red-950/20 hover:bg-red-950/40' },
  { id: 'wireshark', label: 'Wireshark / PCAP', icon: Radio, desc: 'Network traffic & credential sniffing', color: 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20 hover:bg-emerald-950/40' },
];

export function DailyChallengePanel({ onClose, inline }: { onClose: () => void; inline?: boolean }) {
  const { data, completeDailyChallenge, advanceHintInChallenge, getDailyChallenge } = useProgress();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; text: string } | null>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const isFirstChallenge = (data.challengesSolved || 0) === 0;

  // Auto-select first incompleted challenge on mount
  useEffect(() => {
    if (!selectedType) {
      const first = CHALLENGE_TYPES.find(ct => {
        const c = getDailyChallenge(ct.id);
        return c && !c.completed;
      }) || CHALLENGE_TYPES[0];
      setSelectedType(first.id);
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type) {
        setGenerating(prev => ({ ...prev, [detail.type]: false }));
      }
    };
    window.addEventListener('daily-challenge-ready', handler as EventListener);
    return () => window.removeEventListener('daily-challenge-ready', handler as EventListener);
  }, []);

  const getTypeChallenge = (type: string) => getDailyChallenge(type);

  const handleGenerate = (type: string) => {
    if (generating[type]) return;
    setGenerating(prev => ({ ...prev, [type]: true }));
    setSelectedType(type);
    setFeedback(prev => ({ ...prev, [type]: null }));
    setAnswers(prev => ({ ...prev, [type]: '' }));
    window.dispatchEvent(new CustomEvent('generate-daily-challenge', { detail: { type } }));
  };

  const handleVerify = (type: string) => {
    const dc = getTypeChallenge(type);
    if (!dc || dc.completed) return;
    
    const submittedRaw = (answers[type] || '').trim();
    if (!submittedRaw) return;

    const requestId = `verify_${type}_${Date.now()}`;
    setVerifying(prev => ({ ...prev, [type]: true }));
    setFeedback(prev => ({ ...prev, [type]: null }));

    // Listen for AI result
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.requestId !== requestId) return;
      window.removeEventListener('challenge-verify-result', handler);

      const isCorrect = !!detail.isCorrect;
      setFeedback(prev => ({
        ...prev,
        [type]: { ok: isCorrect, text: detail.feedback || (isCorrect ? 'Access granted. Credentials verified.' : 'Invalid response. Check the hash and try again.') }
      }));
      setVerifying(prev => ({ ...prev, [type]: false }));
      if (isCorrect) {
        completeDailyChallenge(type);
      }
    };
    window.addEventListener('challenge-verify-result', handler);

    // Dispatch verification request to VirtualMentor
    window.dispatchEvent(new CustomEvent('challenge-verify-request', {
      detail: {
        requestId,
        type,
        userAnswer: submittedRaw,
        correctAnswer: dc.correctAnswer,
        scenario: dc.scenario
      }
    }));
  };

  const handleBuyHint = async (type: string) => {
    const dc = getTypeChallenge(type);
    const free = isFirstChallenge && dc && !dc.completed && type === selectedType;
    const ok = await advanceHintInChallenge(type, free || undefined);
    if (!ok) setFeedback(prev => ({ ...prev, [type]: { ok: false, text: 'Insufficient coins or all hints already revealed.' } }));
    else setFeedback(prev => ({ ...prev, [type]: { ok: true, text: free ? 'Free hint unlocked!' : 'Hint unlocked.' } }));
  };

  const handleCopyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
    } catch {}
  };

  const dc = selectedType ? getTypeChallenge(selectedType) : null;
  const reward = dc ? dc.reward : 0;
  const hintCost = Math.floor(reward / 2);
  const firstChallengeFree = isFirstChallenge;

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-mono font-bold text-zinc-100 uppercase tracking-wider">Daily Challenge</h2>
            <p className="text-[10px] text-zinc-500 font-mono">All 4 tools available — resets daily at midnight</p>
          </div>
        </div>
        {!inline && (
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">

        {/* Tool Cards — always visible */}
        <div className="grid grid-cols-2 gap-3">
          {CHALLENGE_TYPES.map(ct => {
            const Icon = ct.icon;
            const challenge = getTypeChallenge(ct.id);
            const hasChallenge = challenge !== null;
            const isCompleted = hasChallenge && challenge!.completed;
            const isActive = selectedType === ct.id;
            const isGenerating = generating[ct.id];
            const canStart = !hasChallenge;

            return (
              <button
                key={ct.id}
                disabled={isGenerating}
                onClick={() => {
                  if (canStart) handleGenerate(ct.id);
                  else setSelectedType(ct.id);
                }}
                className={`relative flex items-start gap-3 p-4 rounded border text-left transition-all ${
                  isActive ? 'border-zinc-500 bg-zinc-800/60 ring-1 ring-zinc-600' :
                  isCompleted ? 'border-emerald-900/40 bg-emerald-950/10' :
                  hasChallenge ? ct.color :
                  'border-zinc-800 bg-zinc-950/30 hover:bg-zinc-900/60'
                }`}
              >
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${
                  isCompleted ? 'text-emerald-400' :
                  isActive ? 'text-zinc-200' :
                  ct.color.split(' ')[0]
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono font-bold text-zinc-200 flex items-center gap-2">
                    {ct.label}
                    {isGenerating && <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{ct.desc}</div>

                  {/* Status badge */}
                  <div className="mt-2">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/30">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Completed
                      </span>
                    ) : isGenerating ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-zinc-400">
                        Generating...
                      </span>
                    ) : hasChallenge ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-amber-400 bg-amber-950/20 px-2 py-0.5 rounded border border-amber-900/30">
                        In Progress — Click to open
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-amber-500">+{CHALLENGE_REWARDS[ct.id]} coins — Generate</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active challenge details */}
        {dc && !dc.completed && (
          <div className="space-y-5 border-t border-zinc-800 pt-5">
            {/* Type badge */}
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
              <span className={`px-2 py-0.5 rounded border font-bold ${
                dc.type === 'hashcat' ? 'text-purple-400 border-purple-900/50 bg-purple-950/20' :
                dc.type === 'john' ? 'text-amber-400 border-amber-900/50 bg-amber-950/20' :
                dc.type === 'hydra' ? 'text-red-400 border-red-900/50 bg-red-950/20' :
                'text-emerald-400 border-emerald-900/50 bg-emerald-950/20'
              }`}>{dc.type.toUpperCase()}</span>
              <span className="text-amber-500 font-bold">+{dc.reward} coins</span>
            </div>

            {/* Title */}
            <h3 className="text-base font-mono font-bold text-zinc-100">{dc.title}</h3>

            {/* Scenario */}
            <div className="text-xs font-sans text-zinc-400 leading-relaxed whitespace-pre-wrap">{dc.scenario}</div>

            {/* Dummy Data */}
            <div className="bg-zinc-950 border border-zinc-800 rounded p-4 space-y-2">
              <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Target Credentials / Data</div>
              {dc.dummyData.map((d, i) => (
                <div key={i} className="flex gap-3 font-mono text-xs">
                  <span className="text-zinc-500 shrink-0">{d.label}:</span>
                  <span className="text-zinc-200 break-all">{d.value}</span>
                </div>
              ))}
            </div>

            {/* AI Mentor note */}
            <div className="p-3 rounded border border-zinc-800 bg-zinc-950/40 text-[10px] font-mono text-zinc-500">
              Use the <span className="text-zinc-300">Advisor Agent</span> panel on the right for step-by-step guidance, command examples, and reference documentation links.
            </div>

            {/* Hints */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                  Hints ({dc.hintLevel}/{dc.hints.length} revealed)
                </span>
                {!dc.completed && dc.hintLevel < dc.hints.length && !firstChallengeFree && (
                  <span className="text-[10px] font-mono text-amber-500">Cost: {hintCost} coins per hint</span>
                )}
                {firstChallengeFree && dc.hintLevel < dc.hints.length && (
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">FREE — first challenge</span>
                )}
              </div>
              {dc.hints.slice(0, dc.hintLevel).map((hint, i) => (
                <div key={i} className="p-3 rounded border border-amber-900/40 bg-amber-950/10 text-xs font-mono text-amber-400/90">
                  <span className="text-[9px] uppercase font-bold text-amber-600">Hint {i + 1}:</span> {hint}
                </div>
              ))}
              {!dc.completed && (
                <button
                  onClick={() => handleBuyHint(selectedType!)}
                  disabled={dc.hintLevel >= dc.hints.length}
                  className="flex items-center gap-1.5 text-[10px] font-mono text-amber-500 hover:text-amber-400 border border-amber-900/50 bg-amber-950/20 px-3 py-1.5 rounded disabled:opacity-40 transition-colors"
                >
                  <HelpCircle className="w-3 h-3" />
                  {dc.hintLevel >= dc.hints.length ? 'All Hints Revealed'
                    : firstChallengeFree ? 'Reveal Next Hint (Free)'
                    : `Reveal Next Hint (${hintCost} coins)`}
                </button>
              )}
            </div>

            {/* Cracking Guide */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                <BookOpen className="w-3 h-3" /> Step-by-Step Cracking Guide
              </div>
              <div className="p-4 rounded border border-zinc-800 bg-zinc-950/40 text-[11px] font-mono text-zinc-400 space-y-3 leading-relaxed">
                {(() => {
                  const hashVal = dc.dummyData.find(d => d.label.toLowerCase().includes('hash') || d.label.toLowerCase().includes('target'))?.value || '';
                  const userVal = dc.dummyData.find(d => d.label.toLowerCase().includes('user') || d.label.toLowerCase().includes('login'))?.value || '';
                  const hostVal = dc.dummyData.find(d => d.label.toLowerCase().includes('host') || d.label.toLowerCase().includes('ip') || d.label.toLowerCase().includes('target') && !d.label.toLowerCase().includes('hash'))?.value || '';
                  const modeVal = dc.dummyData.find(d => d.label.toLowerCase().includes('mode'))?.value || '';
                  const formatVal = dc.dummyData.find(d => d.label.toLowerCase().includes('format'))?.value || '';

                  if (dc.type === 'hashcat') {
                    const mode = modeVal || '0';
                    return (<><div className="text-zinc-300 font-bold text-xs uppercase tracking-wider">hashcat — GPU Password Recovery</div>

                    <div><span className="text-amber-500">Step 1:</span> Save the hash to a file
                    <br/>Copy the hash value above and paste it into a new file called <code className="text-zinc-200 bg-zinc-900 px-1 rounded text-[10px]">hash.txt</code>
                    <br/><span className="text-zinc-500">Use the terminal on the right: run <code className="text-zinc-300 bg-zinc-900 px-1 rounded text-[10px]">echo '{hashVal}' &gt; hash.txt</code></span></div>

                    <div><span className="text-amber-500">Step 2:</span> Run hashcat with a wordlist
                    <br/>Run this command in the terminal:
                    <div className="bg-zinc-900 border border-zinc-800 rounded p-2 mt-1 text-[10px] text-zinc-200 flex items-center justify-between">
                      <span>hashcat -m {mode} -a 0 hash.txt rockyou.txt</span>
                      <button onClick={() => handleCopyCommand(`hashcat -m ${mode} -a 0 hash.txt rockyou.txt`)} className="text-zinc-500 hover:text-cyan-400 transition-colors shrink-0 ml-2"><Copy className="w-3 h-3" /></button>
                    </div>
                    <span className="text-zinc-500">• <code className="text-zinc-300">-m {mode}</code> = hash type (MD5, SHA1, NTLM, etc.)
                    <br/>• <code className="text-zinc-300">-a 0</code> = dictionary attack mode
                    <br/>• <code className="text-zinc-300">hash.txt</code> = your target hash file
                    <br/>• <code className="text-zinc-300">rockyou.txt</code> = common password wordlist</span></div>

                    <div><span className="text-amber-500">Step 3:</span> Wait for cracking to complete
                    <br/>hashcat will try every word in rockyou.txt against your hash.
                    <br/>Watch the <span className="text-zinc-300">Recovered</span> counter — when it reaches <span className="text-emerald-400">1/1</span>, the password is found.</div>

                    <div><span className="text-amber-500">Step 4:</span> Show the cracked password
                    <br/>Run this command to display the result:
                    <div className="bg-zinc-900 border border-zinc-800 rounded p-2 mt-1 text-[10px] text-zinc-200 flex items-center justify-between">
                      <span>hashcat -m {mode} --show hash.txt</span>
                      <button onClick={() => handleCopyCommand(`hashcat -m ${mode} --show hash.txt`)} className="text-zinc-500 hover:text-cyan-400 transition-colors shrink-0 ml-2"><Copy className="w-3 h-3" /></button>
                    </div>
                    <span className="text-zinc-500">Output format: <code className="text-zinc-300">hash:password</code>
                    <br/>Copy the password part and paste it in the answer field above.</span></div>

                    <div className="pt-1 text-zinc-500 text-[10px]">Reference: <a href="https://hashcat.net/wiki/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">hashcat Wiki</a></div></>);
                  }

                  if (dc.type === 'john') {
                    const format = formatVal || 'raw-md5';
                    return (<><div className="text-zinc-300 font-bold text-xs uppercase tracking-wider">John the Ripper — CPU Password Recovery</div>

                    <div><span className="text-amber-500">Step 1:</span> Save the hash to a file
                    <br/>Copy the hash and save it as <code className="text-zinc-200 bg-zinc-900 px-1 rounded text-[10px]">hash.txt</code>
                    <br/><span className="text-zinc-500">Use: <code className="text-zinc-300 bg-zinc-900 px-1 rounded text-[10px]">echo '{hashVal}' &gt; hash.txt</code></span></div>

                    <div><span className="text-amber-500">Step 2:</span> Run John with a wordlist
                    <div className="bg-zinc-900 border border-zinc-800 rounded p-2 mt-1 text-[10px] text-zinc-200 flex items-center justify-between">
                      <span>john --wordlist=rockyou.txt hash.txt</span>
                      <button onClick={() => handleCopyCommand('john --wordlist=rockyou.txt hash.txt')} className="text-zinc-500 hover:text-cyan-400 transition-colors shrink-0 ml-2"><Copy className="w-3 h-3" /></button>
                    </div>
                    <span className="text-zinc-500">• <code className="text-zinc-300">--wordlist=rockyou.txt</code> = dictionary file
                    <br/>• John auto-detects the hash format</span></div>

                    <div><span className="text-amber-500">Step 3:</span> Show cracked passwords
                    <div className="bg-zinc-900 border border-zinc-800 rounded p-2 mt-1 text-[10px] text-zinc-200 flex items-center justify-between">
                      <span>john --show hash.txt</span>
                      <button onClick={() => handleCopyCommand('john --show hash.txt')} className="text-zinc-500 hover:text-cyan-400 transition-colors shrink-0 ml-2"><Copy className="w-3 h-3" /></button>
                    </div>
                    <span className="text-zinc-500">If the format is wrong, try: <code className="text-zinc-300">john --format={format} --wordlist=rockyou.txt hash.txt</code></span></div>

                    <div className="pt-1 text-zinc-500 text-[10px]">Reference: <a href="https://www.openwall.com/john/doc/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">John the Ripper docs</a></div></>);
                  }

                  if (dc.type === 'hydra') {
                    const host = hostVal || '192.168.1.100';
                    const user = userVal || 'admin';
                    return (<><div className="text-zinc-300 font-bold text-xs uppercase tracking-wider">Hydra — Online Network Brute-Forcing</div>

                    <div><span className="text-amber-500">Step 1:</span> Identify the target service
                    <br/>Target host: <code className="text-zinc-200 bg-zinc-900 px-1 rounded text-[10px]">{host}</code>
                    <br/>Target username: <code className="text-zinc-200 bg-zinc-900 px-1 rounded text-[10px]">{user}</code>
                    <br/>Common services: ssh (port 22), ftp (21), rdp (3389), http-post (80)</div>

                    <div><span className="text-amber-500">Step 2:</span> Run Hydra
                    <div className="bg-zinc-900 border border-zinc-800 rounded p-2 mt-1 text-[10px] text-zinc-200 flex items-center justify-between">
                      <span>hydra -l {user} -P rockyou.txt ssh://{host}</span>
                      <button onClick={() => handleCopyCommand(`hydra -l ${user} -P rockyou.txt ssh://${host}`)} className="text-zinc-500 hover:text-cyan-400 transition-colors shrink-0 ml-2"><Copy className="w-3 h-3" /></button>
                    </div>
                    <span className="text-zinc-500">• <code className="text-zinc-300">-l {user}</code> = single username to try
                    <br/>• <code className="text-zinc-300">-P rockyou.txt</code> = password wordlist
                    <br/>• <code className="text-zinc-300">ssh://{host}</code> = target service &amp; address
                    <br/>Try different services: <code className="text-zinc-300">ftp://{host}</code>, <code className="text-zinc-300">rdp://{host}</code></span></div>

                    <div><span className="text-amber-500">Step 3:</span> Read the results
                    <br/>Hydra will output lines like:
                    <br/><code className="text-zinc-300 text-[10px]">[22][ssh] host: {host} login: {user} password: FOUND_PASSWORD</code>
                    <br/>The password after <code className="text-zinc-300">password:</code> is your answer.</div>

                    <div className="pt-1 text-zinc-500 text-[10px]">Reference: <a href="https://github.com/vanhauser-thc/thc-hydra" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Hydra GitHub</a></div></>);
                  }

                  if (dc.type === 'wireshark') {
                    const targetVal = dc.dummyData.find(d => d.label.toLowerCase().includes('file') || d.label.toLowerCase().includes('pcap'))?.value || 'capture.pcap';
                    return (<><div className="text-zinc-300 font-bold text-xs uppercase tracking-wider">Wireshark / tshark — Network Traffic Analysis</div>

                    <div><span className="text-amber-500">Step 1:</span> Inspect the PCAP file
                    <br/>Run tshark to list all packets:
                    <div className="bg-zinc-900 border border-zinc-800 rounded p-2 mt-1 text-[10px] text-zinc-200 flex items-center justify-between">
                      <span>tshark -r {targetVal}</span>
                      <button onClick={() => handleCopyCommand(`tshark -r ${targetVal}`)} className="text-zinc-500 hover:text-cyan-400 transition-colors shrink-0 ml-2"><Copy className="w-3 h-3" /></button>
                    </div>
                    <span className="text-zinc-500">This shows all packets. Look for protocols like HTTP, FTP, or Telnet (plaintext credentials).</span></div>

                    <div><span className="text-amber-500">Step 2:</span> Filter for login traffic
                    <br/>Look for POST requests or login pages:
                    <div className="bg-zinc-900 border border-zinc-800 rounded p-2 mt-1 text-[10px] text-zinc-200 flex items-center justify-between">
                      <span>tshark -r {targetVal} -Y "http.request.method == POST"</span>
                      <button onClick={() => handleCopyCommand(`tshark -r ${targetVal} -Y "http.request.method == POST"`)} className="text-zinc-500 hover:text-cyan-400 transition-colors shrink-0 ml-2"><Copy className="w-3 h-3" /></button>
                    </div>
                    <span className="text-zinc-500">Also try: <code className="text-zinc-300">tshark -r {targetVal} -Y "ftp"</code> or <code className="text-zinc-300">-Y "telnet"</code></span></div>

                    <div><span className="text-amber-500">Step 3:</span> Extract the credential data
                    <br/>To see the actual form data submitted:
                    <div className="bg-zinc-900 border border-zinc-800 rounded p-2 mt-1 text-[10px] text-zinc-200 flex items-center justify-between">
                      <span>tshark -r {targetVal} -Y "http.request.method == POST" -T fields -e http.file_data</span>
                      <button onClick={() => handleCopyCommand(`tshark -r ${targetVal} -Y "http.request.method == POST" -T fields -e http.file_data`)} className="text-zinc-500 hover:text-cyan-400 transition-colors shrink-0 ml-2"><Copy className="w-3 h-3" /></button>
                    </div>
                    <span className="text-zinc-500">Look for patterns like <code className="text-zinc-300">username=admin&amp;password=secret123</code></span></div>

                    <div><span className="text-amber-500">Step 4:</span> Submit the found credential
                    <br/>The password is the value after <code className="text-zinc-300">password=</code> or equivalent field.</div>

                    <div className="pt-1 text-zinc-500 text-[10px]">Reference: <a href="https://www.wireshark.org/docs/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Wireshark docs</a></div></>);
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Answer Input */}
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Submit Found Credential</div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={answers[selectedType!] || ''}
                  onChange={e => { setAnswers(prev => ({ ...prev, [selectedType!]: e.target.value })); setFeedback(prev => ({ ...prev, [selectedType!]: null })); }}
                  onKeyDown={e => e.key === 'Enter' && handleVerify(selectedType!)}
                  placeholder="Enter the cracked password / credential..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 outline-none"
                />
                <button
                  onClick={() => handleVerify(selectedType!)}
                  disabled={verifying[selectedType!] || !answers[selectedType!]?.trim()}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs px-5 py-2 rounded font-mono transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {verifying[selectedType!] ? <><Loader2 className="w-3 h-3 animate-spin" /> Verifying...</> : 'Verify'}
                </button>
              </div>
              <p className="text-[10.5px] text-zinc-500 font-mono leading-normal mt-1 bg-zinc-950/30 p-2 rounded border border-zinc-900">
                <strong>Format Guide:</strong> Submit the cracked plaintext password. You can also submit in <code>hash:password</code> format — AI will extract the password.
                <br />
                <span className="text-[9.5px] text-zinc-600">Answers accepted in any language. AI validates your response.</span>
              </p>
            </div>

            {/* Feedback */}
            {feedback[selectedType!] && (
              <div className={`p-3 rounded border text-xs font-mono flex items-start gap-2 ${
                feedback[selectedType!]!.ok
                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400'
                  : 'bg-red-950/20 border-red-900/50 text-red-400'
              }`}>
                {feedback[selectedType!]!.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                {feedback[selectedType!]!.text}
              </div>
            )}
          </div>
        )}

        {/* Completed state for the selected challenge */}
        {dc && dc.completed && (
          <div className="p-4 rounded border border-emerald-900/40 bg-emerald-950/10 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-sm font-mono font-bold text-emerald-400">Challenge Complete</div>
            <div className="text-[11px] font-mono text-zinc-500 mt-1">+{dc.reward} coins awarded</div>
            <div className="text-[10px] font-mono text-zinc-600 mt-3">
              Try another tool above — all 4 refresh daily at midnight.
            </div>
          </div>
        )}

      </div>
    </>
  );

  if (inline) {
    return (
      <div className="w-full h-full bg-zinc-950 flex flex-col overflow-hidden">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {content}
      </div>
    </div>
  );
}

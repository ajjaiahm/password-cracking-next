"use client";

import React, { useState, useEffect } from 'react';
import { useLab } from '@/context/LabContext';
import { useProgress } from '@/context/ProgressContext';
import { LAB_DATA } from '@/data/labs';
import toast from 'react-hot-toast';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DailyChallengePanel } from './DailyChallengePanel';
import { 
  BookOpen, 
  Cpu, 
  Globe, 
  Shield, 
  Search, 
  FileText, 
  Terminal, 
  ShieldAlert, 
  Award, 
  Lock, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Download,
  ClipboardCheck,
  X as XIcon,
  Loader2
} from 'lucide-react';

// ── Assessment Question Type & Data ──
interface AssessmentQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

const ASSESSMENTS: Record<string, AssessmentQuestion[]> = {
  'auth-principles': [
    {
      question: 'What is the primary difference between Authentication (AuthN) and Authorization (AuthZ)?',
      options: [
        'Authentication verifies identity; Authorization determines access permissions',
        'Authentication determines access; Authorization verifies identity',
        'Both are the same process with different names',
        'Neither involves verifying credentials'
      ],
      correct: 0,
      explanation: 'Authentication (AuthN) confirms WHO you are by validating credentials like passwords or biometrics. Authorization (AuthZ) determines WHAT you are allowed to do by checking access control policies after identity is confirmed. They are sequential — AuthN always comes before AuthZ.'
    },
    {
      question: 'Why is "P@ssw0rd1!" considered insecure by professional security auditors?',
      options: [
        'It has too many characters making it overflow hash buffers',
        'Character substitution rules (@ for a, 0 for o) are preprogrammed into modern cracking tools',
        'It lacks any uppercase letters which weakens its entropy',
        'Special characters cannot be stored by modern hash algorithms'
      ],
      correct: 1,
      explanation: 'Modern cracking tools include "leet speak" substitution dictionaries by default (@ → a, 0 → o, 3 → e, ! → i). Tools like Hashcat and John the Ripper apply these rules automatically in "rule-based attacks", making passwords like P@ssw0rd trivial to crack despite appearing complex to humans.'
    },
    {
      question: 'What makes passphrases more secure than traditional complex passwords?',
      options: [
        'They use special characters exclusively instead of letters',
        'They are shorter and easier to process by hashing algorithms',
        'Their length provides exponentially larger character space, resisting brute-force attacks',
        'They can only be used with Argon2id, which is inherently more secure'
      ],
      correct: 2,
      explanation: 'Passphrases like "correct horse battery staple" derive their strength from LENGTH (high entropy). Each additional word multiplies the search space exponentially. A 4-word passphrase has approximately 44 bits of entropy, while a typical "complex" 8-character password has only about 28 bits — making the passphrase roughly 65,000 times harder to brute-force.'
    }
  ],
  'hashing-algorithms': [
    {
      question: 'What does "deterministic" mean in the context of cryptographic hash functions?',
      options: [
        'The hash output is always random and unpredictable',
        'The same input ALWAYS produces the exact same hash output',
        'The hash can be reversed back to the original input',
        'Each execution uses a different algorithm internally'
      ],
      correct: 1,
      explanation: 'Deterministic means the hash function produces the same output for identical inputs every single time. This is fundamental — if SHA-256 hashes "Password123" today, it will produce the exact same 256-bit digest tomorrow, on any machine, in any environment. This property enables password verification: store the hash, compare on login.'
    },
    {
      question: 'Why is SHA-256 considered unsafe for password storage despite being cryptographically strong?',
      options: [
        'SHA-256 has known collision vulnerabilities like MD5',
        'SHA-256 executes too slowly for real-time verification',
        'Modern GPUs can compute billions of SHA-256 hashes per second, enabling rapid brute-force',
        'SHA-256 cannot process passwords longer than 8 characters'
      ],
      correct: 2,
      explanation: 'SHA-256 was designed for data INTEGRITY verification (checksums, digital signatures), not password storage. It is intentionally FAST — a single modern GPU (e.g., RTX 4090) can compute ~8.5 billion SHA-256 hashes per second. This speed allows attackers to try entire dictionaries in seconds. Password hashing requires intentional SLOWNESS (Argon2id, bcrypt).'
    },
    {
      question: 'What is the key advantage of memory-hard algorithms like Argon2id over bcrypt?',
      options: [
        'Argon2id produces shorter hash outputs saving storage space',
        'Argon2id forces each guess to consume significant RAM, neutralizing GPU parallel cores',
        'Argon2id uses symmetric encryption instead of hashing',
        'Argon2id does not require a salt value'
      ],
      correct: 1,
      explanation: 'GPUs have thousands of small cores optimized for parallel computation but limited per-core memory. Argon2id forces each password guess to allocate a configurable amount of RAM (e.g., 64MB). A GPU with 10,000 cores but only 24GB VRAM can only run ~375 parallel guesses instead of billions — reducing attack throughput by orders of magnitude.'
    }
  ],
  'profiling-lab': [
    {
      question: 'A hash string is 32 hexadecimal characters long. Which algorithm families does this match?',
      options: [
        'SHA-256, SHA-512',
        'MD5, MD4, NTLM',
        'bcrypt, scrypt',
        'Argon2id, PBKDF2'
      ],
      correct: 1,
      explanation: '32 hex characters = 128 bits. This signature matches MD5 (mode 0), MD4 (mode 900), and NTLM (mode 1000). SHA-256 produces 64 hex chars (256 bits), SHA-512 produces 128 hex chars (512 bits). bcrypt/Argon2id use custom encoding formats with embedded parameters, not raw hex.'
    },
    {
      question: 'What is the purpose of tools like CUPP (Common User Passwords Profiler)?',
      options: [
        'To decrypt encrypted files directly',
        'To generate target-specific password dictionaries using personal information',
        'To identify the algorithm used to create a hash',
        'To scan network services for open ports'
      ],
      correct: 1,
      explanation: 'CUPP profiles a target individual by combining personal data (name, birthdate, spouse, pet names) into likely password candidates. For example, if the target is "John Doe, born 1990", CUPP generates combinations like John1990, Doe1990!, JohnDoe90. This exploits the fact that ~65% of people use personal information in passwords.'
    },
    {
      question: 'Why should you use both HashID and Name-That-Hash to identify an unknown hash?',
      options: [
        'They use completely different databases that never overlap',
        'Cross-referencing multiple tools increases identification confidence and provides Hashcat/John mode numbers',
        'One tool is for Linux and the other for Windows only',
        'They are required to run sequentially by cybersecurity law'
      ],
      correct: 1,
      explanation: 'Hash identification is probabilistic, not deterministic — multiple algorithms can produce similar-looking outputs. Cross-referencing HashID with Name-That-Hash (NTH) increases confidence. NTH additionally provides confidence percentages and maps both Hashcat mode numbers AND John the Ripper format strings, saving time during the cracking phase.'
    }
  ],
  'offline-cracking-lab': [
    {
      question: 'What is the primary difference between a dictionary attack and a brute-force attack?',
      options: [
        'Dictionary attacks use GPU; brute-force uses CPU only',
        'Dictionary attacks try words from a wordlist; brute-force tries ALL possible character combinations',
        'Brute-force is always faster than dictionary attacks',
        'Dictionary attacks can only crack MD5 hashes'
      ],
      correct: 1,
      explanation: 'A dictionary attack tests passwords from a pre-compiled wordlist (e.g., rockyou.txt with 14M passwords). It is fast but limited to known passwords. A brute-force (incremental) attack systematically tries EVERY possible combination of characters up to a given length. It is thorough but exponentially slower — a 6-character alphanumeric brute-force tests 2.18 billion combinations.'
    },
    {
      question: 'What does a "rule-based attack" add to a standard dictionary attack?',
      options: [
        'It encrypts the dictionary file before using it',
        'It applies transformations like appending numbers, capitalizing, or substituting characters to each dictionary word',
        'It limits the attack to only 100 guesses per second',
        'It converts the dictionary into a binary format for faster processing'
      ],
      correct: 1,
      explanation: 'Rule-based attacks apply systematic mutations to each dictionary word: capitalize first letter (password → Password), append digits (password → password123), leet substitution (password → p@ssw0rd), reverse (password → drowssap). John\'s --rules flag applies thousands of these transformations, dramatically expanding coverage without a larger wordlist.'
    },
    {
      question: 'Why does Hashcat typically outperform John the Ripper in raw cracking speed?',
      options: [
        'Hashcat uses a more advanced hashing algorithm',
        'Hashcat leverages GPU parallel processing cores for acceleration',
        'John the Ripper can only process one hash at a time',
        'Hashcat skips weak hashes automatically'
      ],
      correct: 1,
      explanation: 'Hashcat is GPU-accelerated — it distributes hash calculations across thousands of GPU cores (e.g., an RTX 4090 has 16,384 CUDA cores). John the Ripper primarily uses CPU cores (typically 4-16). For fast algorithms like MD5, Hashcat can achieve billions of hashes/second vs. John\'s millions. However, John excels in flexibility, format support, and rule processing.'
    }
  ],
  'online-bruteforcing-lab': [
    {
      question: 'Why are online brute-force attacks significantly slower than offline attacks?',
      options: [
        'Online tools use weaker algorithms for testing',
        'Each guess requires a network round-trip, and services may impose rate-limiting or account lockout',
        'Online attacks can only test alphabetic characters',
        'The target server provides the correct password after 100 attempts'
      ],
      correct: 1,
      explanation: 'Online attacks send each guess over the network to a live service. Each attempt incurs: TCP handshake (~50ms), TLS negotiation (~100ms), application processing (~50ms), and response transmission (~50ms). That is ~250ms per attempt vs. nanoseconds offline. Additionally, services implement rate-limiting (e.g., 5 attempts then 30-second lockout), fail2ban rules, and CAPTCHA challenges.'
    },
    {
      question: 'In the Hydra command "hydra -l admin -P pass.txt ftp://192.168.1.100", what does the -P flag specify?',
      options: [
        'The target port number',
        'The protocol to use for the attack',
        'The path to a password dictionary file',
        'The parallelism level (number of threads)'
      ],
      correct: 2,
      explanation: 'In Hydra: -l (lowercase) specifies a SINGLE username, -L (uppercase) specifies a username LIST file. Similarly, -p (lowercase) specifies a SINGLE password, -P (uppercase) specifies a password LIST file. The convention is: lowercase = single value, UPPERCASE = file containing multiple values. The target URL format specifies the protocol (ftp://).'
    },
    {
      question: 'What is the purpose of using multiple online tools (Hydra, Medusa, Ncrack) for the same target?',
      options: [
        'Each tool is legally required for different countries',
        'Different tools handle different protocols better and have varying timing/evasion capabilities',
        'Only one tool can crack FTP; others are for SSH only',
        'Using multiple tools simultaneously makes the attack faster'
      ],
      correct: 1,
      explanation: 'Each tool has strengths: Hydra supports 50+ protocols and is fastest for common services. Medusa uses modular architecture with thread-based parallelism. Ncrack offers Nmap-style timing templates (-T0 to -T5) for stealth/speed control. In real audits, if one tool fails due to protocol handling, another may succeed. Redundancy increases audit coverage.'
    }
  ],
  'pcap-analysis-lab': [
    {
      question: 'Why can credentials be extracted from HTTP traffic but not HTTPS traffic in a PCAP capture?',
      options: [
        'HTTPS uses a different port number that tcpdump cannot capture',
        'HTTP transmits data in plaintext; HTTPS encrypts all data with TLS, making content unreadable',
        'HTTPS passwords are stored in cookies which are not captured',
        'HTTP is faster than HTTPS so more packets are captured'
      ],
      correct: 1,
      explanation: 'HTTP transmits all data (including form fields, cookies, and Basic Auth headers) in plaintext ASCII — visible to anyone capturing packets on the network segment. HTTPS wraps the same HTTP data inside a TLS encrypted tunnel. Without the server\'s private key, captured HTTPS packets appear as random binary data. This is why HTTPS is mandatory for any login form.'
    },
    {
      question: 'What does the TShark filter "http.request.method == POST" isolate?',
      options: [
        'All DNS query packets in the capture',
        'HTTP POST requests, which commonly carry form-submitted credentials',
        'All outgoing TCP SYN packets',
        'Encrypted HTTPS session data'
      ],
      correct: 1,
      explanation: 'HTTP POST is the method used to submit form data (login forms, search queries, file uploads). When a user types their username/password into a website and clicks "Login", the browser sends a POST request with the credentials in the request body. Filtering for POST isolates these credential-bearing packets from the noise of GET requests, images, and scripts.'
    },
    {
      question: 'A captured HTTP header shows "Authorization: Basic YWRtaW46c2VjcjN0". What encoding is this?',
      options: [
        'AES-256 encryption that cannot be decoded',
        'Base64 encoding which can be trivially decoded to reveal plaintext credentials',
        'SHA-256 hash of the password',
        'ROT13 cipher used for obfuscation'
      ],
      correct: 1,
      explanation: 'HTTP Basic Authentication encodes credentials as Base64(username:password). Base64 is NOT encryption — it is a reversible encoding scheme. Decoding "YWRtaW46c2VjcjN0" instantly reveals "admin:secr3t". Any network sniffer can decode this in real-time. This is why Basic Auth over plain HTTP is considered critically insecure — it is equivalent to transmitting passwords in cleartext.'
    }
  ]
};

// ── Assessment Modal Component ──
function AssessmentModal({ 
  questions, 
  onComplete, 
  onClose 
}: { 
  questions: AssessmentQuestion[]; 
  onComplete: () => void; 
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const handleAnswer = (qIdx: number, optIdx: number) => {
    if (revealed[qIdx]) return; // Already answered
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
    setRevealed(prev => ({ ...prev, [qIdx]: true }));
  };

  const allAnswered = Object.keys(revealed).length === questions.length;
  const correctCount = questions.filter((q, i) => answers[i] === q.correct).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-5 h-5 text-zinc-300" />
            <div>
              <h2 className="text-sm font-mono font-bold text-zinc-100 uppercase tracking-wider">Module Assessment</h2>
              <p className="text-[10px] text-zinc-500 font-mono">Answer all questions to unlock module completion</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Questions */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {questions.map((q, qIdx) => {
            const isRevealed = revealed[qIdx];
            const userAnswer = answers[qIdx];
            const isCorrect = userAnswer === q.correct;

            return (
              <div key={qIdx} className="space-y-3">
                <p className="text-xs font-mono font-bold text-zinc-200">
                  <span className="text-zinc-500 mr-2">[Q{qIdx + 1}/{questions.length}]</span>
                  {q.question}
                </p>
                
                <div className="space-y-2">
                  {q.options.map((opt, oIdx) => {
                    let btnClass = "w-full text-left px-4 py-3 text-xs rounded border font-mono transition-all duration-300 ";
                    
                    if (isRevealed) {
                      if (oIdx === q.correct) {
                        btnClass += "bg-emerald-950/40 border-emerald-700/60 text-emerald-300 font-medium";
                      } else if (oIdx === userAnswer && oIdx !== q.correct) {
                        btnClass += "bg-red-950/40 border-red-800/60 text-red-400";
                      } else {
                        btnClass += "bg-zinc-950/30 border-zinc-900 text-zinc-600";
                      }
                    } else {
                      btnClass += "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer";
                    }

                    return (
                      <button 
                        key={oIdx}
                        disabled={isRevealed}
                        onClick={() => handleAnswer(qIdx, oIdx)}
                        className={btnClass}
                      >
                        <span className="text-zinc-500 mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation (shown after answering) */}
                {isRevealed && (
                  <div className={`p-4 rounded border text-xs font-sans leading-relaxed mt-2 ${
                    isCorrect 
                      ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300/90' 
                      : 'bg-amber-950/20 border-amber-900/40 text-amber-300/90'
                  }`}>
                    <div className="flex items-center gap-2 mb-2 font-mono font-bold text-[10px] uppercase tracking-wider">
                      {isCorrect ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Correct</>
                      ) : (
                        <><AlertCircle className="w-3.5 h-3.5" /> Incorrect — Correct Answer: {String.fromCharCode(65 + q.correct)}</>
                      )}
                    </div>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500">
            {allAnswered ? `Score: ${correctCount}/${questions.length}` : `Answered: ${Object.keys(revealed).length}/${questions.length}`}
          </span>
          {allAnswered && (
            <button 
              onClick={onComplete}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold px-6 py-2.5 rounded transition-colors font-mono uppercase tracking-wider"
            >
              Complete Assessment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main LabViewer Component ──
export function LabViewer({ showDailyChallenge, onCloseDailyChallenge }: { showDailyChallenge?: boolean; onCloseDailyChallenge?: () => void }) {
  const { activeTrackId, activeLab, currentSectionIndex, nextSection, prevSection, jumpToSection, setExpectedContext, loadNextLab } = useLab();
  const { isSectionCompleted, completeSection, addXp, addCoins, deductCoins, completeLab, data: progressData } = useProgress();

  const [challengeInputs, setChallengeInputs] = useState<Record<number, string>>({});
  const [challengeFeedback, setChallengeFeedback] = useState<Record<number, { isCorrect: boolean, text: string }>>({});
  const [purchasedHints, setPurchasedHints] = useState<Record<number, boolean>>({});
  const [quizSelections, setQuizSelections] = useState<Record<number, Record<number, number>>>({}); // sectionIdx -> questionIdx -> optionIdx
  const [quizResults, setQuizResults] = useState<Record<number, boolean>>({});
  const [assessmentPassed, setAssessmentPassed] = useState<Record<string, boolean>>({});
  const [showAssessment, setShowAssessment] = useState(false);
  const [validatingChallenge, setValidatingChallenge] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!activeLab) return;
    const section = activeLab.sections[currentSectionIndex];
    if (section?.type === 'command') {
      setExpectedContext(section.command || '', section);
    } else {
      setExpectedContext('', null);
    }
  }, [currentSectionIndex, activeLab, setExpectedContext]);

  // Resolve track icons dynamically
  const renderTrackIcon = (iconName: string) => {
    const cls = "w-5 h-5 text-zinc-400 mb-2";
    switch (iconName) {
      case 'BookOpen':    return <BookOpen className={cls} />;
      case 'Cpu':         return <Cpu className={cls} />;
      case 'Globe':       return <Globe className={cls} />;
      case 'Search':      return <Search className={cls} />;
      case 'Terminal':    return <Terminal className={cls} />;
      case 'ShieldAlert': return <ShieldAlert className={cls} />;
      default:            return <Shield className={cls} />;
    }
  };

  // Resolve badge icons dynamically
  const renderBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Search':
        return <Search className="w-8 h-8 text-zinc-300" />;
      case 'FileText':
        return <FileText className="w-8 h-8 text-zinc-300" />;
      case 'Terminal':
        return <Terminal className="w-8 h-8 text-zinc-300" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-8 h-8 text-zinc-300" />;
      default:
        return <Award className="w-8 h-8 text-zinc-300" />;
    }
  };

  if (showDailyChallenge) {
    return <DailyChallengePanel onClose={onCloseDailyChallenge!} inline />;
  }

  if (!activeLab) {
    return (
      <div className="flex-1 h-full p-8 overflow-y-auto bg-zinc-950 text-zinc-100 custom-scrollbar">
        <div className="max-w-4xl mx-auto text-center mt-16 font-sans">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded border border-zinc-800 flex items-center justify-center bg-zinc-900/60">
              <Shield className="w-6 h-6 text-zinc-400" />
            </div>
          </div>
          <h1 className="text-xl font-mono font-bold mb-2 tracking-[0.2em] uppercase text-zinc-100">PASSWORD CRACKING LAB</h1>
          <p className="text-xs font-mono text-zinc-500 mb-12 uppercase tracking-wider">Educational Simulation Sandbox Environment</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {LAB_DATA.map(track => (
              <div key={track.id} className="glass-card p-6 rounded hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  {renderTrackIcon(track.icon)}
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Active</span>
                </div>
                <h3 className="text-sm font-mono font-bold text-zinc-200 mb-2">{track.name}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{track.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const handleCopyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      toast.success('Command copied to clipboard');
    } catch {
      toast.error('Failed to copy command');
    }
  };


  const validateAnswerWithAI = async (
    question: string, 
    acceptableAnswers: string[], 
    userAnswer: string
  ): Promise<{ isCorrect: boolean; feedback: string }> => {
    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const prompt = `You are an AI cybersecurity expert and grading assistant for an interactive password cracking laboratory.
The student has submitted an answer to the following question or challenge.

[Challenge/Question]: "${question}"
[Correct Answer Benchmarks/Examples]: ${JSON.stringify(acceptableAnswers)}
[Student's Submission]: "${userAnswer}"

Please analyze and grade the student's submission.
Note that the student might write their response in their own native language (e.g. Spanish, German, Hindi, French, Russian, Chinese, etc.). If so, translate it to assess the conceptual correctness.
Also note that they might express the correct answer/command slightly differently (e.g., using different flags or writing a sentence explaining the concept).

Guidelines:
1. If the challenge asks for a command, check if the student's command is semantically equivalent and achieves the exact same output/goal (e.g. check tool name and key flags).
2. If the challenge asks a conceptual question (e.g., about memory-hardness), verify if they explained the concept correctly, even if they used their own words or a different language.
3. Be encouraging and provide detailed feedback.

Generate a JSON response matching this exact structure:
{
  "isCorrect": true or false,
  "feedback": "A concise explanation (in the user's language if they wrote in another language, otherwise in English) acknowledging their approach and confirming why they are correct or guiding them if incorrect."
}

Do not include any formatting other than the raw JSON string. Do not wrap in markdown \`\`\`json blocks.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanText = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleanText);
      return {
        isCorrect: !!parsed.isCorrect,
        feedback: parsed.feedback || 'Validation completed.'
      };
    } catch (error) {
      console.error("AI validation failed, falling back to local validation:", error);
      const cleanUser = userAnswer.toLowerCase().trim();
      const isCorrect = acceptableAnswers.some(ans => {
        const cleanAns = ans.toLowerCase().trim();
        return cleanUser.includes(cleanAns) || cleanAns.includes(cleanUser);
      });
      return {
        isCorrect,
        feedback: isCorrect 
          ? "Verification successful. The signature matches our database logs." 
          : "Verification failed. The signature doesn't match expected values. Please review parameters and retry."
      };
    }
  };

  const submitChallenge = async (sectionIdx: number, section: any) => {
    const answer = challengeInputs[sectionIdx]?.trim() || '';
    if (!answer || validatingChallenge[sectionIdx]) return;

    setValidatingChallenge(prev => ({ ...prev, [sectionIdx]: true }));

    try {
      const result = await validateAnswerWithAI(section.description || section.title, section.acceptableAnswers, answer);
      const isCorrect = result.isCorrect;
      const feedbackText = isCorrect 
        ? (section.successMessage || result.feedback) 
        : (section.failureMessage || result.feedback);

      setChallengeFeedback(prev => ({ 
        ...prev, 
        [sectionIdx]: { isCorrect, text: feedbackText } 
      }));
      
      const event = new CustomEvent('mentor-message', { 
        detail: { 
          text: feedbackText, 
          type: isCorrect ? 'success' : 'error' 
        } 
      });
      window.dispatchEvent(event);

      if (isCorrect) {
        if (!isSectionCompleted(activeLab.id, sectionIdx)) {
          await addXp(20, 'Challenge completed');
          await addCoins(20, 'Challenge completed');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setValidatingChallenge(prev => ({ ...prev, [sectionIdx]: false }));
    }
  };

  const handlePurchaseHint = async (sectionIdx: number, section: any) => {
    if (purchasedHints[sectionIdx]) return; // Already purchased
    const success = await deductCoins(10, 'Purchased Hint');
    if (success) {
      setPurchasedHints(prev => ({ ...prev, [sectionIdx]: true }));
      toast.success('Hint purchased (-10 Coins)');
      const event = new CustomEvent('mentor-message', { 
        detail: { 
          text: `Hint for this section: You can ask me specific conceptual questions about this task in the chat below. Make sure to review the objective: ${section.title}`, 
          type: 'hint' 
        } 
      });
      window.dispatchEvent(event);
    } else {
      toast.error('Not enough coins to purchase a hint.');
    }
  };

  const submitQuiz = (sectionIdx: number, section: any) => {
    const selections = quizSelections[sectionIdx] || {};
    let allCorrect = true;
    let allAnswered = Object.keys(selections).length === section.questions.length;

    if (!allAnswered) {
      toast.error('All questions require responses to submit audits.');
      return;
    }

    section.questions.forEach((q: any, i: number) => {
      if (selections[i] !== q.correct) allCorrect = false;
    });

    setQuizResults({ ...quizResults, [sectionIdx]: allCorrect });

    if (allCorrect) {
      if (!isSectionCompleted(activeLab.id, sectionIdx)) {
        addXp(50, 'Perfect Quiz Score');
        completeSection(activeLab.id, sectionIdx);
      }
      const event = new CustomEvent('mentor-message', { detail: { text: 'Audit verification complete: answers match system logs.', type: 'success' } });
      window.dispatchEvent(event);
    } else {
      const event = new CustomEvent('mentor-message', { detail: { text: 'Audit verification failed. Please check validation logs.', type: 'error' } });
      window.dispatchEvent(event);
    }
  };

  const handleClaimCredentials = async () => {
    await completeLab(activeLab.id, activeLab);
    toast.success('Module completed! Advancing to next module...');
    
    // Small delay for toast visibility, then auto-advance
    setTimeout(() => {
      loadNextLab();
    }, 800);
  };

  const labAssessment = ASSESSMENTS[activeLab.id];
  const isAssessmentDone = assessmentPassed[activeLab.id] || false;

  return (
    <div className="flex-1 h-full p-6 md:p-10 overflow-y-auto bg-zinc-950 text-zinc-100 custom-scrollbar relative">
      <div className="max-w-3xl mx-auto pb-16">
        
        {/* Lab Info */}
        <div className="mb-10 font-sans border-b border-zinc-900 pb-8">
          <div className="flex items-center gap-3 mb-4 text-[10px] font-mono">
            <span className="px-2 py-0.5 border border-zinc-800 bg-zinc-900 rounded text-zinc-400">MODULE</span>
            <span className={`px-2 py-0.5 border rounded uppercase font-bold tracking-wider ${
              activeLab.difficulty === 'beginner' ? 'border-zinc-800 bg-zinc-900 text-zinc-400' :
              activeLab.difficulty === 'intermediate' ? 'border-zinc-800 bg-zinc-900 text-zinc-400' :
              'border-zinc-800 bg-zinc-900 text-zinc-400'
            }`}>{activeLab.difficulty}</span>
            <span className="text-zinc-500">+{activeLab.xp} XP</span>
          </div>
          <h1 className="text-xl md:text-2xl font-mono font-bold text-zinc-100 mb-6">{activeLab.name}</h1>
          
          {/* Progress Indicators */}
          <div className="flex gap-1.5">
            {activeLab.sections.map((sec, idx) => (
              <div 
                key={idx} 
                onClick={() => jumpToSection(idx)}
                className={`
                  flex-1 h-1 rounded-full cursor-pointer transition-all duration-300
                  ${isSectionCompleted(activeLab.id, idx) ? 'bg-zinc-400' : 
                    idx === currentSectionIndex ? 'bg-zinc-100' : 'bg-zinc-800'}
                `}
                title={sec.title}
              />
            ))}
          </div>
        </div>

        {/* Section View */}
        <div className="space-y-6">
          {activeLab.sections.map((section, idx) => {
            const isCompleted = isSectionCompleted(activeLab.id, idx);
            const isActive = idx === currentSectionIndex;
            const isLocked = idx > currentSectionIndex && !isCompleted;
            
            if (isLocked && !isActive) return null;

            return (
              <div 
                key={idx} 
                className={`
                  transition-all duration-200 rounded overflow-hidden border
                  ${isActive ? 'border-zinc-700 bg-zinc-900 shadow-lg' : 'border-zinc-900/60 bg-zinc-900/10 opacity-50'}
                `}
              >
                <div className="p-6">
                  {/* Title Bar */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-6 h-6 rounded flex items-center justify-center font-mono text-[10px] border ${isCompleted ? 'bg-zinc-100 border-zinc-200 text-zinc-950 font-bold' : 'border-zinc-800 text-zinc-500 bg-zinc-950/40'}`}>
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <h2 className="text-sm font-mono font-bold text-zinc-200 uppercase tracking-wider">
                      {section.type === 'badge' ? 'Section Verification complete' : section.title}
                    </h2>
                  </div>

                  {/* Content by Type */}
                  {(section.type === 'objective' || section.type === 'theory' || section.type === 'tool-intro') && (
                    <div className="text-xs font-sans text-zinc-400 leading-relaxed prose prose-zinc prose-invert max-w-none prose-sm" dangerouslySetInnerHTML={{ __html: section.content || '' }} />
                  )}

                  {section.type === 'command' && (
                    <div className="space-y-4">
                      <div className="text-xs font-sans text-zinc-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: section.explanation || '' }} />
                      
                      <div className="bg-zinc-950 border border-zinc-800/80 rounded overflow-hidden">
                        <div className="bg-zinc-900/40 px-4 py-2.5 flex justify-between items-center border-b border-zinc-800/80 font-mono text-[10px]">
                          <span className="text-zinc-500">Terminal Shell</span>
                          <button 
                            onClick={() => handleCopyCommand(section.command!)}
                            className="text-[10px] bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded hover:bg-zinc-700 hover:text-white transition-colors font-mono"
                          >
                            Copy Command
                          </button>
                        </div>
                        <div className="p-4 font-mono text-xs text-zinc-200 bg-zinc-950 break-all">
                          <span className="text-zinc-600">operator@console:~$</span> {section.command}
                        </div>
                      </div>

                      {/* Hint Button */}
                      {!isCompleted && isActive && (
                        <div className="flex justify-end mt-2">
                          <button 
                            onClick={() => handlePurchaseHint(idx, section)}
                            disabled={purchasedHints[idx]}
                            className="flex items-center gap-1.5 text-[10px] font-mono text-amber-500 hover:text-amber-400 border border-amber-900/50 bg-amber-950/20 px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
                          >
                            <HelpCircle className="w-3 h-3" />
                            {purchasedHints[idx] ? 'Hint Unlocked' : 'Ask Advisor for Hint (10 Coins)'}
                          </button>
                        </div>
                      )}

                      {/* File download button for wordlist / CUPP outputs */}
                      {section.fileToDownload && (
                        <button
                          onClick={() => {
                            const blob = new Blob([section.fileToDownload!.content], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = section.fileToDownload!.name;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-[11px] font-mono px-4 py-2 rounded transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" /> Download {section.fileToDownload.name}
                        </button>
                      )}

                      {section.flags && section.flags.length > 0 && (
                        <div className="mt-4 bg-zinc-900/30 border border-zinc-850 rounded p-4">
                          <h4 className="text-[10px] font-mono font-bold text-zinc-400 mb-2.5 uppercase tracking-wider">Command Arguments Description</h4>
                          <div className="space-y-2 font-mono text-[10px]">
                            {section.flags.map((f, i) => (
                              <div key={i} className="flex gap-4">
                                <code className="text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{f.flag}</code>
                                <span className="text-zinc-500 flex-1">{f.desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {section.type === 'challenge' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-zinc-400 font-mono text-[10px] uppercase font-bold mb-2">
                        <AlertCircle className="w-3.5 h-3.5" /> Validation Challenge
                      </div>
                      <p className="text-xs font-sans text-zinc-400 leading-relaxed">{section.description}</p>
                      
                      <div className="flex gap-3">
                        <input 
                          type="text" 
                          disabled={challengeFeedback[idx]?.isCorrect || validatingChallenge[idx]}
                          value={challengeInputs[idx] || ''}
                          onChange={(e) => setChallengeInputs({ ...challengeInputs, [idx]: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && submitChallenge(idx, section)}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 font-mono focus:border-zinc-700 outline-none disabled:opacity-50"
                          placeholder="Enter system signature/answer..."
                        />
                        <button 
                          disabled={challengeFeedback[idx]?.isCorrect || validatingChallenge[idx]}
                          onClick={() => submitChallenge(idx, section)}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-850 text-xs px-4 py-2 rounded font-mono transition-colors disabled:opacity-30 flex items-center justify-center min-w-[85px]"
                        >
                          {validatingChallenge[idx] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify'}
                        </button>
                      </div>

                      {challengeFeedback[idx] && (
                        <div className={`p-3 rounded border text-xs font-mono ${challengeFeedback[idx].isCorrect ? 'bg-zinc-900/50 border-zinc-800 text-zinc-300' : 'bg-red-950/20 border-red-950/50 text-red-400'}`}>
                          {challengeFeedback[idx].text}
                        </div>
                      )}

                      {/* Hint Button */}
                      {!isCompleted && isActive && (
                        <div className="flex justify-end mt-2">
                          <button 
                            onClick={() => handlePurchaseHint(idx, section)}
                            disabled={purchasedHints[idx]}
                            className="flex items-center gap-1.5 text-[10px] font-mono text-amber-500 hover:text-amber-400 border border-amber-900/50 bg-amber-950/20 px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
                          >
                            <HelpCircle className="w-3 h-3" />
                            {purchasedHints[idx] ? 'Hint Unlocked' : 'Ask Advisor for Hint (10 Coins)'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {section.type === 'quiz' && (
                    <div className="space-y-6">
                      {section.questions?.map((q, qIdx) => (
                        <div key={qIdx} className="space-y-3">
                          <p className="text-xs font-mono font-bold text-zinc-200">
                            <span className="text-zinc-500">[Q{qIdx + 1}]</span> {q.question}
                          </p>
                          <div className="space-y-2">
                            {q.options.map((opt, oIdx) => {
                              const isSelected = quizSelections[idx]?.[qIdx] === oIdx;
                              const isSubmitted = quizResults[idx] !== undefined;
                              const isCorrectAnswer = q.correct === oIdx;
                              
                              let btnClass = "w-full text-left px-4 py-2.5 text-xs rounded border font-mono transition-colors ";
                              if (isSubmitted) {
                                if (isSelected && isCorrectAnswer) btnClass += "bg-emerald-950/30 border-emerald-800/50 text-emerald-300";
                                else if (isSelected && !isCorrectAnswer) btnClass += "bg-red-950/20 border-red-900/50 text-red-400";
                                else if (!isSelected && isCorrectAnswer) btnClass += "bg-zinc-900 border-zinc-700 text-zinc-300";
                                else btnClass += "bg-zinc-950/20 border-zinc-900 text-zinc-600";
                              } else {
                                btnClass += isSelected 
                                  ? "bg-zinc-800 border-zinc-600 text-zinc-200 font-medium" 
                                  : "bg-zinc-950/40 border-zinc-850 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200";
                              }

                              return (
                                <button 
                                  key={oIdx}
                                  disabled={isSubmitted && quizResults[idx]}
                                  onClick={() => setQuizSelections({
                                    ...quizSelections,
                                    [idx]: { ...(quizSelections[idx] || {}), [qIdx]: oIdx }
                                  })}
                                  className={btnClass}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      
                      {quizResults[idx] === undefined && (
                        <button 
                          onClick={() => submitQuiz(idx, section)}
                          className="w-full bg-zinc-800 border border-zinc-750 text-zinc-300 hover:text-white font-mono text-xs py-3 rounded hover:bg-zinc-750 transition-colors"
                        >
                          Submit Quiz Data
                        </button>
                      )}
                    </div>
                  )}

                  {section.type === 'badge' && (
                    <div className="text-center py-6 font-mono">
                      <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded border border-zinc-800 bg-zinc-950 flex items-center justify-center">
                          {renderBadgeIcon(section.badgeIcon || '')}
                        </div>
                      </div>
                      <h3 className="text-sm font-bold text-zinc-100 mb-2 uppercase tracking-widest">MODULE CLEARED</h3>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-6">{section.description}</p>
                      
                      {/* Assessment gate — must pass before claiming badge */}
                      {labAssessment && !isAssessmentDone ? (
                        <button 
                          onClick={() => setShowAssessment(true)}
                          className="bg-amber-600/80 hover:bg-amber-500/80 text-white text-xs font-bold px-6 py-2.5 rounded transition-colors flex items-center gap-2 mx-auto"
                        >
                          <ClipboardCheck className="w-4 h-4" /> Take Assessment to Unlock
                        </button>
                      ) : (
                        <button 
                          onClick={handleClaimCredentials}
                          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold px-6 py-2.5 rounded transition-colors"
                        >
                          Claim Credentials & Continue
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Section Navigation Footer */}
        {currentSectionIndex < activeLab.sections.length - 1 && (
          <div className="mt-8 flex justify-between font-mono text-xs">
            <button 
              onClick={prevSection}
              disabled={currentSectionIndex === 0}
              className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded disabled:opacity-0 hover:bg-zinc-900 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button 
              onClick={nextSection}
              className={`px-5 py-2.5 rounded border font-mono transition-colors flex items-center gap-1
                ${isSectionCompleted(activeLab.id, currentSectionIndex) || !['command','challenge','quiz'].includes(activeLab.sections[currentSectionIndex].type)
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                  : 'bg-zinc-950 border-zinc-900 text-zinc-600 cursor-not-allowed'
                }
              `}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Assessment Modal */}
      {showAssessment && labAssessment && (
        <AssessmentModal 
          questions={labAssessment}
          onComplete={() => {
            setAssessmentPassed(prev => ({ ...prev, [activeLab.id]: true }));
            setShowAssessment(false);
            toast.success('Assessment completed! You may now claim your credentials.');
          }}
          onClose={() => setShowAssessment(false)}
        />
      )}
    </div>
  );
}

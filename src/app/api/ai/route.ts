import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral:7b';

const RAG_KNOWLEDGE = `
=== PCL CYBERSECURITY KNOWLEDGE BASE ===

HASHCAT - Password Hash Cracking:
  Syntax: hashcat -m [hash_type] -a [attack_mode] [hash_file] [wordlist_or_mask]
  Attack Modes:
    -a 0 = Dictionary attack (most common)
    -a 1 = Combination attack (two wordlists combined)
    -a 3 = Brute-force mask attack (e.g., ?l?l?l?l?d?d)
    -a 6 = Hybrid: wordlist + mask
  Hash Types (most common):
    -m 0    = MD5
    -m 100  = SHA-1
    -m 400  = phpBB3 / WordPress (phpass)
    -m 500  = md5crypt ($1$)
    -m 1000 = NTLM (Windows)
    -m 1400 = SHA-256
    -m 1700 = SHA-512
    -m 1800 = sha512crypt ($6$) — Linux /etc/shadow
    -m 3200 = bcrypt ($2*$, Blowfish)
  Mask Characters: ?l=lowercase ?u=uppercase ?d=digit ?s=special ?a=all
  Show cracked: hashcat -m 0 hash.txt --show
  Example syntax (do NOT fill real values): hashcat -m [mode] -a 0 hash.txt rockyou.txt
  Docs: https://hashcat.net/wiki/

JOHN THE RIPPER - Password Cracker:
  Syntax: john --format=[format] --wordlist=[file] [hash_file]
  Auto-detect: john hash.txt (auto-identifies format)
  Show cracked: john --show hash.txt
  Formats: raw-md5, raw-sha1, sha512crypt, bcrypt, NT, descrypt, md5crypt
  Wordlist: john --wordlist=/usr/share/wordlists/rockyou.txt hash.txt
  Incremental (brute-force): john --incremental hash.txt
  Rules: john --wordlist=rockyou.txt --rules hash.txt
  Docs: https://www.openwall.com/john/doc/

HYDRA - Network Login Brute-Forcer:
  Syntax: hydra -l [user] -P [wordlist] [target] [service]
  Single user: hydra -l admin -P rockyou.txt ssh://192.168.1.1
  User list:   hydra -L users.txt -P passwords.txt ssh://192.168.1.1
  HTTP POST:   hydra -l admin -P pass.txt 192.168.1.1 http-post-form "/login:user=^USER^&pass=^PASS^:Invalid"
  Custom port: add -s [port]
  Services: ssh, ftp, rdp, smtp, http-get, http-post-form, mysql, telnet
  GitHub: https://github.com/vanhauser-thc/thc-hydra

WIRESHARK / TSHARK - Packet Analysis:
  Read file: tshark -r capture.pcap
  Apply filter: tshark -r capture.pcap -Y "ftp"
  Extract fields: tshark -r capture.pcap -T fields -e ftp.request.arg
  Follow stream: tshark -r capture.pcap -z follow,tcp,ascii,0
  Key filters: http, ftp, telnet, dns, smtp, tcp.port==80, ip.addr==x.x.x.x
  Find credentials: look for USER/PASS in FTP, Authorization in HTTP, login forms
  Docs: https://www.wireshark.org/docs/wsug_html/

WORDLISTS:
  rockyou.txt: /usr/share/wordlists/rockyou.txt (most common wordlist, 14M passwords)
  SecLists: https://github.com/danielmiessler/SecLists
  Hashcat rules: /usr/share/hashcat/rules/best64.rule

SECURITY ADVISOR RULES — ALWAYS FOLLOW:
  - NEVER reveal the actual password, flag, hash value, or credential
  - NEVER write a completed command with the real secret values filled in
  - Guide abstractly: "use the dictionary attack mode (-a 0) with the SHA-1 hash type (-m 100)"
  - If student asks for the answer directly → politely refuse, give a direction hint instead
  - Be encouraging — celebrate progress, normalize mistakes as part of learning
=== END KNOWLEDGE BASE ===
`;

function buildStudentContext(body: any): string {
  const {
    labName, labDifficulty, trackName,
    currentSection, currentSectionType, currentCommand, expectedOutput,
    studentXP, completedLabs, studentName,
  } = body;

  if (!labName) return '';

  const level = (studentXP || 0) < 200 ? 'beginner'
              : (studentXP || 0) < 600 ? 'intermediate'
              : 'advanced';

  const tone = level === 'beginner'
    ? 'Be extra patient. Use simple language. Explain every flag. Encourage a lot.'
    : level === 'intermediate'
    ? 'Be concise but thorough. Student knows basics. Focus on the specific step.'
    : 'Be direct. Student is experienced. Give precise technical guidance.';

  return `
=== STUDENT CONTEXT (PERSONALIZED) ===
Student: ${studentName || 'User'}
Experience Level: ${level} (XP: ${studentXP || 0})
Completed Labs: ${completedLabs?.join(', ') || 'None yet'}

Current Lab: "${labName}"
Difficulty: ${labDifficulty || 'beginner'}
Track: ${trackName || 'Unknown'}

Current Section: "${currentSection || 'Unknown'}"
Section Type: ${currentSectionType || 'general'}
${currentCommand ? 'Expected Command for this step: [REDACTED - guide student toward it, do not reveal]' : ''}
${expectedOutput ? 'What success looks like: [REDACTED - describe outcome abstractly]' : ''}

Tone Instruction: ${tone}
=== END STUDENT CONTEXT ===
`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, systemPrompt, mode, stream = true } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const studentContext = buildStudentContext(body);
    const fullSystem = [systemPrompt || '', RAG_KNOWLEDGE, studentContext].filter(Boolean).join('\n\n');
    const fullPrompt = `SYSTEM:\n${fullSystem}\n\nUSER: ${prompt}\n\nASSISTANT:`;

    if (mode === 'validation' || !stream) {
      const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: fullPrompt,
          stream: false,
          options: { temperature: 0.1, num_predict: 600 },
        }),
      });

      if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
      const data = await res.json();
      return NextResponse.json({ text: data.response });
    }

    const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: true,
        options: { temperature: 0.7, num_predict: 1200, top_p: 0.9 },
      }),
    });

    if (!ollamaRes.ok) throw new Error(`Ollama error: ${ollamaRes.status}`);

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = ollamaRes.body!.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(Boolean);

            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.response) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: json.response })}\n\n`));
                }
                if (json.done) {
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                }
              } catch {
                // Skip malformed lines
              }
            }
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('[/api/ai] Error:', error);
    const isDown = error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed');
    return NextResponse.json(
      { error: isDown ? 'AI server is offline. Make sure Ollama is running.' : error.message },
      { status: 500 }
    );
  }
}

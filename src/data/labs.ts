export type SectionType = 'objective' | 'theory' | 'tool-intro' | 'command' | 'challenge' | 'quiz' | 'badge';

export interface CommandFlag {
  flag: string;
  desc: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface LabSection {
  type: SectionType;
  title: string;
  content?: string;
  command?: string;
  explanation?: string;
  flags?: CommandFlag[];
  expectedOutput?: string;
  outputExplanation?: string;
  interactiveInput?: string;
  description?: string;
  acceptableAnswers?: string[];
  successMessage?: string;
  failureMessage?: string;
  questions?: QuizQuestion[];
  badgeIcon?: string;
  fileToDownload?: { name: string; content: string }; // Custom file download support
}

export interface Lab {
  id: string;
  trackId: string;
  name: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  xp: number;
  badgeIcon: string;
  badgeName: string;
  sections: LabSection[];
}

export interface Track {
  id: string;
  name: string;
  icon: string; // Lucide Icon identifier
  color: string;
  description: string;
  labs: Lab[];
}

export const LAB_DATA: Track[] = [
  {
    id: 'intro',
    name: '1. Password Security Basics',
    icon: 'BookOpen',
    color: '#a1a1aa',
    description: 'Learn authentication principles, passwords vs passphrases, and critical errors in password selection.',
    labs: [
      {
        id: 'auth-principles',
        trackId: 'intro',
        name: 'Authentication Concepts & Policies',
        difficulty: 'beginner',
        xp: 100,
        badgeIcon: 'Shield',
        badgeName: 'Security Foundations Specialist',
        sections: [
          {
            type: 'objective',
            title: 'Objective',
            content: '<p>Understand the conceptual foundation of password storage and authentication vs authorization policies.</p>'
          },
          {
            type: 'theory',
            title: 'Authentication vs Authorization',
            content: `
              <div class="space-y-4">
                <p><strong>Authentication (AuthN)</strong> is the process of confirming identity (e.g., matching a username and password). It answers: <em>"Who are you?"</em></p>
                <p><strong>Authorization (AuthZ)</strong> determines the access permissions granted to an authenticated entity. It answers: <em>"What are you allowed to do?"</em></p>
                <div class="border border-zinc-800 p-3 bg-zinc-900/50 rounded font-mono text-[11px] leading-relaxed">
                  [Authentication Event] -> Matches credentials -> UID: 501 (operator)<br>
                  [Authorization Event]  -> Inspects permissions -> Access /var/log/audit: DENIED (Requires UID 0)
                </div>
              </div>
            `
          },
          {
            type: 'theory',
            title: 'Password Weaknesses & Passphrases',
            content: `
              <div class="space-y-4">
                <h4 class="text-zinc-200 font-bold font-mono text-xs">Common Password Mistakes:</h4>
                <ul class="list-disc pl-4 space-y-2 text-zinc-400">
                  <li><strong>Sequential Patterns</strong>: Testing strings like <code>qwerty</code> or <code>123456</code> takes less than a second for cracking algorithms.</li>
                  <li><strong>Simple Substitutions</strong>: Attackers automatically map characters (e.g., <code>@</code> for <code>a</code>, <code>3</code> for <code>E</code>), making <code>P@ssw0rd1!</code> highly vulnerable.</li>
                  <li><strong>Credential Stuffing</strong>: Reusing the same password across multiple sites allows attackers to use compromised credentials on secondary services.</li>
                </ul>
                <p><strong>Passphrases</strong> (long strings of unrelated words, e.g., <code>correcthorsebatterystaple</code>) offer significantly larger character space, making dictionary attacks mathematically difficult while remaining memorable.</p>
              </div>
            `
          },
          {
            type: 'quiz',
            title: 'Authentication Policy Review',
            questions: [
              {
                question: 'Which of the following processes determines whether an operator has the rights to run packet captures on interface eth0?',
                options: ['Authentication (AuthN)', 'Authorization (AuthZ)', 'Tokenization', 'Credential Stuffing'],
                correct: 1
              },
              {
                question: 'Why is a password like "P@ssw0rd1!" considered insecure by security auditors?',
                options: [
                  'It contains uppercase characters.',
                  'Character substitution rules (e.g. @ for a) are preprogrammed into modern cracking tools.',
                  'It uses too many special characters.',
                  'It cannot be hashed by bcrypt.'
                ],
                correct: 1
              }
            ]
          },
          {
            type: 'badge',
            title: 'Basics Module Cleared',
            description: 'You have verified capabilities in authentication theory and password mistakes.',
            badgeIcon: 'Shield'
          }
        ]
      }
    ]
  },
  {
    id: 'hashing',
    name: '2. Cryptographic Hashing',
    icon: 'Cpu',
    color: '#a1a1aa',
    description: 'Deep dive into deterministic hashing, avalanche effects, and comparison of modern slow algorithms.',
    labs: [
      {
        id: 'hashing-algorithms',
        trackId: 'hashing',
        name: 'Hashed Storage Audit (Argon2id, bcrypt, scrypt)',
        difficulty: 'beginner',
        xp: 150,
        badgeIcon: 'Award',
        badgeName: 'Hashing Audit Specialist',
        sections: [
          {
            type: 'objective',
            title: 'Objective',
            content: '<p>Audit cryptographic password hashing algorithms by executing and comparing fast hashing (MD5, SHA-256) vs modern slow hashing configurations.</p>'
          },
          {
            type: 'theory',
            title: 'Hashing Characteristics & GPU Vulnerabilities',
            content: `
              <div class="space-y-4">
                <p>Cryptographic hashes are <strong>deterministic</strong> (same input produces the same output) and exhibit the <strong>avalanche effect</strong> (a 1-bit input change completely alters the hash output).</p>
                <p>Fast algorithms like <strong>SHA-256</strong> are designed for checking data integrity. Because they execute quickly, modern GPUs can compute billions of SHA-256 hashes per second, making them insecure for password storage. Organizations instead use <strong>slow hashing algorithms</strong> (Argon2id, bcrypt, scrypt) which utilize configurable iterations, salts, and memory-hardness to defend against hardware acceleration.</p>
              </div>
            `
          },
          {
            type: 'command',
            title: 'Step 1: Compute MD5 Hash',
            command: 'echo -n "Password123" | md5sum',
            explanation: '<p>Execute a basic fast hash. Notice that MD5 is a 32-character hexadecimal digest. It is vulnerable to hash collisions.</p>',
            expectedOutput: '48590c609101ff2a5f7f45c9285098b6  -',
            outputExplanation: 'MD5 completed in microseconds. Modern GPUs can calculate trillions of these, rendering MD5 completely obsolete for security.'
          },
          {
            type: 'command',
            title: 'Step 2: Compute SHA-256 Hash',
            command: 'echo -n "Password123" | sha256sum',
            explanation: '<p>Execute a Secure Hash Algorithm (SHA-2). Note that the output is 64 hex characters (256 bits) regardless of input size.</p>',
            expectedOutput: 'ef92b778bafe4cf1a77c83fd1448a1f2e96d9d2a6a3e54f77d856d1b58535091  -',
            outputExplanation: 'While cryptographically stronger than MD5, SHA-256 remains a "fast" algorithm and is not recommended for standalone password storage.'
          },
          {
            type: 'command',
            title: 'Step 3: Generate bcrypt Hash',
            command: 'htpasswd -bnBC 12 "" Password123',
            explanation: '<p>Generate a Blowfish-based bcrypt password hash using a Cost Factor of 12 (configured via <code>-C 12</code>).</p>',
            expectedOutput: '$2y$12$XyZ1234567890abcdefghuOpqrstuvwxyz1234567890abcdefghij',
            outputExplanation: 'bcrypt prefixes hashes with $2y$ indicating the version, followed by the cost factor (12) and the combined salt/hash.'
          },
          {
            type: 'command',
            title: 'Step 4: Compute Argon2id Hash',
            command: 'echo -n "Password123" | argon2 mysalt -id',
            explanation: '<p>Compute an Argon2id (hybrid memory/CPU hard) password hash using a salt value of <code>mysalt</code>.</p>',
            expectedOutput: 'Type:\t\tArgon2id<br>Iterations:\t3<br>Memory:\t\t4096 KiB<br>Parallelism:\t1<br>Hash:\t\t$argon2id$v=19$m=4096,t=3,p=1$bXlzYWx0$WJ2/yP2RjVfX5r4Xw3z0qQ',
            outputExplanation: 'Argon2id output shows version 19, memory cost, time iterations, and parallelism parameters. This is the current OWASP recommendation.'
          },
          {
            type: 'command',
            title: 'Step 5: Configure Hardened Argon2id',
            command: 'echo -n "Password123" | argon2 mysalt -id -t 4 -m 16 -p 2',
            explanation: '<p>Execute Argon2id with hardened parameters: Time cost 4 iterations (<code>-t 4</code>), Memory cost 16MB (<code>-m 16</code>), and Parallelism of 2 threads (<code>-p 2</code>).</p>',
            expectedOutput: 'Type:\t\tArgon2id<br>Iterations:\t4<br>Memory:\t\t16384 KiB<br>Parallelism:\t2<br>Hash:\t\t$argon2id$v=19$m=16384,t=4,p=2$bXlzYWx0$Y29tcGxleF9oYXNoX3ZhbHVlX2hlcmU',
            outputExplanation: 'Increasing memory to 16MB and threads to 2 makes it extremely expensive for an attacker to load parallel calculations in GPU memory.'
          },
          {
            type: 'command',
            title: 'Step 6: Measure SHA-256 Execution Time',
            command: 'time echo -n "Password123" | sha256sum',
            explanation: '<p>Measure execution time of a fast SHA-256 calculation.</p>',
            expectedOutput: 'ef92b778bafe4cf1a77c83fd1448a1f2e96d9d2a6a3e54f77d856d1b58535091  -<br>real\t0m0.002s<br>user\t0m0.000s<br>sys\t0m0.002s',
            outputExplanation: 'Notice the execution completes in approximately 0.002 seconds. It uses virtually zero CPU or memory resources.'
          },
          {
            type: 'command',
            title: 'Step 7: Measure Argon2id Execution Time',
            command: 'time echo -n "Password123" | argon2 mysalt -id',
            explanation: '<p>Measure execution time of a slow Argon2id calculation. Compare this with the SHA-256 command above.</p>',
            expectedOutput: 'Hash:\t\t$argon2id$v=19$m=4096,t=3,p=1$bXlzYWx0$WJ2/yP2RjVfX5r4Xw3z0qQ<br>real\t0m0.145s<br>user\t0m0.130s<br>sys\t0m0.015s',
            outputExplanation: 'Argon2id took 0.145s (nearly 70 times longer than SHA-256) and consumed 4MB of RAM. This deliberate delay makes large-scale guessing attacks computationally unfeasible.'
          },
          {
            type: 'challenge',
            title: 'Hashing Verification Challenge',
            description: 'Why do cryptographic hashing algorithms like Argon2id protect better against GPU cracking than SHA-256?',
            acceptableAnswers: ['Memory-hardness', 'memory-hardness', 'Memory hardness', 'memory hardness'],
            successMessage: 'Correct. Memory-hardness forces the cracking device to allocate specific RAM resources per guess, neutralizing GPU parallel cores.',
            failureMessage: 'Incorrect. Think about the physical hardware constraints (CPU/RAM/GPU memory blocks).'
          },
          {
            type: 'badge',
            title: 'Hashing Module Cleared',
            description: 'You have audited cryptographic storage options and verified time/resource costs.',
            badgeIcon: 'Award'
          }
        ]
      }
    ]
  },
  {
    id: 'profiling',
    name: '3. Hash Identification & Wordlists',
    icon: 'Search',
    color: '#a1a1aa',
    description: 'Identify unknown hashes using signature matching and generate target-specific dictionaries.',
    labs: [
      {
        id: 'profiling-lab',
        trackId: 'profiling',
        name: 'Signature Audits & Custom Dictionaries',
        difficulty: 'beginner',
        xp: 150,
        badgeIcon: 'Search',
        badgeName: 'Hash & Wordlist Specialist',
        sections: [
          {
            type: 'objective',
            title: 'Objective',
            content: '<p>Automate unknown hash identification and compile customized dictionary dictionaries using character parameters.</p>'
          },
          {
            type: 'command',
            title: 'Step 1: Check Hash Length',
            command: 'echo -n "5f4dcc3b5aa765d61d8327deb882cf99" | wc -c',
            explanation: '<p>Calculate the length of the unknown hash string. Length is key to matching signatures.</p>',
            expectedOutput: '32',
            outputExplanation: 'A 32-character hexadecimal string contains 128 bits. This structure matches MD5, MD4, or NTLM.'
          },
          {
            type: 'command',
            title: 'Step 2: Run HashID Tool',
            command: 'hashid 5f4dcc3b5aa765d61d8327deb882cf99',
            explanation: '<p>Run the basic <strong>hashid</strong> signature identifier on the token.</p>',
            expectedOutput: 'Analyzing \'5f4dcc3b5aa765d61d8327deb882cf99\'<br>[+] MD5<br>[+] MD4<br>[+] NTLM',
            outputExplanation: 'HashID predicts MD5 as the primary algorithm candidate based on hexadecimal structure and character length.'
          },
          {
            type: 'command',
            title: 'Step 3: Get Hashcat Modes',
            command: 'hashid -m 5f4dcc3b5aa765d61d8327deb882cf99',
            explanation: '<p>Pass the <code>-m</code> flag to output corresponding Hashcat mode integers.</p>',
            expectedOutput: 'Analyzing \'5f4dcc3b5aa765d61d8327deb882cf99\'<br>[+] MD5 [Hashcat Mode: 0]<br>[+] MD4 [Hashcat Mode: 900]<br>[+] NTLM [Hashcat Mode: 1000]',
            outputExplanation: 'The output lists Hashcat modes (e.g., Mode 0 for MD5), which will be required for our cracking step.'
          },
          {
            type: 'command',
            title: 'Step 4: Run Name-That-Hash',
            command: 'nth --text 5f4dcc3b5aa765d61d8327deb882cf99',
            explanation: '<p>Compare HashID output with Name-That-Hash (NTH) to analyze matching confidence levels.</p>',
            expectedOutput: 'Matched Hash Type: MD5<br>Confidence: 100%<br>Hashcat Mode: 0<br>John Format: raw-md5',
            outputExplanation: 'NTH confirms MD5 with 100% confidence and maps the exact parameters for John the Ripper (raw-md5).'
          },
          {
            type: 'command',
            title: 'Step 5: Run Crunch Generator',
            command: 'crunch 4 4 -o wordlist.txt',
            explanation: '<p>Generate a simple dictionary wordlist containing all possible 4-character permutations.</p>',
            expectedOutput: 'Crunch will now generate the following amount of data: 2383280 bytes<br>Crunch will now generate the following number of lines: 456976<br>crunch: 100% completed generating output to wordlist.txt',
            outputExplanation: 'Crunch generated 456,976 permutations and saved them to wordlist.txt in the sandbox.'
          },
          {
            type: 'command',
            title: 'Step 6: Alphanumeric Crunch Permutations',
            command: 'crunch 4 6 abc123 -o wordlist.txt',
            explanation: '<p>Compare this with a targeted scan: generate combinations from length 4 to 6 using character set <code>abc123</code>.</p>',
            expectedOutput: 'Crunch will now generate: 559872 bytes<br>Crunch completed generating output to wordlist.txt',
            outputExplanation: 'Specifying character sets reduced the output size while mapping target-specific patterns.'
          },
          {
            type: 'command',
            title: 'Step 7: Profiler Simulator (CUPP)',
            command: 'python3 cupp.py -i',
            explanation: '<p>Simulate the interactive Common User Passwords Profiler (CUPP) configuration tool.</p>',
            expectedOutput: '[+] Insert Target Name: John<br>[+] Target Surname: Doe<br>[+] Target Birthdate: 1990<br>[+] Generate custom wordlist... Completed. 120 target-specific passwords written to john.txt',
            outputExplanation: 'CUPP profiled John Doe, combining his surname and birth year (e.g. John1990, Doe1990) to create a target-specific dictionary.',
            fileToDownload: {
              name: 'john.txt',
              content: 'John1990\nJohnDoe\nDoe1990\nJohn1990!\nDoe90\nJJohn90'
            }
          },
          {
            type: 'challenge',
            title: 'Profiling Verification Check',
            description: 'What Hashcat mode integer is mapped for NTLM hashes based on your analysis in Step 3?',
            acceptableAnswers: ['1000'],
            successMessage: 'Verification passed. Hashcat uses Mode 1000 for Windows NTLM hashes.',
            failureMessage: 'Validation failed. Check the output of Step 3 for NTLM.'
          },
          {
            type: 'badge',
            title: 'Profiling Module Cleared',
            description: 'You have identified hashes, generated permutations, and built custom dictionaries.',
            badgeIcon: 'Search'
          }
        ]
      }
    ]
  },
  {
    id: 'offline',
    name: '4. Offline Cracking',
    icon: 'Terminal',
    color: '#a1a1aa',
    description: 'Perform offline dictionary attacks, incremental brute forcing, and rule-based modifications.',
    labs: [
      {
        id: 'offline-cracking-lab',
        trackId: 'offline',
        name: 'Offline Auditing (John & Hashcat)',
        difficulty: 'intermediate',
        xp: 200,
        badgeIcon: 'Terminal',
        badgeName: 'Credential Auditor',
        sections: [
          {
            type: 'objective',
            title: 'Objective',
            content: '<p>Crack password hashes locally using dictionary files, incremental brute-forcing, and rule-based transformations.</p>'
          },
          {
            type: 'theory',
            title: 'Audit Strategy: John vs Hashcat',
            content: `
              <div class="space-y-4">
                <p>Offline tools run directly against retrieved hash files, meaning they are only restricted by local hardware capabilities.</p>
                <p><strong>Hashcat</strong> utilizes GPU core acceleration, while <strong>John the Ripper</strong> provides rapid CPU audits, flexible incremental syntax, and robust rules processing.</p>
              </div>
            `
          },
          {
            type: 'command',
            title: 'Step 1: Install Auditing Tools',
            command: 'sudo apt install hashcat john -y',
            explanation: '<p>Install both utilities into the local system environment.</p>',
            expectedOutput: 'Reading package lists... Done<br>Installing packages: hashcat, john... Done<br>Linking binary configurations.',
            outputExplanation: 'Auditing tools are installed.'
          },
          {
            type: 'command',
            title: 'Step 2: Generate Audit Target Hash',
            command: 'echo "5f4dcc3b5aa765d61d8327deb882cf99" > hashes.txt',
            explanation: '<p>Write an MD5 hash target to <code>hashes.txt</code>.</p>',
            expectedOutput: 'Written target to hashes.txt',
            outputExplanation: 'The target hash is written to the file.'
          },
          {
            type: 'command',
            title: 'Step 3: Run Hashcat MD5 Audit',
            command: 'hashcat -m 0 hashes.txt wordlist.txt',
            explanation: '<p>Run a dictionary attack using Hashcat. Mode <code>-m 0</code> selects the MD5 algorithm.</p>',
            expectedOutput: 'Session..........: hashcat<br>Status...........: Cracked<br>Hash.Name........: MD5<br>5f4dcc3b5aa765d61d8327deb882cf99:password',
            outputExplanation: 'Hashcat matched the target hash against the word "password" in the dictionary file.'
          },
          {
            type: 'command',
            title: 'Step 4: Show Hashcat Cracked Data',
            command: 'hashcat -m 0 hashes.txt --show',
            explanation: '<p>Verify cracked credentials stored in the local session database.</p>',
            expectedOutput: '5f4dcc3b5aa765d61d8327deb882cf99:password',
            outputExplanation: 'Hashcat prints the cracked hash mapping: password.'
          },
          {
            type: 'command',
            title: 'Step 5: Run John Dictionary Attack',
            command: 'john --wordlist=wordlist.txt hashes.txt',
            explanation: '<p>Audit the same hash using John the Ripper. John automatically detects the MD5 format.</p>',
            expectedOutput: 'Loaded 1 password hash (raw-md5)<br>password         (hashes.txt)',
            outputExplanation: 'John successfully cracked the hash using the dictionary file.'
          },
          {
            type: 'command',
            title: 'Step 6: Show John Cracked Results',
            command: 'john --show hashes.txt',
            explanation: '<p>Print active cracked targets from the John session database.</p>',
            expectedOutput: 'hashes.txt: password<br>1 password hash cracked, 0 left',
            outputExplanation: 'John prints: password.'
          },
          {
            type: 'command',
            title: 'Step 7: Rule-Based Audit',
            command: 'john --wordlist=wordlist.txt --rules hashes.txt',
            explanation: '<p>Execute a rule-based attack. This adds numbers, symbols, and letter substitutions to words from the dictionary to detect complex variations.</p>',
            expectedOutput: 'Loaded 1 password hash (raw-md5)<br>p@ssw0rd1!       (hashes.txt)',
            outputExplanation: 'John modified the base word "password" to "p@ssw0rd1!" using transformation rules and matched the target hash.'
          },
          {
            type: 'challenge',
            title: 'Audit Challenge (Brute Force Mode)',
            description: 'Construct a command using John the Ripper to run an incremental brute-force attack against "hashes.txt" capped at a maximum password length of 6 characters.',
            acceptableAnswers: ['john --incremental --max-length=6 hashes.txt'],
            successMessage: 'Correct! You configured John to restrict guessing, optimizing resource utilization.',
            failureMessage: 'Incorrect syntax. Check the flags listed in Step 6 of the manual.'
          },
          {
            type: 'badge',
            title: 'Offline Audit Module Cleared',
            description: 'You have audited hashes offline and configured custom cracking parameters.',
            badgeIcon: 'Terminal'
          }
        ]
      }
    ]
  },
  {
    id: 'online',
    name: '5. Online Bruteforcing',
    icon: 'Globe',
    color: '#a1a1aa',
    description: 'Verify network service authentication protocols using Hydra, Medusa, and Ncrack.',
    labs: [
      {
        id: 'online-bruteforcing-lab',
        trackId: 'online',
        name: 'Service Audits (Hydra, Medusa, Ncrack)',
        difficulty: 'advanced',
        xp: 200,
        badgeIcon: 'ShieldAlert',
        badgeName: 'Network Auditing Specialist',
        sections: [
          {
            type: 'objective',
            title: 'Objective',
            content: '<p>Audit remote network services using login scanners to detect weak credentials across SSH and FTP endpoints.</p>'
          },
          {
            type: 'theory',
            title: 'Online Scan Constraints',
            content: `
              <div class="space-y-4">
                <p>Unlike offline audits, online scans interact directly with live network ports.</p>
                <p>Speeds are restricted by network latency, connection handshakes, and rate-limiting policies. Scanners must manage parallel connections without crashing the service.</p>
              </div>
            `
          },
          {
            type: 'command',
            title: 'Step 1: Check Hydra Modules',
            command: 'hydra -U',
            explanation: '<p>Display all network protocols and service modules supported by Hydra.</p>',
            expectedOutput: 'Hydra supports: ftp, ssh, telnet, http-get, http-post, mysql, rdp, vnc, smb...',
            outputExplanation: 'Hydra maps a large library of remote protocol handlers.'
          },
          {
            type: 'command',
            title: 'Step 2: Run Hydra FTP Audit',
            command: 'hydra -l admin -P pass.txt ftp://192.168.1.100',
            explanation: '<p>Scan an FTP server using username <code>admin</code> (<code>-l</code>) and dictionary <code>pass.txt</code> (<code>-P</code>).</p>',
            expectedOutput: '[DATA] attacking ftp://192.168.1.100:21/<br>[21][ftp] host: 192.168.1.100   login: admin   password: secret123',
            outputExplanation: 'Hydra found valid FTP credentials: admin / secret123.'
          },
          {
            type: 'command',
            title: 'Step 3: Check Medusa Usage',
            command: 'medusa -h',
            explanation: '<p>Display the parameter help screen for the Medusa login scanner.</p>',
            expectedOutput: 'Medusa v2.2 - Brute-force tool<br>-h [target host]<br>-u [username]<br>-P [password file]<br>-M [module]',
            outputExplanation: 'Medusa uses threads for parallel login checks.'
          },
          {
            type: 'command',
            title: 'Step 4: Run Medusa FTP Scan',
            command: 'medusa -h 192.168.1.100 -u admin -P pass.txt -M ftp',
            explanation: '<p>Run an FTP scan using Medusa. Note how the parameters differ from Hydra.</p>',
            expectedOutput: 'Account Found: [192.168.1.100] User: admin Password: secret123 [Success]',
            outputExplanation: 'Medusa matched the credentials.'
          },
          {
            type: 'command',
            title: 'Step 5: Check Ncrack Help',
            command: 'ncrack -h',
            explanation: '<p>Display options for the Ncrack authentication scanner.</p>',
            expectedOutput: 'Ncrack: Network authentication cracker<br>Timing templates: -T 0-5<br>Authentication: --user, -U, -P',
            outputExplanation: 'Ncrack offers timing templates similar to Nmap to bypass rate limits.'
          },
          {
            type: 'command',
            title: 'Step 6: Scan Service Ports',
            command: 'ncrack -p ftp:21 192.168.1.100',
            explanation: '<p>Verify that the FTP service port is open before initiating login checks.</p>',
            expectedOutput: 'Host: 192.168.1.100 Port: 21/tcp ftp open',
            outputExplanation: 'Ncrack confirms the FTP port is active and accepting connections.'
          },
          {
            type: 'command',
            title: 'Step 7: Run Ncrack FTP Audit',
            command: 'ncrack --user admin -P pass.txt ftp://192.168.1.100',
            explanation: '<p>Initiate Ncrack against the target FTP server.</p>',
            expectedOutput: 'ncrack finished.<br>192.168.1.100 21/tcp ftp: admin secret123 credentials found',
            outputExplanation: 'Ncrack matched the admin credentials.'
          },
          {
            type: 'challenge',
            title: 'Online Audit Challenge',
            description: 'Construct a command using THC Hydra to scan the target SSH service (ssh://192.168.1.100) using username "root" and password dictionary "pass.txt".',
            acceptableAnswers: ['hydra -l root -P pass.txt ssh://192.168.1.100', 'hydra -l root -P pass.txt 192.168.1.100 ssh'],
            successMessage: 'Correct. You configured Hydra to scan the remote SSH port.',
            failureMessage: 'Incorrect syntax. Remember to specify username, password list, target IP, and the protocol.'
          },
          {
            type: 'badge',
            title: 'Online Audit Module Cleared',
            description: 'You have scanned network services and verified authentication access controls.',
            badgeIcon: 'ShieldAlert'
          }
        ]
      }
    ]
  },
  {
    id: 'sniffing',
    name: '6. PCAP Sniffing & Analysis',
    icon: 'ShieldAlert',
    color: '#a1a1aa',
    description: 'Capture network packets and analyze PCAP files to extract plaintext credentials.',
    labs: [
      {
        id: 'pcap-analysis-lab',
        trackId: 'sniffing',
        name: 'Packet Captures & Credential Sniffing',
        difficulty: 'advanced',
        xp: 250,
        badgeIcon: 'ShieldAlert',
        badgeName: 'Forensics Specialist',
        sections: [
          {
            type: 'objective',
            title: 'Objective',
            content: '<p>Capture network packets using tcpdump and analyze PCAP files using Wireshark and TShark to extract plaintext credentials.</p>'
          },
          {
            type: 'theory',
            title: 'Plaintext Protocol Vulnerabilities',
            content: `
              <div class="space-y-4">
                <p>Protocols like HTTP, FTP, and Telnet transmit credentials in plaintext.</p>
                <p>If an attacker captures network packets on the local segment, they can view these login details. Sniffing tools write this raw data to <strong>PCAP (Packet Capture)</strong> files for forensics analysis.</p>
              </div>
            `
          },
          {
            type: 'command',
            title: 'Step 1: Capture Packets (tcpdump)',
            command: 'sudo tcpdump -i eth0 -w capture.pcap',
            explanation: '<p>Sniff packets on network interface <code>eth0</code> and save the raw capture file as <code>capture.pcap</code>.</p>',
            expectedOutput: 'tcpdump: listening on eth0, link-type EN10MB<br>25 packets captured<br>50 packets received by filter',
            outputExplanation: 'tcpdump completed the capture. Packets are written to capture.pcap on the disk.'
          },
          {
            type: 'command',
            title: 'Step 2: Open capture file (Wireshark)',
            command: 'wireshark capture.pcap',
            explanation: '<p>Load the packet capture in the Wireshark GUI tool.</p>',
            expectedOutput: 'Opening capture.pcap in Wireshark interface... Completed.',
            outputExplanation: 'Wireshark displays the list of frames, packet details, and hex offsets.'
          },
          {
            type: 'command',
            title: 'Step 3: Analyze PCAP Summary (TShark)',
            command: 'tshark -r capture.pcap -q',
            explanation: '<p>Use <strong>TShark</strong> (Wireshark command-line version) to display a summary of the capture without the GUI.</p>',
            expectedOutput: 'File: capture.pcap<br>Packets: 25<br>Duration: 5.4 seconds<br>Protocols: IP, TCP, HTTP, DNS',
            outputExplanation: 'TShark maps the protocol summary, indicating HTTP traffic is present in the capture.'
          },
          {
            type: 'command',
            title: 'Step 4: Filter DNS Queries',
            command: 'tshark -r capture.pcap -Y dns',
            explanation: '<p>Filter the PCAP file to display only DNS queries and answers.</p>',
            expectedOutput: '1\t0.000000\t192.168.1.10\t→\t8.8.8.8\tDNS\tStandard query 0x12a3 A login.vulnerable-target.com',
            outputExplanation: 'TShark displays the target domain name queried by the host.'
          },
          {
            type: 'command',
            title: 'Step 5: Filter HTTP Requests',
            command: 'tshark -r capture.pcap -Y http',
            explanation: '<p>Filter for HTTP requests to locate web login forms.</p>',
            expectedOutput: '5\t1.204500\t192.168.1.10\t→\t192.168.1.100\tHTTP\tPOST /login.php HTTP/1.1 (application/x-www-form-urlencoded)',
            outputExplanation: 'An HTTP POST request is sent to the /login.php endpoint, which often carries user credentials.'
          },
          {
            type: 'command',
            title: 'Step 6: Extract POST Form Data',
            command: 'tshark -r capture.pcap -Y "http.request.method == POST" -T fields -e http.file_data',
            explanation: '<p>Extract the raw form parameters submitted in HTTP POST requests.</p>',
            expectedOutput: 'uname=admin&passwd=secr3t_pa$$&submit=Login',
            outputExplanation: 'TShark successfully extracts the plaintext credentials: username "admin" and password "secr3t_pa$$".'
          },
          {
            type: 'command',
            title: 'Step 7: View Basic HTTP Authentication',
            command: 'tshark -r capture.pcap -Y "http.authbinary" -V',
            explanation: '<p>View HTTP Basic Authentication headers if cookies or forms are not used.</p>',
            expectedOutput: 'Hypertext Transfer Protocol<br>\tAuthorization: Basic YWRtaW46c2VjcjN0X3BhJFM=<br>\t[Credentials: admin:secr3t_pa$$]',
            outputExplanation: 'TShark decodes the base64 authorization string (YWRtaW46c2VjcjN0X3BhJFM=) to reveal the credentials.'
          },
          {
            type: 'challenge',
            title: 'PCAP Analysis Challenge',
            description: 'Extract the plaintext password credentials from the POST request form parameters shown in Step 6.',
            acceptableAnswers: ['secr3t_pa$$'],
            successMessage: 'Verification passed. You extracted the password flag (secr3t_pa$$) from the HTTP POST form data.',
            failureMessage: 'Validation failed. Check the password value next to "passwd=" in Step 6.'
          },
          {
            type: 'badge',
            title: 'Sniffing Module Cleared',
            description: 'You have analyzed packet files and extracted plain text credentials.',
            badgeIcon: 'ShieldAlert'
          }
        ]
      }
    ]
  }
];

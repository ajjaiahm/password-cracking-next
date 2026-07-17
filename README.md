# GUIDE FOR C-ISFCR PASSWORD CRACKING LAB

Welcome to the **C-ISFCR Password Cracking Lab**, a highly interactive, scalable, and AI-augmented cybersecurity training platform. This platform allows students to safely practice password cracking techniques using tools like Hashcat, John the Ripper, Hydra, and Wireshark in fully isolated Kali Linux sandboxes.

## 🌟 Features & Flexibility

- **Fully Sandboxed Terminal:** Every student gets their own isolated Docker container (Kali Linux environment) through an integrated xterm.js browser terminal.
- **Ultra-Fast Local AI Advisor:** An integrated AI mentor (powered by Ollama and lightweight models like `qwen2:0.5b`) provides real-time, dynamic hints and validation without giving away the direct answers.
- **Dynamic Challenges:** The AI generates unique, cryptographically seeded challenges (JSON format) so no two students ever get the exact same exercise.
- **Flexible UI:** A completely resizable Workspace UI allowing students to drag panels to fit their terminal and chat perfectly on any screen size.
- **Automated Validation:** Real-time command parsing validates if students are using the correct tools and flags.

---

## 💻 1. Local Development Setup (For Developers)

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Must be running!)
- [Ollama](https://ollama.com/) (For local AI)
- Git

### Step-by-Step Installation

**1. Clone the repository & Install Frontend**

```bash
git clone <your-repo-url>
cd password-cracking-next
npm install
```

**2. Setup Environment Variables**
Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_domain"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_bucket"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender"
NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"

# AI Configuration (Using the ultra-fast Qwen2 0.5b model)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2:0.5b
```

**3. Setup the AI Model**
Download the ultra-fast, lightweight model that will power the Virtual Mentor:

```bash
ollama pull qwen2:0.5b
```

**4. Setup the Terminal Server (Backend)**
Open a _new_ terminal window and navigate to the terminal server directory:

```bash
cd terminal-server
npm install

# Build the Kali Linux Docker image (Required once!)
docker build -t pcl-lab-image:latest -f Dockerfile.lab .

# Start the terminal server
npm run dev
```

**5. Start the Frontend**
In your original terminal window (root folder):

```bash
npm run dev
```

Visit `http://localhost:3000` to access the lab!

---

## 🚀 2. Server Deployment Guide (For the Senior / IT Admin)

To host this for 1,000+ simultaneous students, the architecture is split into three parts: The Frontend (Vercel), the AI Server (Ollama), and the Terminal Server (Docker/Node.js).

### A. Deploying the Frontend (Vercel)

The frontend code is connected directly to GitHub.

- **Automatic Updates:** Because it is linked to GitHub, **Vercel will automatically update and redeploy the live site every time you push to the `main` branch!** You do not need to do anything manually on Vercel.

### B. Hosting the AI Server (Ollama)

To serve 1000 students, the college server must run Ollama.

1. Install Ollama on the server.
2. Pull the designated lightweight model:
   ```bash
   ollama pull qwen2:0.5b
   ```
3. Expose the Ollama API securely so the frontend can communicate with it, and update the `OLLAMA_URL` environment variable in Vercel to point to your college server's IP/Domain (e.g., `http://college-server-ip:11434`).

### C. Hosting the Docker Machine & Terminal Server

The `terminal-server` is responsible for spawning a new Docker container for every student who connects.

1. Transfer the `terminal-server` folder to the college server.
2. Build the exact Docker image on the college server:
   ```bash
   docker build -t pcl-lab-image:latest -f Dockerfile.lab .
   ```
3. Start the Node.js WebSocket server:
   ```bash
   npm install
   npm run build
   npm run start
   ```
4. **Important for 1000 Students:** By default, the `terminal-server` limits concurrent connections to prevent crashing. To handle 1000 students, you must scale this Node.js process (using PM2 or Kubernetes) across multiple nodes, ensuring the server has enough RAM to support 1000 simultaneous idle Docker containers.

---

### Need Help?

mail: ajjaiahpython@gmail.com or troubleshooting assistance.

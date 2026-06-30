import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import Docker from 'dockerode';
import cors from 'cors';
import url from 'url';

// ── Config from environment ──────────────────────────────────────────────────
const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '50', 10);
const IDLE_TIMEOUT_MS = parseInt(process.env.IDLE_TIMEOUT_MINUTES || '30', 10) * 60 * 1000;
const LAB_IMAGE = 'pcl-lab-image:latest';
const PORT = process.env.PORT || 4000;

// ── App & Server ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Connect to Docker daemon
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// ── Session Tracking ─────────────────────────────────────────────────────────
// userId → { ws, lastActivity }
const activeSessions = new Map<string, { ws: WebSocket; lastActivity: number }>();

// Metrics counters (consumed by Prometheus via /metrics)
let totalConnectionsAccepted = 0;
let totalConnectionsRejected = 0;

// ── Health & Metrics Endpoints ───────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    activeSessions: activeSessions.size,
    maxSessions: MAX_CONCURRENT_SESSIONS,
    uptime: process.uptime(),
  });
});

app.get('/metrics', (_req, res) => {
  // Simple Prometheus-compatible text format
  res.set('Content-Type', 'text/plain');
  res.send([
    `# HELP pcl_active_sessions Current number of active terminal sessions`,
    `# TYPE pcl_active_sessions gauge`,
    `pcl_active_sessions ${activeSessions.size}`,
    `# HELP pcl_total_connections_accepted Total WebSocket connections accepted`,
    `# TYPE pcl_total_connections_accepted counter`,
    `pcl_total_connections_accepted ${totalConnectionsAccepted}`,
    `# HELP pcl_total_connections_rejected Total WebSocket connections rejected (limit)`,
    `# TYPE pcl_total_connections_rejected counter`,
    `pcl_total_connections_rejected ${totalConnectionsRejected}`,
  ].join('\n'));
});

// Admin: list active lab sessions
app.get('/active', async (_req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const labContainers = containers.filter(c => c.Names.some(n => n.includes('pcl-lab-')));

    const sessions = labContainers.map(c => {
      const name = c.Names[0] || '';
      const userId = name.replace('/pcl-lab-', '');
      const session = activeSessions.get(userId);
      return {
        id: c.Id,
        userId,
        status: c.State,
        created: c.Created * 1000,
        image: c.Image,
        wsConnected: !!session,
        idleSinceMs: session ? Date.now() - session.lastActivity : null,
      };
    });

    res.json({ success: true, sessions, activeSessions: activeSessions.size });
  } catch (error: any) {
    console.error('Error listing containers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Image Bootstrap ───────────────────────────────────────────────────────────
async function ensureImageExists(imageName: string) {
  try {
    await docker.getImage(imageName).inspect();
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log(`Image ${imageName} not found. Building from Dockerfile.lab...`);
      await new Promise<void>((resolve, reject) => {
        docker.buildImage(
          { context: __dirname + '/..', src: ['Dockerfile.lab'] },
          { t: imageName, dockerfile: 'Dockerfile.lab' },
          (err: Error | null, stream: NodeJS.ReadableStream | undefined) => {
            if (err) return reject(err);
            if (!stream) return reject(new Error('No build stream returned'));
            docker.modem.followProgress(stream, (err2: Error | null) => {
              if (err2) return reject(err2);
              console.log(`Image ${imageName} built successfully.`);
              resolve();
            }, (event: any) => {
              if (event.stream) process.stdout.write(event.stream);
            });
          }
        );
      });
      return;
    }
    throw error;
  }
}

// ── Container Management ──────────────────────────────────────────────────────
async function getOrCreateContainer(userId: string) {
  const containerName = `pcl-lab-${userId}`;
  try {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();
    if (!info.State.Running) {
      console.log(`Starting existing container ${containerName}...`);
      await container.start();
    }
    return container;
  } catch (e: any) {
    if (e.statusCode === 404) {
      console.log(`Creating new container ${containerName}...`);
      await ensureImageExists(LAB_IMAGE);
      const container = await docker.createContainer({
        Image: LAB_IMAGE,
        name: containerName,
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
        Cmd: ['/bin/bash'],
        HostConfig: {
          AutoRemove: false,
          Memory: 512 * 1024 * 1024,       // 512 MB RAM limit
          NanoCpus: 500_000_000,            // 0.5 CPU limit
          PidsLimit: 100,                   // max 100 processes per container
          NetworkMode: 'none',              // no outbound network (security)
        },
      });
      await container.start();
      return container;
    }
    throw e;
  }
}

// ── Idle Container Cleanup ────────────────────────────────────────────────────
// Every 5 minutes, stop containers whose WebSocket has been idle > IDLE_TIMEOUT_MS
setInterval(async () => {
  const now = Date.now();
  for (const [userId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > IDLE_TIMEOUT_MS) {
      console.log(`[Idle Cleanup] Session for ${userId} idle > ${IDLE_TIMEOUT_MS / 60000}min. Closing.`);
      session.ws.terminate();
      activeSessions.delete(userId);

      // Stop (don't remove) the container so it resumes next session
      try {
        const containerName = `pcl-lab-${userId}`;
        const container = docker.getContainer(containerName);
        await container.stop({ t: 5 });
        console.log(`[Idle Cleanup] Stopped container ${containerName}`);
      } catch (err: any) {
        console.warn(`[Idle Cleanup] Could not stop container for ${userId}:`, err.message);
      }
    }
  }
}, 5 * 60 * 1000);

// ── WebSocket Handler ─────────────────────────────────────────────────────────
wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
  const parsedUrl = url.parse(req.url || '', true);
  const userId = parsedUrl.query.userId as string;

  if (!userId) {
    ws.send('Error: userId is required\r\n');
    ws.close();
    return;
  }

  // ── Enforce concurrent session cap ────────────────────────────────────────
  // If this user already has a session, reuse it (reconnect scenario)
  if (!activeSessions.has(userId) && activeSessions.size >= MAX_CONCURRENT_SESSIONS) {
    totalConnectionsRejected++;
    ws.send(
      `\r\n\x1b[31m[System] Lab capacity reached (${MAX_CONCURRENT_SESSIONS} concurrent sessions). ` +
      `Please try again in a few minutes.\x1b[0m\r\n`
    );
    ws.close();
    return;
  }

  totalConnectionsAccepted++;
  console.log(`[WS] Client connected — userId: ${userId} | active: ${activeSessions.size + 1}/${MAX_CONCURRENT_SESSIONS}`);

  try {
    ws.send(`\r\n\x1b[33m[System] Initializing isolated container for user ${userId}...\x1b[0m\r\n`);
    const container = await getOrCreateContainer(userId);

    // Create an exec session for bash
    const exec = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ['/bin/bash'],
    });

    const stream = await exec.start({ hijack: true, stdin: true });

    // Register session
    activeSessions.set(userId, { ws, lastActivity: Date.now() });

    ws.send(`\x1b[32m[System] Container ready. Welcome to your sandboxed lab!\x1b[0m\r\n`);
    stream.write('echo "Welcome to the Password Cracking Lab Sandbox!" && cd /home/operator && ls -la\n');

    // Client → Container
    ws.on('message', (msg) => {
      // Update last activity on each message (debounce idle timer)
      const session = activeSessions.get(userId);
      if (session) session.lastActivity = Date.now();
      stream.write(msg.toString());
    });

    // Container → Client
    (stream as any).on('data', (chunk: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk.toString('utf-8'));
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected — userId: ${userId}`);
      activeSessions.delete(userId);
      (stream as any).end();
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for user ${userId}:`, err.message);
      activeSessions.delete(userId);
    });

  } catch (error: any) {
    console.error('[WS] Error setting up terminal:', error);
    ws.send(`\r\n\x1b[31m[Error] Failed to initialize container: ${error.message}\x1b[0m\r\n`);
    activeSessions.delete(userId);
    ws.close();
  }
});

// ── Start Server ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Terminal WebSocket server listening on port ${PORT}`);
  console.log(`Max concurrent sessions: ${MAX_CONCURRENT_SESSIONS}`);
  console.log(`Idle timeout: ${IDLE_TIMEOUT_MS / 60000} minutes`);
});

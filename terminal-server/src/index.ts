import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import Docker from 'dockerode';
import cors from 'cors';
import url from 'url';

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Connect to the local Docker daemon
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// We'll use a standard image, let's say 'ubuntu:latest' for now.
// In a real environment, this could be a custom image with cracking tools pre-installed.
const LAB_IMAGE = 'pcl-lab-image:latest';

async function ensureImageExists(imageName: string) {
  try {
    await docker.getImage(imageName).inspect();
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log(`Image ${imageName} not found locally. Building from Dockerfile.lab...`);
      return new Promise<void>((resolve, reject) => {
        docker.buildImage({
          context: __dirname + '/..',
          src: ['Dockerfile.lab']
        }, { t: imageName, dockerfile: 'Dockerfile.lab' }, (err: Error | null, stream: NodeJS.ReadableStream | undefined) => {
          if (err) return reject(err);
          if (!stream) return reject(new Error('No build stream returned'));
          
          docker.modem.followProgress(stream, onFinished, onProgress);
          function onFinished(err: Error | null, output: any) {
            if (err) return reject(err);
            console.log(`Image ${imageName} built successfully.`);
            resolve();
          }
          function onProgress(event: any) {
            if (event.stream) process.stdout.write(event.stream);
          }
        });
      });
    }
    throw error;
  }
}

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
          // Limit resources slightly
          Memory: 512 * 1024 * 1024, // 512MB
        }
      });
      await container.start();
      return container;
    }
    throw e;
  }
}

wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
  const parsedUrl = url.parse(req.url || '', true);
  const userId = parsedUrl.query.userId as string;

  if (!userId) {
    ws.send('Error: userId is required\r\n');
    ws.close();
    return;
  }

  console.log(`Client connected for user: ${userId}`);

  try {
    ws.send(`\r\n\x1b[33m[System] Initializing isolated container for user ${userId}...\x1b[0m\r\n`);
    const container = await getOrCreateContainer(userId);
    
    // Create an exec instance for bash
    const exec = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ['/bin/bash']
    });

    const stream = await exec.start({ hijack: true, stdin: true });
    
    ws.send(`\x1b[32m[System] Container ready. Attached to terminal.\x1b[0m\r\n`);
    
    // Send a welcome message in bash
    stream.write('echo "Welcome to the Password Cracking Lab Sandbox!" && cd /root && ls -la\n');

    ws.on('message', (msg) => {
      // Forward user input to container
      stream.write(msg.toString());
    });

    // We can't type stream as NodeJS.ReadWriteStream safely because dockerode types are a bit weird here, 
    // but it functions as a duplex stream.
    (stream as any).on('data', (chunk: any) => {
      // Forward container output to user
      ws.send(chunk.toString('utf-8'));
    });

    ws.on('close', () => {
      console.log(`Client disconnected for user: ${userId}`);
      (stream as any).end();
    });

  } catch (error: any) {
    console.error('Error setting up terminal:', error);
    ws.send(`\r\n\x1b[31m[Error] Failed to initialize container: ${error.message}\x1b[0m\r\n`);
    ws.close();
  }
});

// Admin endpoint to get active lab sessions
app.get('/active', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const labContainers = containers.filter(c => c.Names.some(n => n.includes('pcl-lab-')));
    
    const activeSessions = labContainers.map(c => {
      // Extract userId from container name (e.g., "/pcl-lab-user123")
      const name = c.Names[0] || '';
      const userId = name.replace('/pcl-lab-', '');
      return {
        id: c.Id,
        userId,
        status: c.State,
        created: c.Created * 1000,
        image: c.Image
      };
    });
    
    res.json({ success: true, sessions: activeSessions });
  } catch (error: any) {
    console.error('Error listing containers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Terminal WebSocket server listening on port ${PORT}`);
});

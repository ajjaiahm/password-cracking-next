"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useAuth } from '@/context/AuthContext';
import { useLab } from '@/context/LabContext';
import { ChevronDown, ChevronUp, Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';
import { useTheme } from 'next-themes';

export function TerminalSimulator({ height }: { height?: number }) {
  const { user } = useAuth();
  const { expectedSection, onCommandExecutedSuccess } = useLab();
  const { resolvedTheme } = useTheme();
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const wsInstance = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const outputBuffer = useRef<string>('');
  
  // Use a ref to prevent stale closures in websocket events
  const expectedSectionRef = useRef(expectedSection);
  useEffect(() => {
    expectedSectionRef.current = expectedSection;
  }, [expectedSection]);
  
  const onCommandExecutedSuccessRef = useRef(onCommandExecutedSuccess);
  useEffect(() => {
    onCommandExecutedSuccessRef.current = onCommandExecutedSuccess;
  }, [onCommandExecutedSuccess]);

  useEffect(() => {
    if (!user || !terminalRef.current) return;

    let term: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let ws: WebSocket | null = null;
    let isDisposed = false;
    let reconnectTimeoutId: NodeJS.Timeout;
    let reconnectAttempts = 0;

    const connectWebSocket = () => {
      if (isDisposed) return;
      
      setStatus('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const hostName = window.location.hostname;
      const isDevServer = process.env.NODE_ENV === 'development';
      const wsUrl = isDevServer 
        ? `ws://${hostName}:4000/?userId=${user.uid}`
        : `${protocol}//${host}/api/terminal/?userId=${user.uid}`;
        
      ws = new WebSocket(wsUrl);
      wsInstance.current = ws;

      ws.onopen = () => {
        if (ws !== wsInstance.current) return;
        setStatus('connected');
        reconnectAttempts = 0;
      };
      
      ws.onclose = () => {
        if (ws !== wsInstance.current) return;
        setStatus('disconnected');
        
        if (!isDisposed) {
          const timeout = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
          reconnectAttempts++;
          termInstance.current?.write(`\r\n\x1b[33m[System] Disconnected. Reconnecting in ${Math.round(timeout/1000)}s...\x1b[0m\r\n`);
          reconnectTimeoutId = setTimeout(connectWebSocket, timeout);
        }
      };
      
      ws.onmessage = (event) => {
        if (ws !== wsInstance.current) return;
        
        const processText = (text: string) => {
          termInstance.current?.write(text);
          const currentExpectedSection = expectedSectionRef.current;
          if (!currentExpectedSection || !currentExpectedSection.command) return;
          
          // Strip ANSI escape sequences to get raw text
          const cleanText = text.replace(/\x1b\[[0-9;]*[a-zA-ZK]/g, '').replace(/\x1b/g, '');
          outputBuffer.current += cleanText;
          
          if (outputBuffer.current.length > 2048) {
            outputBuffer.current = outputBuffer.current.slice(-2048);
          }
          
          const normalizedBuffer = outputBuffer.current.replace(/\s+/g, ' ');
          const expected = currentExpectedSection.command.trim().replace(/\s+/g, ' ');
          
          if (normalizedBuffer.includes(expected)) {
            onCommandExecutedSuccessRef.current();
            outputBuffer.current = '';
          }
        };

        if (typeof event.data === 'string') {
          processText(event.data);
        } else {
          event.data.text().then(processText);
        }
      };
    };

    const initTerminal = () => {
      if (termInstance.current || !terminalRef.current) return;
      if (terminalRef.current.clientWidth === 0) {
        setTimeout(initTerminal, 100);
        return;
      }
      
      term = new Terminal({
        cursorBlink: true,
        theme: {
          background: resolvedTheme === 'light' ? '#ffffff' : '#18181b',
          foreground: resolvedTheme === 'light' ? '#18181b' : '#e4e4e7',
          cursor: '#3b82f6',
          cursorAccent: resolvedTheme === 'light' ? '#ffffff' : '#18181b',
          selectionBackground: 'rgba(59, 130, 246, 0.3)',
        },
        fontFamily: 'monospace',
        fontSize: 13,
      });
      
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      
      setTimeout(() => {
        if (isDisposed) return;
        try {
          if (term?.element && term.element.clientWidth > 0) {
            fitAddon?.fit();
          }
        } catch (e) {
          console.warn('Initial fit warning:', e);
        }
      }, 100);
      
      termInstance.current = term;
      fitAddonRef.current = fitAddon;

      term.onData((data) => {
        if (wsInstance.current?.readyState === WebSocket.OPEN) {
          wsInstance.current.send(JSON.stringify({ type: 'data', payload: data }));
        }
      });

      term.onResize(({ cols, rows }) => {
        if (wsInstance.current?.readyState === WebSocket.OPEN) {
          wsInstance.current.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });

      // Listen for run-command events dispatched from LabViewer
      const handleRunCommand = (e: Event) => {
        const cmd = (e as CustomEvent).detail?.command;
        if (cmd && wsInstance.current?.readyState === WebSocket.OPEN) {
          wsInstance.current.send(JSON.stringify({ type: 'data', payload: cmd + '\r' }));
        }
      };
      window.addEventListener('run-command', handleRunCommand);
      (term as any)._cleanupRunCommand = () => window.removeEventListener('run-command', handleRunCommand);
      
      
      connectWebSocket();
    };

    // Initialize immediately instead of waiting for ResizeObserver
    initTerminal();

    const resizeObserver = new ResizeObserver(() => {
      if (isDisposed) return;
      try {
        if (termInstance.current?.element && termInstance.current.element.clientWidth > 0) {
          fitAddonRef.current?.fit();
        }
      } catch (e) {}
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      isDisposed = true;
      clearTimeout(reconnectTimeoutId);
      resizeObserver.disconnect();
      if (ws) ws.close();
      if (fitAddonRef.current) fitAddonRef.current.dispose();
      if (termInstance.current) termInstance.current.dispose();
      termInstance.current = null;
      fitAddonRef.current = null;
      wsInstance.current = null;
    };
  }, [user]);

  // Helper to keep lab progress functioning
  const checkCommandAgainstLab = (cmd: string) => {
    // Note: Replaced by outputBuffer logic inside term.onData
  };

  useEffect(() => {
    if (termInstance.current) {
      termInstance.current.options.theme = {
        background: resolvedTheme === 'light' ? '#ffffff' : '#18181b',
        foreground: resolvedTheme === 'light' ? '#18181b' : '#e4e4e7',
        cursor: '#3b82f6',
        cursorAccent: resolvedTheme === 'light' ? '#ffffff' : '#18181b',
        selectionBackground: 'rgba(59, 130, 246, 0.3)',
      };
    }
  }, [resolvedTheme]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isExpanded && fitAddonRef.current) {
      timeoutId = setTimeout(() => {
        try {
          if (termInstance.current?.element && termInstance.current.element.clientWidth > 0) {
            fitAddonRef.current?.fit();
          }
        } catch (e) {}
      }, 100);
    }
    return () => clearTimeout(timeoutId);
  }, [isExpanded]);

  return (
    <div 
      className={`flex flex-col border-t border-border-primary bg-terminal-bg transition-all duration-300 ease-in-out ${isExpanded ? 'flex-1 md:flex-none' : 'h-10 shrink-0'}`}
      style={isExpanded && height ? { height } : undefined}
    >
      {/* Header */}
      <div 
        className="h-10 px-4 border-b border-border-primary bg-bg-panel flex items-center justify-between cursor-pointer hover:bg-bg-secondary transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-accent-blue" />
          <h2 className="text-xs font-mono font-medium tracking-wide text-text-primary uppercase">
            Lab Terminal
          </h2>
          <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
            status === 'connected' ? 'bg-accent-blue/20 text-accent-blue' : 
            status === 'connecting' ? 'bg-amber-500/20 text-amber-500' : 
            'bg-red-500/20 text-red-500'
          }`}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          {isExpanded ? <Minimize2 className="w-4 h-4 hover:text-text-primary" /> : <Maximize2 className="w-4 h-4 hover:text-text-primary" />}
          {isExpanded ? <ChevronDown className="w-4 h-4 hover:text-text-primary" /> : <ChevronUp className="w-4 h-4 hover:text-text-primary" />}
        </div>
      </div>

      {/* Terminal Container */}
      <div className={isExpanded ? "relative flex-1 bg-terminal-bg overflow-hidden p-2 opacity-100" : "fixed -top-[9999px] -left-[9999px] w-[800px] h-[600px] opacity-0 pointer-events-none"}>
        {!user && (
          <div className="absolute inset-0 flex items-center justify-center bg-terminal-bg z-10">
            <p className="text-text-muted font-mono text-sm">Please login to access the terminal.</p>
          </div>
        )}
        <div 
          ref={terminalRef} 
          className="w-full h-full"
        />
      </div>
    </div>
  );
}

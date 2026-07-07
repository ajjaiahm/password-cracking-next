"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useAuth } from '@/context/AuthContext';
import { useLab } from '@/context/LabContext';
import { ChevronDown, ChevronUp, Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';

export function TerminalSimulator() {
  const { user } = useAuth();
  const { expectedSection, onCommandExecutedSuccess } = useLab();
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const wsInstance = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const commandBuffer = useRef<string>('');

  useEffect(() => {
    if (!user || !terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#09090b',
        foreground: '#a1a1aa',
        cursor: '#10b981',
      },
      fontFamily: 'monospace',
      fontSize: 13,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    setTimeout(() => {
      try {
        if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
          fitAddon.fit();
        }
      } catch (e) {
        console.warn("xterm fit warning:", e);
      }
    }, 10);
    
    termInstance.current = term;
    fitAddonRef.current = fitAddon;

    setStatus('connecting');

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // This handles both port 8080 (nginx) and port 3000 (next dev, though API proxy won't work there unless Next.js rewrites it)
    
    // Fallback to localhost:4000 if we are running the Next.js dev server without Nginx
    const isDevServer = window.location.port === '3000';
    const wsUrl = isDevServer 
      ? `ws://localhost:4000/?userId=${user.uid}`
      : `${protocol}//${host}/api/terminal/?userId=${user.uid}`;
      
    const ws = new WebSocket(wsUrl);
    wsInstance.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else {
        // Blob to text
        event.data.text().then((text: string) => term.write(text));
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      term.write('\r\n\x1b[31m[System] Disconnected from lab server.\x1b[0m\r\n');
    };

    // Handle user input
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
      
      // Simple command tracking for lab progression
      if (data === '\r') {
        const cmd = commandBuffer.current.trim();
        checkCommandAgainstLab(cmd);
        commandBuffer.current = '';
      } else if (data === '\x7f') { // Backspace
        commandBuffer.current = commandBuffer.current.slice(0, -1);
      } else if (data >= ' ' && data <= '~') {
        commandBuffer.current += data;
      }
    });

    const handleResize = () => {
      try {
        if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
          fitAddon.fit();
        }
      } catch (e) {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [user]);

  // Helper to keep lab progress functioning
  const checkCommandAgainstLab = (cmd: string) => {
    if (!expectedSection || !expectedSection.command) return;
    
    // Very basic semantic match
    const expected = expectedSection.command.trim().toLowerCase().split(/\s+/);
    const actual = cmd.trim().toLowerCase().split(/\s+/);
    
    if (actual.length >= expected.length && actual[0] === expected[0]) {
      // Check if all expected tokens are in the actual command
      const isMatch = expected.every(token => actual.includes(token));
      if (isMatch) {
        onCommandExecutedSuccess();
      }
    }
  };

  useEffect(() => {
    if (isExpanded && fitAddonRef.current) {
      setTimeout(() => {
        try {
          if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
            fitAddonRef.current?.fit();
          }
        } catch (e) {}
      }, 50);
    }
  }, [isExpanded]);

  return (
    <div className={`flex flex-col border-t border-zinc-800 bg-zinc-950 transition-all duration-300 ease-in-out ${isExpanded ? 'flex-1 md:flex-none md:h-1/2' : 'h-10'}`}>
      {/* Header */}
      <div 
        className="h-10 px-4 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-500" />
          <h2 className="text-xs font-mono font-medium tracking-wide text-zinc-300 uppercase">
            Lab Terminal
          </h2>
          <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
            status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 
            status === 'connecting' ? 'bg-amber-500/20 text-amber-400' : 
            'bg-red-500/20 text-red-400'
          }`}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-1 text-zinc-500">
          {isExpanded ? <Minimize2 className="w-4 h-4 hover:text-zinc-300" /> : <Maximize2 className="w-4 h-4 hover:text-zinc-300" />}
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </div>

      {/* Terminal Container */}
      <div className={`relative flex-1 bg-[#09090b] overflow-hidden p-2 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none h-0'}`}>
        {!user && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-10">
            <p className="text-zinc-500 font-mono text-sm">Please login to access the terminal.</p>
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

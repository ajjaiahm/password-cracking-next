"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useAuth } from '@/context/AuthContext';
import { useLab } from '@/context/LabContext';
import { ChevronDown, ChevronUp, Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';

export function TerminalSimulator({ height }: { height?: number }) {
  const { user } = useAuth();
  const { expectedSection, onCommandExecutedSuccess } = useLab();
  
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
    let initialized = false;
    let isDisposed = false;

    const initTerminal = () => {
      if (initialized || !terminalRef.current) return;
      
      initialized = true;

      term = new Terminal({
        cursorBlink: true,
        theme: {
          background: '#000000',
          foreground: '#a1a1aa',
          cursor: '#3b82f6',
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
          if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
            fitAddon?.fit();
          }
        } catch (e) {
          console.warn('Initial fit warning:', e);
        }
      }, 50);
      
      termInstance.current = term;
      fitAddonRef.current = fitAddon;

      setStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const isDevServer = window.location.port === '3000';
      const wsUrl = isDevServer 
        ? `ws://localhost:4000/?userId=${user.uid}`
        : `${protocol}//${host}/api/terminal/?userId=${user.uid}`;
        
      ws = new WebSocket(wsUrl);
      wsInstance.current = ws;

      ws.onopen = () => {
        if (ws !== wsInstance.current) return;
        setStatus('connected');
      };
      
      ws.onclose = () => {
        if (ws !== wsInstance.current) return;
        setStatus('disconnected');
        termInstance.current?.write('\r\n\x1b[31m[System] Disconnected from lab server.\x1b[0m\r\n');
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

      term.onData((data) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    };

    // Initialize immediately instead of waiting for ResizeObserver
    initTerminal();

    const resizeObserver = new ResizeObserver(() => {
      if (isDisposed) return;
      try {
        if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
          fitAddon?.fit();
        }
      } catch (e) {}
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      isDisposed = true;
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
    let timeoutId: NodeJS.Timeout;
    if (isExpanded && fitAddonRef.current) {
      timeoutId = setTimeout(() => {
        try {
          if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
            fitAddonRef.current?.fit();
          }
        } catch (e) {}
      }, 50);
    }
    return () => clearTimeout(timeoutId);
  }, [isExpanded]);

  return (
    <div 
      className={`flex flex-col border-t border-[#262626] bg-black transition-all duration-300 ease-in-out ${isExpanded ? 'flex-1 md:flex-none' : 'h-10 shrink-0'}`}
      style={isExpanded && height ? { height } : undefined}
    >
      {/* Header */}
      <div 
        className="h-10 px-4 border-b border-[#262626]/80 bg-[#171717]/50 flex items-center justify-between cursor-pointer hover:bg-[#262626]/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-blue-500" />
          <h2 className="text-xs font-mono font-medium tracking-wide text-gray-300 uppercase">
            Lab Terminal
          </h2>
          <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
            status === 'connected' ? 'bg-blue-900/40 text-blue-400' : 
            status === 'connecting' ? 'bg-blue-500/20 text-blue-400' : 
            'bg-red-500/20 text-red-400'
          }`}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          {isExpanded ? <Minimize2 className="w-4 h-4 hover:text-gray-300" /> : <Maximize2 className="w-4 h-4 hover:text-gray-300" />}
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </div>

      {/* Terminal Container */}
      <div className={isExpanded ? "relative flex-1 bg-[#000000] overflow-hidden p-2 opacity-100" : "fixed -top-[9999px] -left-[9999px] w-[800px] h-[600px] opacity-0 pointer-events-none"}>
        {!user && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <p className="text-gray-400 font-mono text-sm">Please login to access the terminal.</p>
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

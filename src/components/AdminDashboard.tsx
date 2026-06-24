"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ShieldAlert, Users, Server, ChevronLeft, RefreshCw, Activity, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HackerBackground } from './HackerBackground';

interface UserData {
  uid: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  onboardingComplete: boolean;
  createdAt: string;
}

interface SessionData {
  id: string;
  userId: string;
  status: string;
  created: number;
  image: string;
}

export function AdminDashboard() {
  const { isMockMode } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'sessions'>('users');
  const [users, setUsers] = useState<UserData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      if (isMockMode) {
        const storedUsers = localStorage.getItem('password_lab_mock_users');
        const rawUsers = storedUsers ? JSON.parse(storedUsers) : [];
        const loadedUsers = rawUsers.map((u: any) => {
          const profileRaw = localStorage.getItem(`password_lab_mock_profile_${u.uid}`);
          const profile = profileRaw ? JSON.parse(profileRaw) : {};
          return {
            uid: u.uid,
            email: u.email,
            name: u.name,
            isAdmin: profile.isAdmin || false,
            onboardingComplete: profile.onboardingComplete || false,
            createdAt: profile.createdAt || new Date().toISOString()
          };
        });
        setUsers(loadedUsers);
      } else {
        const snap = await getDocs(collection(db, 'users'));
        const loadedUsers = snap.docs.map(doc => doc.data() as UserData);
        setUsers(loadedUsers);
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    }
  };

  const fetchSessions = async () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = window.location.host;
      const isDevServer = window.location.port === '3000';
      const apiUrl = isDevServer ? `http://localhost:4000/active` : `${protocol}//${host}/api/terminal/active`;
      
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSessions(data.sessions);
        }
      }
    } catch (e) {
      console.error("Failed to fetch active sessions", e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchSessions()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative overflow-hidden">
      <HackerBackground />
      
      {/* Header */}
      <header className="relative z-10 border-b border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/workspace')}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">Admin Control Center</h1>
          </div>
        </div>
        <button 
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded font-mono text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col gap-6">
        
        {/* Tabs */}
        <div className="flex border-b border-zinc-800 font-mono text-sm">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'users' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'}`}
          >
            <Users className="w-4 h-4" />
            Registered Users ({users.length})
          </button>
          <button 
            onClick={() => setActiveTab('sessions')}
            className={`px-6 py-3 border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'sessions' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'}`}
          >
            <Server className="w-4 h-4" />
            Active Lab Containers ({sessions.length})
          </button>
        </div>

        {/* Tab Content */}
        {loading && users.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Activity className="w-8 h-8 text-amber-500/50 animate-pulse" />
          </div>
        ) : (
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden backdrop-blur-md">
            {activeTab === 'users' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-800/30 font-mono text-xs text-zinc-400 uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium">Onboarded</th>
                    <th className="px-6 py-4 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono divide-y divide-zinc-800/50">
                  {users.map(u => (
                    <tr key={u.uid} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4 text-zinc-200">{u.name}</td>
                      <td className="px-6 py-4 text-zinc-400">{u.email}</td>
                      <td className="px-6 py-4">
                        {u.isAdmin ? (
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-bold tracking-wide">ADMIN</span>
                        ) : (
                          <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs tracking-wide">USER</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.onboardingComplete ? (
                          <span className="text-emerald-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Yes</span>
                        ) : (
                          <span className="text-zinc-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-zinc-600" /> No</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-zinc-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-800/30 font-mono text-xs text-zinc-400 uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Container ID</th>
                    <th className="px-6 py-4 font-medium">User ID</th>
                    <th className="px-6 py-4 font-medium">Image</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Uptime</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono divide-y divide-zinc-800/50">
                  {sessions.map(s => {
                    const user = users.find(u => u.uid === s.userId);
                    return (
                      <tr key={s.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-6 py-4 text-zinc-400 flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-zinc-500" />
                          {s.id.substring(0, 12)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-zinc-200">{s.userId}</div>
                          {user && <div className="text-xs text-emerald-500">{user.email}</div>}
                        </td>
                        <td className="px-6 py-4 text-zinc-400">{s.image}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold tracking-wide \${s.status === 'running' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-500">
                          {new Date(s.created).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  {sessions.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No active container sessions found.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

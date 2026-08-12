"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  collection, getDocs, query, orderBy, limit, startAfter,
  QueryDocumentSnapshot, DocumentData
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  ShieldAlert, Users, Server, ChevronLeft, RefreshCw,
  Activity, Terminal, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AntigravityBackground } from './AntigravityBackground';

const PAGE_SIZE = 50;

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Firestore cursor for pagination
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const fetchUsers = useCallback(async (reset = true) => {
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
            createdAt: profile.createdAt || new Date().toISOString(),
          };
        });
        setUsers(loadedUsers);
        setHasMore(false);
      } else {
        // Paginated Firestore query — 50 users per page
        const baseQuery = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE)
        );
        const paginatedQuery = (!reset && lastDoc)
          ? query(collection(db, 'users'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE))
          : baseQuery;

        const snap = await getDocs(paginatedQuery);
        const loadedUsers = snap.docs.map(d => d.data() as UserData);

        if (reset) {
          setUsers(loadedUsers);
        } else {
          setUsers(prev => [...prev, ...loadedUsers]);
        }

        setHasMore(snap.docs.length === PAGE_SIZE);
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      }
    } catch (e) {
      console.error('Failed to fetch users', e);
    }
  }, [isMockMode, lastDoc]);

  const fetchSessions = async () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = window.location.host;
      const isDevServer = window.location.port === '3000';
      const apiUrl = isDevServer
        ? 'http://localhost:4000/active'
        : `${protocol}//${host}/api/terminal/active`;

      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setSessions(data.sessions);
      }
    } catch (e) {
      console.error('Failed to fetch active sessions', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setLastDoc(null);
    await Promise.all([fetchUsers(true), fetchSessions()]);
    setLoading(false);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchUsers(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col relative overflow-hidden">
      <AntigravityBackground />

      {/* Header */}
      <header className="relative z-10 border-b border-border-primary/80 bg-bg-panel/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/workspace')}
            className="p-2 hover:bg-border-primary rounded-lg transition-colors text-text-muted hover:text-text-primary"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold tracking-tight text-text-primary font-mono">Admin Control Center</h1>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-900/40 text-blue-400 border border-blue-500/20 rounded font-mono text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col gap-6">

        {/* Tabs */}
        <div className="flex border-b border-border-primary font-mono text-sm">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'users' ? 'border-blue-400 text-amber-400' : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-primary'}`}
          >
            <Users className="w-4 h-4" />
            Registered Users ({users.length}{hasMore ? '+' : ''})
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-6 py-3 border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'sessions' ? 'border-blue-400 text-amber-400' : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-primary'}`}
          >
            <Server className="w-4 h-4" />
            Active Lab Containers ({sessions.length})
          </button>
        </div>

        {/* Tab Content */}
        {loading && users.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Activity className="w-8 h-8 text-blue-400/50 animate-pulse" />
          </div>
        ) : (
          <>
            <div className="bg-bg-panel/60 border border-border-primary/80 rounded-xl overflow-hidden backdrop-blur-md">
              {activeTab === 'users' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-primary bg-bg-secondary/30 font-mono text-xs text-text-muted uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium">Email</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Onboarded</th>
                      <th className="px-6 py-4 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-mono divide-y divide-bg-secondary/50">
                    {users.map(u => (
                      <tr key={u.uid} className="hover:bg-bg-secondary/20 transition-colors">
                        <td className="px-6 py-4 text-text-primary">{u.name}</td>
                        <td className="px-6 py-4 text-text-muted">{u.email}</td>
                        <td className="px-6 py-4">
                          {u.isAdmin ? (
                            <span className="px-2 py-1 bg-blue-500/20 text-amber-400 rounded text-xs font-bold tracking-wide">ADMIN</span>
                          ) : (
                            <span className="px-2 py-1 bg-bg-secondary text-text-muted rounded text-xs tracking-wide">USER</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {u.onboardingComplete ? (
                            <span className="text-blue-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-600" /> Yes</span>
                          ) : (
                            <span className="text-text-muted flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-bg-secondary" /> No</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-text-muted">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-text-muted">No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-primary bg-bg-secondary/30 font-mono text-xs text-text-muted uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Container ID</th>
                      <th className="px-6 py-4 font-medium">User ID</th>
                      <th className="px-6 py-4 font-medium">Image</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-mono divide-y divide-bg-secondary/50">
                    {sessions.map(s => {
                      const user = users.find(u => u.uid === s.userId);
                      return (
                        <tr key={s.id} className="hover:bg-bg-secondary/20 transition-colors">
                          <td className="px-6 py-4 text-text-muted flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-text-muted" />
                            {s.id.substring(0, 12)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-text-primary">{s.userId}</div>
                            {user && <div className="text-xs text-blue-500">{user.email}</div>}
                          </td>
                          <td className="px-6 py-4 text-text-muted">{s.image}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold tracking-wide ${s.status === 'running' ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-500/20 text-amber-400'}`}>
                              {s.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-text-muted">
                            {new Date(s.created).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {sessions.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-text-muted">No active container sessions found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination — only shown on Users tab in live mode */}
            {activeTab === 'users' && hasMore && (
              <div className="flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2 bg-bg-secondary hover:bg-border-primary text-text-secondary border border-border-primary rounded font-mono text-sm transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  Load More ({users.length} loaded)
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

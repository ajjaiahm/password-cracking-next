"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Trophy, X as XIcon, User as UserIcon, Medal, Coins } from 'lucide-react';
import { collection, getDocs, doc, getDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  xp: number;
  coins: number;
  rank: number;
}

// Module-level cache — survives component remounts, resets after 60s
let cachedEntries: LeaderboardEntry[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

export function Leaderboard({ onClose }: { onClose: () => void }) {
  const { isMockMode } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>(cachedEntries ?? []);
  const [loading, setLoading] = useState(!cachedEntries || Date.now() - cacheTimestamp > CACHE_TTL_MS);

  useEffect(() => {
    // Use cached data if still fresh
    if (cachedEntries && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      setEntries(cachedEntries);
      setLoading(false);
      return;
    }

    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        let results: LeaderboardEntry[] = [];

        if (isMockMode) {
          const storedUsers = localStorage.getItem('password_lab_mock_users');
          if (storedUsers) {
            const users = JSON.parse(storedUsers);
            results = users.map((u: any) => {
              const progressStr = localStorage.getItem(`password_lab_progress_mock_${u.uid}`);
              const progress = progressStr ? JSON.parse(progressStr) : { xp: 0, coins: 0 };
              return {
                id: u.uid,
                name: u.name || u.email.split('@')[0],
                email: u.email,
                xp: progress.xp || 0,
                coins: progress.coins || 0,
                rank: 0,
              };
            });
          }
        } else {
          try {
            // Fetch all user docs
            const usersSnap = await getDocs(collection(db, 'users'));

            // Fetch all progress docs IN PARALLEL — O(n) but concurrent, not serial
            const progressPromises = usersSnap.docs.map(userDoc =>
              getDoc(doc(db, 'users', userDoc.id, 'progress', 'state'))
                .then(progressSnap => ({
                  userDoc,
                  progressSnap,
                }))
                .catch(() => ({ userDoc, progressSnap: null })) // Never fail the whole batch
            );

            const resolved = await Promise.all(progressPromises);

            results = resolved.map(({ userDoc, progressSnap }) => {
              const profile = userDoc.data();
              const email = profile.email || userDoc.id;
              const name = profile.name || email.split('@')[0];
              let xp = 0, coins = 0;
              if (progressSnap?.exists()) {
                const p = progressSnap.data();
                xp = p.xp || 0;
                coins = p.coins || 0;
              }
              return { id: userDoc.id, name, email, xp, coins, rank: 0 };
            });
          } catch (err) {
            console.error('Error querying Firestore leaderboard:', err);
            results = [
              { id: 'usr_1a2b3c', name: 'ProHacker', email: 'pro_hacker@example.com', xp: 2500, coins: 450, rank: 0 },
              { id: 'usr_4d5e6f', name: 'SecStudent', email: 'sec_student@example.com', xp: 1200, coins: 200, rank: 0 },
              { id: 'usr_7g8h9i', name: 'GuestAuditor', email: 'guest_auditor@example.com', xp: 850, coins: 120, rank: 0 },
            ];
          }
        }

        // Sort by coins descending, assign ranks, cap at top 25
        results.sort((a, b) => b.coins - a.coins);
        results = results.slice(0, 25).map((entry, idx) => ({ ...entry, rank: idx + 1 }));

        // Cache the result
        cachedEntries = results;
        cacheTimestamp = Date.now();
        setEntries(results);
      } catch (err) {
        console.error('Error fetching leaderboard', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [isMockMode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-mono font-bold text-zinc-100 uppercase tracking-wider">Leaderboard</h2>
              <p className="text-[10px] text-zinc-500 font-mono">
                Top 25 operators · refreshes every 60s
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 font-mono text-xs">
              No operators found on the network.
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded flex items-center justify-center font-bold font-mono text-xs
                      ${entry.rank === 1 ? 'bg-amber-950/50 border border-amber-500/50 text-amber-400' :
                        entry.rank === 2 ? 'bg-zinc-300/10 border border-zinc-300/30 text-zinc-300' :
                        entry.rank === 3 ? 'bg-orange-950/50 border border-orange-700/50 text-orange-400' :
                        'bg-zinc-900 border border-zinc-800 text-zinc-500'
                      }`}
                    >
                      #{entry.rank}
                    </div>
                    <div>
                      <div className="font-mono text-xs text-zinc-200">{entry.name}</div>
                      <div className="font-mono text-[10px] text-zinc-500">
                        ID: {entry.id.slice(0, 12)} | {entry.xp} XP
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-500">
                    <Coins className="w-4 h-4" />
                    {entry.coins}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

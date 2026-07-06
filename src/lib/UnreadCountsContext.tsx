/**
 * UnreadCountsContext
 *
 * Provides live unread badge counts for:
 *   - notifications  (bell icon, Notifications tab)
 *   - messages       (Messages tab)
 *
 * Architecture:
 *   1. Fetch initial counts on mount.
 *   2. Subscribe to Supabase Realtime for INSERT on `notifications`
 *      and INSERT on `messages` — increment counts immediately without re-fetch.
 *   3. Expose `markNotifsRead` / `markMessagesRead` to reset counts
 *      when the user opens those screens.
 */

import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import {
  countUnreadNotifications,
  countUnreadMessages,
  markNotificationsRead as dbMarkNotifsRead,
  markMessagesRead    as dbMarkMessagesRead,
} from './supabase';
import { supabase } from './supabase';

interface UnreadCounts {
  notifCount:         number;
  messageCount:       number;
  markNotifsRead:     () => void;
  markMessagesRead:   (conversationId: string) => void;
}

const Ctx = createContext<UnreadCounts>({
  notifCount: 0, messageCount: 0,
  markNotifsRead: () => {}, markMessagesRead: () => {},
});

export function useUnreadCounts() {
  return useContext(Ctx);
}

export function UnreadCountsProvider({
  userId, children,
}: { userId: string; children: React.ReactNode }) {
  const [notifCount,   setNotifCount]   = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    countUnreadNotifications(userId).then(setNotifCount).catch(() => {});
    countUnreadMessages(userId).then(setMessageCount).catch(() => {});
  }, [userId]);

  // ── Realtime: new notification INSERT ────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifs:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => { setNotifCount((n) => n + 1); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Realtime: new message INSERT in any of user's conversations ───────────
  // We subscribe to the messages table and filter sender_id != userId to detect
  // incoming messages. Since Supabase realtime filters don't support !=,
  // we listen to all inserts and check locally.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`msgs_unread:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as { sender_id: string };
          if (msg.sender_id !== userIdRef.current) {
            setMessageCount((n) => n + 1);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Mark notifs read ─────────────────────────────────────────────────────
  const markNotifsRead = useCallback(() => {
    setNotifCount(0);
    dbMarkNotifsRead(userId).catch(() => {});
  }, [userId]);

  // ── Mark messages read (for a specific conversation) ─────────────────────
  const markMessagesRead = useCallback((conversationId: string) => {
    // Optimistic: we don't know exactly how many were unread in this conv,
    // so we re-fetch the total after marking.
    dbMarkMessagesRead(conversationId, userId)
      .then(() => countUnreadMessages(userId))
      .then(setMessageCount)
      .catch(() => {});
  }, [userId]);

  // Memoized: an inline object literal here would be a new reference every
  // provider render, forcing every consumer (Map's bell badge, tab bar, etc.)
  // to re-render even when the actual counts/handlers haven't changed.
  const value = useMemo(
    () => ({ notifCount, messageCount, markNotifsRead, markMessagesRead }),
    [notifCount, messageCount, markNotifsRead, markMessagesRead],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

/**
 * Supabase Edge Function: send-push
 *
 * Triggered by Supabase Database Webhooks on:
 *   - INSERT into `notifications`  → new_answer, answer_upvoted
 *   - INSERT into `messages`       → new chat message
 *
 * Sends via Expo Push API (no SDK needed — plain fetch).
 *
 * Environment variables needed (set in Supabase Dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookPayload {
  type:   'INSERT' | 'UPDATE' | 'DELETE';
  table:  string;
  record: Record<string, any>;
}

interface ExpoPushMessage {
  to:       string;
  title:    string;
  body:     string;
  data?:    Record<string, any>;
  sound?:   'default' | null;
  badge?:   number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  try {
    if (payload.table === 'notifications') {
      await handleNotificationInsert(payload.record);
    } else if (payload.table === 'messages') {
      await handleMessageInsert(payload.record);
    } else if (payload.table === 'questions') {
      await handleQuestionInsert(payload.record);
    }
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('send-push error:', err);
    return new Response('Internal error', { status: 500 });
  }
});

// ─── Notification insert (new_answer / answer_upvoted) ────────────────────────

async function handleNotificationInsert(record: Record<string, any>) {
  const userId = record.user_id as string | null;
  if (!userId) return;

  const token = await getPushToken(userId);
  if (!token) return;

  const type       = record.type as string;
  const actorId    = record.actor_id as string | null;
  const questionId = record.question_id as string | null;
  const answerId   = record.answer_id as string | null;

  // Fetch actor nickname for personalised copy
  const actorName = actorId ? await getNickname(actorId) : null;
  const questionPreview = questionId ? await getQuestionPreview(questionId) : null;

  let title: string;
  let body:  string;
  let data:  Record<string, any> = { screen: 'Notifications' };

  if (type === 'new_answer') {
    title = 'Soruya yeni cevap! 💬';
    body  = actorName
      ? `${actorName} sorunuza cevap yazdı.`
      : 'Sorunuza yeni bir cevap geldi.';
    if (questionPreview) body += `\n"${truncate(questionPreview, 50)}"`;
    if (questionId) data = { screen: 'Answers', questionId, profileId: userId };

  } else if (type === 'answer_upvoted') {
    title = 'Cevabın beğenildi 👍';
    body  = actorName
      ? `${actorName} cevabını beğendi.`
      : 'Birisi cevabını beğendi.';
    if (questionId) data = { screen: 'Answers', questionId, profileId: userId };

  } else {
    return; // Unknown type — skip
  }

  await sendPush({ to: token, title, body, data, sound: 'default', channelId: 'lore_social', priority: 'high' });
}

// ─── Message insert ───────────────────────────────────────────────────────────

async function handleMessageInsert(record: Record<string, any>) {
  const senderId        = record.sender_id       as string;
  const conversationId  = record.conversation_id as string;
  const body            = record.body            as string;

  // Find recipient (the other participant in the conversation)
  const { data: conv } = await supabase
    .from('conversations')
    .select('user1_id, user2_id')
    .eq('id', conversationId)
    .single();
  if (!conv) return;

  const recipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
  const token       = await getPushToken(recipientId);
  if (!token) return;

  // Fetch sender details for display
  const { data: sender } = await supabase
    .from('profiles')
    .select('nickname, avatar, gender, avatar_url')
    .eq('id', senderId)
    .maybeSingle();

  const senderName = (sender as any)?.nickname ?? 'Birisi';

  await sendPush({
    to:        token,
    title:     `${senderName} ✉️`,
    body:      truncate(body, 120),
    data: {
      screen:          'Chat',
      conversationId,
      otherUserId:     senderId,
      otherNickname:   senderName,
      otherAvatar:     (sender as any)?.avatar   ?? '🐾',
      otherGender:     (sender as any)?.gender   ?? null,
    },
    sound:     'default',
    channelId: 'lore_social',
    priority:  'high',
  });
}

// ─── Question insert (nearby new question) ────────────────────────────────────

const NEARBY_RADIUS_M = 2000; // 2 km

async function handleQuestionInsert(record: Record<string, any>) {
  const questionId = record.id as string;
  const body       = record.body as string;
  if (!questionId) return;

  // Find nearby users with a fresh location + valid token. The RPC also stamps
  // last_notified_nearby_at to enforce the max-1-per-hour throttle atomically.
  const { data: recipients, error } = await supabase.rpc('users_near_question', {
    q_id:     questionId,
    radius_m: NEARBY_RADIUS_M,
  });
  if (error) { console.error('users_near_question error:', error); return; }
  if (!recipients || recipients.length === 0) return;

  const title = 'Yakınında yeni bir soru 📍';
  const preview = body ? truncate(body, 80) : 'Çevrende biri soru sordu.';

  for (const r of recipients as Array<{ user_id: string; push_token: string }>) {
    if (!r.push_token?.startsWith('ExponentPushToken')) continue;
    await sendPush({
      to:        r.push_token,
      title,
      body:      preview,
      data:      { screen: 'Answers', questionId, profileId: r.user_id },
      sound:     'default',
      channelId: 'lore_nearby',
      priority:  'high',
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getPushToken(profileId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', profileId)
    .maybeSingle();
  const token = (data as any)?.push_token as string | null;
  if (!token || !token.startsWith('ExponentPushToken')) return null;
  return token;
}

async function getNickname(profileId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', profileId)
    .maybeSingle();
  return (data as any)?.nickname ?? null;
}

async function getQuestionPreview(questionId: string): Promise<string | null> {
  const { data } = await supabase
    .from('questions')
    .select('body')
    .eq('id', questionId)
    .maybeSingle();
  return (data as any)?.body ?? null;
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

async function sendPush(message: ExpoPushMessage) {
  const res = await fetch(EXPO_PUSH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify(message),
  });

  const json = await res.json();

  // Log any delivery errors (tickets)
  if (json?.data?.status === 'error') {
    console.error('Expo push error:', json.data.message);
  }
}

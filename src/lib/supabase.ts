import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pmzoeyrkhqavokuzoinz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2DzwoSQP626Y2jddL5G8Cw_Cmr6RCAo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type QuestionType = 'vote' | 'choice' | 'open';

export interface Profile {
  id: string;
  nickname: string;
  avatar: string;
  gender: 'male' | 'female' | 'other' | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  author_id: string;
  body: string;
  type: QuestionType;
  options?: { label: string; count: number }[];
  geom: unknown; // raw WKB from Supabase — use .lat/.lng instead
  lat: number;
  lng: number;
  answer_count: number;
  created_at: string;
}

export interface Answer {
  id: string;
  question_id: string;
  author_id: string;
  body?: string;
  choice?: string;
  upvotes: number;
  created_at: string;
}

export interface Report {
  id: string;
  question_id: string;
  reporter_id: string;
  reason?: string;
  created_at: string;
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

export async function fetchNearbyQuestions(lat: number, lng: number, radiusM = 3000) {
  const { data, error } = await supabase.rpc('questions_nearby', {
    user_lat: lat,
    user_lng: lng,
    radius_m: radiusM,
  });
  if (error) throw error;
  return data as Question[];
}

/** Bir bölgede kaç soru var? (ücretsiz kullanıcıya teaser pin göstermek için) */
export async function fetchRegionQuestionCount(lat: number, lng: number, radiusM = 50000): Promise<number> {
  const { data, error } = await supabase.rpc('region_question_count', {
    lat, lng, radius_m: radiusM,
  });
  if (error) return 0;
  return (data as number) ?? 0;
}

/** Persist the user's last known location so we can push nearby new questions. */
export async function saveUserLocation(profileId: string, lat: number, lng: number): Promise<void> {
  await supabase.rpc('update_user_location', { p_id: profileId, p_lat: lat, p_lng: lng });
}

/** Fetch a single question (with unpacked lat/lng) by id — used by notification deep links. */
export async function fetchQuestionById(questionId: string): Promise<Question | null> {
  const { data, error } = await supabase.rpc('question_by_id', { q_id: questionId });
  if (error) throw error;
  const rows = data as Question[];
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function createProfile(
  nickname: string,
  avatar: string,
  gender: 'male' | 'female' | 'other',
  authUserId?: string | null,
): Promise<Profile> {
  const payload: Record<string, unknown> = { nickname, avatar, gender };
  if (authUserId) payload.auth_user_id = authUserId;
  const { data, error } = await supabase
    .from('profiles')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

/**
 * Links an existing (anonymous) profile row to an auth user id, "upgrading"
 * it to a real account in place. Keeps the SAME profile.id so all of the
 * user's content AND their RevenueCat entitlement (appUserID = profile.id)
 * stay attached. Returns the updated profile.
 */
export async function linkAuthToProfile(
  profileId: string,
  authUserId: string,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ auth_user_id: authUserId })
    .eq('id', profileId)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function fetchProfileByAuthUserId(authUserId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) return null;
  return data as Profile | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Sign in to Supabase using an Apple identity token (native Sign in with Apple). */
export async function signInWithAppleToken(identityToken: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Deletes the user's profile row and signs out the session.
 * Apple App Store requires an in-app account deletion option.
 * For full auth.users removal, add a Supabase RPC with service-role on the backend.
 */
export async function deleteAccount(profileId: string): Promise<void> {
  await supabase.from('profiles').delete().eq('id', profileId);
  await supabase.auth.signOut();
}

export async function getAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ─── Avatar upload ────────────────────────────────────────────────────────────

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const path = `avatars/${userId}.${ext}`;

  const res = await fetch(localUri);
  const blob = await res.blob();

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: mime, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export async function updateProfile(
  userId: string,
  fields: Partial<{ nickname: string; avatar_url: string | null }>
): Promise<void> {
  const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
  if (error) throw error;
}

/** Whether this profile has premium (unlocks questions beyond the free radius). */
export async function fetchIsPremium(profileId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', profileId)
    .maybeSingle();
  if (error) return false;
  return !!data?.is_premium;
}

/** Mirror RevenueCat entitlement state onto the profile row (server fallback). */
export async function setProfilePremium(profileId: string, isPremium: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_premium: isPremium })
    .eq('id', profileId);
  if (error) throw error;
}

export async function fetchProfiles(ids: string[]): Promise<Profile[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar, gender, avatar_url')
    .in('id', ids);
  if (error) throw error;
  return data as Profile[];
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export async function getOrCreateConversation(
  userId: string,
  otherId: string
): Promise<string> {
  // Check both orderings with separate queries (nested .or(and()) is unreliable)
  const [r1, r2] = await Promise.all([
    supabase.from('conversations').select('id').eq('user1_id', userId).eq('user2_id', otherId).maybeSingle(),
    supabase.from('conversations').select('id').eq('user1_id', otherId).eq('user2_id', userId).maybeSingle(),
  ]);
  if (r1.data) return r1.data.id;
  if (r2.data) return r2.data.id;

  // Normalize pair: smaller UUID goes to user1_id to avoid duplicates
  const [u1, u2] = userId < otherId ? [userId, otherId] : [otherId, userId];

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user1_id: u1, user2_id: u2 })
    .select('id')
    .single();

  // Race condition: another client created it between our check and insert
  if (error?.code === '23505') {
    const { data: retry } = await supabase
      .from('conversations').select('id')
      .eq('user1_id', u1).eq('user2_id', u2).single();
    if (retry) return retry.id;
  }

  if (error) throw error;
  return data.id;
}

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return data as Conversation[];
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Message[];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select()
    .single();
  if (error) throw error;
  // Fire-and-forget: update conversation timestamp (don't block on it)
  supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)
    .then(() => {});
  return data as Message;
}

export async function submitAnswer(
  questionId: string,
  authorId: string,
  payload: { body?: string; choice?: string }
) {
  const { data, error } = await supabase
    .from('answers')
    .insert({ question_id: questionId, author_id: authorId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data as Answer;
}

export const FREE_DAILY_ANSWER_LIMIT = 3;

export async function countTodayAnswers(authorId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('answers')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', authorId)
    .gte('created_at', start.toISOString());
  if (error) return 0;
  return count ?? 0;
}

export async function fetchUserAnsweredQuestionIds(authorId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('answers')
    .select('question_id')
    .eq('author_id', authorId);
  if (error) throw error;
  return (data as { question_id: string }[]).map((r) => r.question_id);
}

// ─── Timeline ────────────────────────────────────────────────────────────────

/** Questions the user authored, newest first. */
export async function fetchMyQuestions(authorId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Question[];
}

/** Full question records the user has answered, newest first. */
export async function fetchMyAnsweredQuestions(authorId: string): Promise<Question[]> {
  const ids = await fetchUserAnsweredQuestionIds(authorId);
  if (!ids.length) return [];
  const uniqueIds = Array.from(new Set(ids));
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .in('id', uniqueIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Question[];
}

export async function fetchAnswers(questionId: string) {
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('question_id', questionId)
    .order('upvotes', { ascending: false });
  if (error) throw error;
  return data as Answer[];
}

export async function upvoteAnswer(answerId: string) {
  const { error } = await supabase.rpc('increment_answer_upvotes', { answer_id: answerId });
  if (error) {
    // fallback: direct update
    await supabase.from('answers').update({ upvotes: supabase.rpc as any }).eq('id', answerId);
  }
}

export async function postQuestion(
  authorId: string,
  body: string,
  type: QuestionType,
  lat: number,
  lng: number,
  options?: { label: string; count: number }[]
) {
  const { data, error } = await supabase
    .from('questions')
    .insert({
      author_id: authorId,
      body,
      type,
      options,
      geom: `POINT(${lng} ${lat})`,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Question;
}

export async function fetchUserStats(userId: string): Promise<{ questions: number; answers: number }> {
  const [qRes, aRes] = await Promise.all([
    supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', userId),
    supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', userId),
  ]);
  return { questions: qRes.count ?? 0, answers: aRes.count ?? 0 };
}

export async function reportQuestion(questionId: string, reporterId: string, reason?: string) {
  const { error } = await supabase
    .from('reports')
    .insert({ question_id: questionId, reporter_id: reporterId, reason });
  if (error) throw error;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType = 'new_answer' | 'answer_upvoted';

export interface AppNotification {
  id:          string;
  user_id:     string;
  type:        NotificationType;
  question_id: string | null;
  answer_id:   string | null;
  actor_id:    string | null;
  read:        boolean;
  created_at:  string;
  // joined
  actor?:      Profile;
  question?:   Pick<Question, 'id' | 'body'>;
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const notifs = (data ?? []) as AppNotification[];

  // Enrich with actor profiles + question bodies in parallel
  const actorIds    = [...new Set(notifs.map((n) => n.actor_id).filter(Boolean) as string[])];
  const questionIds = [...new Set(notifs.map((n) => n.question_id).filter(Boolean) as string[])];

  const [actors, questions] = await Promise.all([
    actorIds.length
      ? supabase.from('profiles').select('id,nickname,avatar,gender,avatar_url').in('id', actorIds)
      : Promise.resolve({ data: [] }),
    questionIds.length
      ? supabase.from('questions').select('id,body').in('id', questionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const actorMap    = Object.fromEntries((actors.data ?? []).map((p: any) => [p.id, p]));
  const questionMap = Object.fromEntries((questions.data ?? []).map((q: any) => [q.id, q]));

  return notifs.map((n) => ({
    ...n,
    actor:    n.actor_id    ? actorMap[n.actor_id]       : undefined,
    question: n.question_id ? questionMap[n.question_id] : undefined,
  }));
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return count ?? 0;
}

// ─── Unread messages ──────────────────────────────────────────────────────────

/** Count of unread incoming messages across all conversations. */
export async function countUnreadMessages(userId: string): Promise<number> {
  // Get all conversation IDs the user is part of
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
  if (!convs?.length) return 0;

  const convIds = convs.map((c: any) => c.id);
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', convIds)
    .neq('sender_id', userId)
    .eq('read', false);
  return count ?? 0;
}

/** Mark all incoming messages in a conversation as read. */
export async function markMessagesRead(conversationId: string, readerId: string): Promise<void> {
  await supabase.rpc('mark_messages_read', {
    p_conversation_id: conversationId,
    p_reader_id:       readerId,
  });
}

// ─── Push tokens ──────────────────────────────────────────────────────────────

/** Persist the Expo push token for a profile so the server can send remote pushes. */
export async function savePushToken(profileId: string, token: string): Promise<void> {
  // Assign the token to this profile and strip it from any other profile so a
  // single device/token maps to exactly one active profile.
  await supabase.rpc('claim_push_token', { p_id: profileId, p_token: token });
}

/** Fetch the Expo push token for a single profile (used server-side via Edge Function). */
export async function fetchPushToken(profileId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', profileId)
    .maybeSingle();
  return (data as any)?.push_token ?? null;
}

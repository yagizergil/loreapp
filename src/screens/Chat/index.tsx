import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useProfile } from '../../lib/ProfileContext';
import { useUnreadCounts } from '../../lib/UnreadCountsContext';
import {
  Message, fetchMessages, sendMessage, getOrCreateConversation,
} from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { palette, fontFamily, fontSize, spacing, radius } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation';
import Avatar from '../../components/ui/Avatar';
import { useTranslation } from 'react-i18next';

type ChatRoute = RouteProp<RootStackParamList, 'Chat'>;

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const profile    = useProfile();
  const navigation = useNavigation<any>();
  const route      = useRoute<ChatRoute>();
  const insets     = useSafeAreaInsets();
  const { markMessagesRead } = useUnreadCounts();

  const { t } = useTranslation();
  const { otherUserId, otherNickname, otherAvatar, otherGender } = route.params;
  const paramConvId = route.params.conversationId;

  const [convId, setConvId]       = useState<string | null>(paramConvId ?? null);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [sending, setSending]     = useState(false);
  const listRef = useRef<FlatList>(null);
  const convIdRef = useRef<string | null>(paramConvId ?? null);

  // Keep ref in sync so handleSend always has the latest value
  useEffect(() => { convIdRef.current = convId; }, [convId]);

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (convIdRef.current) return convIdRef.current;
    const id = await getOrCreateConversation(profile.id, otherUserId);
    convIdRef.current = id;
    setConvId(id);
    return id;
  }, [profile.id, otherUserId]);

  // Initial load: ensure conversation + fetch history + mark incoming as read
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await ensureConversation();
        if (cancelled) return;
        const msgs = await fetchMessages(id);
        if (cancelled) return;
        setMessages(msgs);
        // Mark incoming messages as read, update badge
        markMessagesRead(id);
      } catch (e: any) {
        if (!cancelled) setInitError(e?.message ?? t('chat.errorOpen'));
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ensureConversation, markMessagesRead]);

  // Realtime subscription — attaches once convId is known
  useEffect(() => {
    if (!convId) return;

    const channel = supabase
      .channel(`chat:${convId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev; // dedup
            return [...prev, newMsg];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [convId]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');

    try {
      const id = await ensureConversation();
      const msg = await sendMessage(id, profile.id, text);
      // Optimistic: add message (realtime may also deliver it — dedup handles that)
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) {
      setInput(text); // restore
      Alert.alert(t('chat.errorSend'), e?.message ?? t('chat.errorRetry'));
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item, index }: { item: Message; index: number }) {
    const isMine = item.sender_id === profile.id;
    const prev   = messages[index - 1];
    const showTime = !prev || new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;

    return (
      <View>
        {showTime && (
          <Text style={styles.timeStamp}>{formatTime(item.created_at)}</Text>
        )}
        <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
          {!isMine && (
            <View style={styles.msgAvatar}>
              <Avatar avatarKey={otherAvatar} gender={otherGender} size={28} ring={false} />
            </View>
          )}
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
              {item.body}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <View style={styles.chevron} />
        </TouchableOpacity>

        <Avatar avatarKey={otherAvatar} gender={otherGender} size={40} ring />

        <View style={styles.headerMeta}>
          <Text style={styles.headerName}>{otherNickname}</Text>
          <Text style={styles.headerSub}>{t('chat.subtitle')}</Text>
        </View>
      </View>

      {/* Body */}
      {initLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.ink40} />
        </View>
      ) : initError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{initError}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setInitError(null);
              setInitLoading(true);
              ensureConversation()
                .then((id) => fetchMessages(id))
                .then(setMessages)
                .catch((e) => setInitError(e?.message ?? t('chat.errorOpen')))
                .finally(() => setInitLoading(false));
            }}
          >
            <Text style={styles.retryText}>{t('chat.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('conversations.emptyTitle')}{'\n'}{t('conversations.emptyBody')}</Text>
            </View>
          }
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
        <TextInput
          style={styles.input}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={palette.ink40}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="default"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          activeOpacity={0.8}
          disabled={!input.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color={palette.white} size="small" />
          ) : (
            <View style={styles.sendArrow} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink90 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.ink70,
    gap: spacing.md,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chevron: {
    width: 10, height: 10,
    borderLeftWidth: 2, borderBottomWidth: 2,
    borderColor: palette.ink20,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  headerMeta: { flex: 1 },
  headerName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.ink00,
  },
  headerSub: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
    marginTop: 1,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.base },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: palette.accent,
  },
  retryText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: palette.white,
  },

  list: { paddingHorizontal: spacing.base, paddingTop: spacing.base },

  timeStamp: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: palette.ink40,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },

  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
    gap: 6,
  },
  msgRowMine: {
    flexDirection: 'row-reverse',
  },
  msgAvatar: {
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '74%',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleMine: {
    backgroundColor: palette.accent,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: palette.ink70,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink20,
    lineHeight: fontSize.base * 1.45,
  },
  bubbleTextMine: { color: palette.white },

  empty: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.7,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.ink70,
    backgroundColor: palette.ink90,
  },
  input: {
    flex: 1,
    backgroundColor: palette.ink80,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink00,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: palette.ink60,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendArrow: {
    width: 0, height: 0,
    borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 11,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    borderLeftColor: palette.white,
    marginLeft: 3,
  },
});

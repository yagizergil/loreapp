import { Alert } from 'react-native';
import i18n from '../i18n';
import { reportQuestion, reportAnswer, reportUser, blockUser } from './supabase';

const t = (k: string, o?: any) => i18n.t(k, o) as string;

const REASONS = ['spam', 'offensive', 'harassment', 'other'] as const;

/** Şikayet sebebi seçtirir, gönderir, sonra "alındı" geri bildirimi verir. */
function pickReasonAndReport(submit: (reason: string) => Promise<void>) {
  Alert.alert(
    t('moderation.reportTitle'),
    t('moderation.reportReasonPrompt'),
    [
      ...REASONS.map((r) => ({
        text: t(`moderation.reasons.${r}`),
        onPress: async () => {
          try {
            await submit(r);
            Alert.alert(t('moderation.reportThanksTitle'), t('moderation.reportThanksBody'));
          } catch {
            Alert.alert(t('common.error'), t('moderation.reportError'));
          }
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ],
  );
}

export function reportQuestionFlow(questionId: string, reporterId: string) {
  pickReasonAndReport((reason) => reportQuestion(questionId, reporterId, reason));
}

export function reportAnswerFlow(answerId: string, reporterId: string) {
  pickReasonAndReport((reason) => reportAnswer(answerId, reporterId, reason));
}

export function reportUserFlow(reportedId: string, reporterId: string) {
  pickReasonAndReport((reason) => reportUser(reportedId, reporterId, reason));
}

/** Engelleme onayı; onaylanırsa block kaydı atılır ve onDone tetiklenir. */
export function blockUserFlow(blockerId: string, blockedId: string, onDone?: () => void) {
  if (blockerId === blockedId) return;
  Alert.alert(
    t('moderation.blockTitle'),
    t('moderation.blockMessage'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('moderation.blockConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(blockerId, blockedId);
            Alert.alert(t('moderation.blockedTitle'), t('moderation.blockedBody'));
            onDone?.();
          } catch {
            Alert.alert(t('common.error'), t('moderation.blockError'));
          }
        },
      },
    ],
  );
}

/** Bir içerik için birleşik menü: Şikayet / Engelle / İptal. */
export function moderationMenu(opts: {
  reporterId: string;
  authorId: string;
  onReport: () => void;
  onBlocked?: () => void;
}) {
  const { reporterId, authorId, onReport, onBlocked } = opts;
  const buttons: any[] = [
    { text: t('moderation.menuReport'), onPress: onReport },
  ];
  if (authorId && authorId !== reporterId) {
    buttons.push({
      text: t('moderation.menuBlock'),
      style: 'destructive',
      onPress: () => blockUserFlow(reporterId, authorId, onBlocked),
    });
  }
  buttons.push({ text: t('common.cancel'), style: 'cancel' });
  Alert.alert(t('moderation.menuTitle'), undefined, buttons);
}

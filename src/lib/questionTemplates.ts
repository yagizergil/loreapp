import { QuestionType } from './supabase';
import i18n from '../i18n';

export interface QuestionTemplate {
  body: string;
  /** Only set for 'choice' templates — the two option labels to prefill. */
  options?: [string, string];
}

/**
 * Ready-made icebreaker prompts shown in the Ask flow (Step 2). Lowers the
 * "what do I even ask a stranger" barrier that kills cold-open posting —
 * the same mechanic behind Hinge's prompt answers and AITA/"Would You
 * Rather" formats: a specific, mildly provocative or curiosity-gap prompt
 * gets replies far more reliably than a blank text box.
 */
export function getQuestionTemplates(type: QuestionType): QuestionTemplate[] {
  switch (type) {
    case 'vote':
      return [
        { body: i18n.t('ask.templates.vote1') },
        { body: i18n.t('ask.templates.vote2') },
        { body: i18n.t('ask.templates.vote3') },
      ];
    case 'choice':
      return [
        { body: i18n.t('ask.templates.choice1.body'), options: [i18n.t('ask.templates.choice1.a'), i18n.t('ask.templates.choice1.b')] },
        { body: i18n.t('ask.templates.choice2.body'), options: [i18n.t('ask.templates.choice2.a'), i18n.t('ask.templates.choice2.b')] },
        { body: i18n.t('ask.templates.choice3.body'), options: [i18n.t('ask.templates.choice3.a'), i18n.t('ask.templates.choice3.b')] },
      ];
    case 'open':
      return [
        { body: i18n.t('ask.templates.open1') },
        { body: i18n.t('ask.templates.open2') },
        { body: i18n.t('ask.templates.open3') },
      ];
  }
}

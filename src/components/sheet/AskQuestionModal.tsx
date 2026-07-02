import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Modal, Pressable,
  Dimensions, KeyboardAvoidingView, Platform, Animated, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { QuestionType, postQuestion } from '../../lib/supabase';
import { containsObjectionableContent } from '../../lib/contentFilter';
import { palette, fontFamily, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import { CONTENT_MAX_WIDTH } from '../../theme/responsive';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  profileId:    string;
  userLocation: { lat: number; lng: number } | null;
  onClose:      () => void;
  onPosted:     () => void;
}

type Step = 1 | 2 | 3;

// ─── Type definitions ─────────────────────────────────────────────────────────

interface TypeDef { type: QuestionType; label: string; sub: string; color: string; hint: string; }

const getTypes = (): TypeDef[] => [
  {
    type: 'vote',
    label: i18n.t('ask.typeVote'),
    sub: i18n.t('questionType.vote'),
    color: palette.accent,
    hint: i18n.t('ask.voteHint'),
  },
  {
    type: 'choice',
    label: i18n.t('ask.typeChoice'),
    sub: i18n.t('questionType.choice'),
    color: '#4A7FC0',
    hint: i18n.t('ask.choiceHint'),
  },
  {
    type: 'open',
    label: i18n.t('ask.typeOpen'),
    sub: i18n.t('questionType.open'),
    color: '#4A9E6E',
    hint: i18n.t('ask.openHint'),
  },
];

// ─── Type icons (SVG) ─────────────────────────────────────────────────────────

function VoteIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Path d="M4 20 H14 M4 14 H22 M4 8 H18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx="22" cy="20" r="4" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M20 20 L21.5 21.5 L24 18.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChoiceIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Circle cx="6"  cy="8"  r="2.5" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="6"  cy="14" r="2.5" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="6"  cy="20" r="2.5" fill={color} />
      <Path d="M12 8 H24 M12 14 H22 M12 20 H20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function OpenIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Path d="M8 6 H20 Q22 6 22 8 V20 Q22 22 20 22 H8 Q6 22 6 20 V8 Q6 6 8 6 Z" stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
      <Path d="M10 11 H18 M10 14.5 H18 M10 18 H15" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function TypeIcon({ type, color }: { type: QuestionType; color: string }) {
  if (type === 'vote')   return <VoteIcon color={color} />;
  if (type === 'choice') return <ChoiceIcon color={color} />;
  return <OpenIcon color={color} />;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step }: { step: Step }) {
  return (
    <View style={sd.row}>
      {([1, 2, 3] as Step[]).map((s, i) => (
        <React.Fragment key={s}>
          <View style={[sd.dot, step === s && sd.dotActive, step > s && sd.dotDone]}>
            {step > s
              ? <Text style={sd.check}>✓</Text>
              : <Text style={[sd.num, step === s && sd.numActive]}>{s}</Text>
            }
          </View>
          {i < 2 && (
            <View style={[sd.line, step > s + 1 && sd.lineDone, step === s + 1 && sd.lineHalf]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const sd = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: palette.ink60,
    backgroundColor: palette.ink80,
    alignItems: 'center', justifyContent: 'center',
  },
  dotActive: { borderColor: palette.accent, backgroundColor: palette.accentDim },
  dotDone:   { borderColor: palette.accent, backgroundColor: palette.accent },
  num:       { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: palette.ink40 },
  numActive: { color: palette.accent },
  check:     { fontFamily: fontFamily.bodySemiBold, fontSize: 11, color: palette.white },
  line:      { flex: 1, height: 2, backgroundColor: palette.ink60, marginHorizontal: 4 },
  lineDone:  { backgroundColor: palette.accent },
  lineHalf:  { backgroundColor: palette.accent + '55' },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function AskQuestionModal({ profileId, userLocation, onClose, onPosted }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const TYPES = getTypes();

  const [step, setStep]                 = useState<Step>(1);
  const [selectedType, setType]         = useState<QuestionType>('vote');
  const [questionBody, setBody]         = useState('');
  const [choiceOptions, setChoices]     = useState<string[]>(['', '']);
  const [submitting, setSubmitting]     = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const typeData   = TYPES.find((t) => t.type === selectedType)!;
  const typeColor  = typeData.color;
  const canStep2   = questionBody.trim().length > 0;
  const canSubmit  = canStep2 && !!userLocation && !submitting;

  function updateChoice(i: number, v: string) {
    const next = [...choiceOptions];
    next[i] = v;
    setChoices(next);
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    // Objectionable-content filter (Guideline 1.2): block before posting.
    const choiceText = choiceOptions.join(' ');
    if (containsObjectionableContent(questionBody) || containsObjectionableContent(choiceText)) {
      Alert.alert(t('filter.blockedTitle'), t('filter.blockedBody'));
      return;
    }

    setSubmitting(true);
    try {
      const options =
        selectedType === 'choice'
          ? choiceOptions.filter((o) => o.trim()).map((label) => ({ label, count: 0 }))
          : selectedType === 'vote'
          ? [{ label: 'Evet', count: 0 }, { label: 'Hayır', count: 0 }]
          : undefined;
      if (!userLocation) {
        Alert.alert(t('common.error'), t('ask.errorNoLocation'));
        return;
      }
      await postQuestion(profileId, questionBody.trim(), selectedType, userLocation.lat, userLocation.lng, options);
      onPosted();
      onClose();
    } catch (e: any) {
      Alert.alert(t('common.error'), t('ask.errorPost', { msg: e?.message ?? '' }));
    }
    finally { setSubmitting(false); }
  }

  // ── STEP 1 — type selection ──────────────────────────────────────────────────

  const Step1 = (
    <>
      <StepDots step={1} />
      <Text style={m.heading}>{t('ask.step1Title')}</Text>
      <Text style={m.subHeading}>{t('ask.step1Sub')}</Text>

      <View style={m.typeList}>
        {TYPES.map(({ type, label, sub, color, hint }) => {
          const active = selectedType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[m.typeCard, active && { borderColor: color, backgroundColor: color + '0F' }]}
              activeOpacity={0.8}
              onPress={() => setType(type)}
            >
              {/* Left icon box */}
              <View style={[m.typeIconBox, { backgroundColor: color + '1A' }]}>
                <TypeIcon type={type} color={color} />
              </View>

              {/* Text */}
              <View style={m.typeTextCol}>
                <View style={m.typeTitleRow}>
                  <Text style={[m.typeLabel, active && { color: palette.ink00 }]}>{label}</Text>
                  <View style={[m.typeBadge, { backgroundColor: color + '22' }]}>
                    <Text style={[m.typeBadgeText, { color }]}>{sub}</Text>
                  </View>
                </View>
                <Text style={m.typeHint}>{hint}</Text>
              </View>

              {/* Selection ring */}
              <View style={[m.typeRadio, active && { borderColor: color }]}>
                {active && <View style={[m.typeRadioFill, { backgroundColor: color }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={m.primaryBtn} activeOpacity={0.85} onPress={() => setStep(2)}>
        <Text style={m.primaryBtnText}>{t('ask.continue')}</Text>
        <View style={m.btnArrow} />
      </TouchableOpacity>
    </>
  );

  // ── STEP 2 — write question ──────────────────────────────────────────────────

  const Step2 = (
    <>
      <StepDots step={2} />

      {/* Type reminder badge */}
      <TouchableOpacity style={m.backRow} onPress={() => setStep(1)}>
        <View style={m.backChevron} />
        <View style={[m.typeMini, { backgroundColor: typeColor + '1A', borderColor: typeColor + '55' }]}>
          <TypeIcon type={selectedType} color={typeColor} />
          <Text style={[m.typeMiniText, { color: typeColor }]}>{typeData.label}</Text>
        </View>
      </TouchableOpacity>

      <Text style={m.heading}>{t('ask.step2Title')}</Text>

      {/* Main input */}
      <View style={[m.inputCard, inputFocused && { borderColor: typeColor }]}>
        <TextInput
          style={m.bodyInput}
          placeholder={t('ask.placeholder')}
          placeholderTextColor={palette.ink40}
          value={questionBody}
          onChangeText={setBody}
          maxLength={120}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
        />
        <View style={m.charRow}>
          {/* Progress bar */}
          <View style={m.charBarBg}>
            <View style={[m.charBarFill, {
              width: `${(questionBody.length / 120) * 100}%` as any,
              backgroundColor: questionBody.length > 100 ? palette.error : typeColor,
            }]} />
          </View>
          <Text style={[m.charCount, questionBody.length > 100 && { color: palette.error }]}>
            {questionBody.length}/120
          </Text>
        </View>
      </View>

      {/* Vote: auto Evet/Hayır info */}
      {selectedType === 'vote' && (
        <View style={m.autoOptions}>
          <Text style={m.autoOptionsLabel}>{t('ask.typeVote')}</Text>
          <View style={m.autoOptionRow}>
            <View style={[m.autoOptionPill, { backgroundColor: '#1A4A2E' }]}>
              <Text style={[m.autoOptionText, { color: '#4A9E6E' }]}>✓  {t('sheet.voteYes')}</Text>
            </View>
            <View style={[m.autoOptionPill, { backgroundColor: '#4A1A1A' }]}>
              <Text style={[m.autoOptionText, { color: '#C0453A' }]}>✗  {t('sheet.voteNo')}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Choice: option inputs */}
      {selectedType === 'choice' && (
        <View style={m.choicesWrap}>
          <Text style={m.choicesLabel}>{t('ask.typeChoice')}</Text>
          {choiceOptions.map((opt, i) => (
            <View key={i} style={m.choiceRow}>
              <View style={[m.choiceNum, { backgroundColor: typeColor + '22' }]}>
                <Text style={[m.choiceNumText, { color: typeColor }]}>{i + 1}</Text>
              </View>
              <TextInput
                style={m.choiceInput}
                placeholder={t('ask.optionHint', { n: i + 1 })}
                placeholderTextColor={palette.ink40}
                value={opt}
                onChangeText={(v) => updateChoice(i, v)}
                maxLength={60}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ))}
          {choiceOptions.length < 4 && (
            <TouchableOpacity
              style={m.addChoiceBtn}
              activeOpacity={0.7}
              onPress={() => setChoices([...choiceOptions, ''])}
            >
              <Text style={[m.addChoiceText, { color: typeColor }]}>{t('ask.addOption')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[m.primaryBtn, { backgroundColor: typeColor }, !canStep2 && m.primaryBtnDisabled]}
        activeOpacity={0.85}
        onPress={() => setStep(3)}
        disabled={!canStep2}
      >
        <Text style={m.primaryBtnText}>{t('ask.preview')}</Text>
        <View style={m.btnArrow} />
      </TouchableOpacity>
    </>
  );

  // ── STEP 3 — preview & submit ────────────────────────────────────────────────

  const Step3 = (
    <>
      <StepDots step={3} />

      <TouchableOpacity style={m.backRow} onPress={() => setStep(2)}>
        <View style={m.backChevron} />
        <Text style={m.backLabel}>{t('ask.edit')}</Text>
      </TouchableOpacity>

      <Text style={m.heading}>{t('ask.step3Title')}</Text>

      {/* Question preview card */}
      <View style={[m.previewCard, { borderColor: typeColor + '66' }]}>
        <View style={[m.previewAccent, { backgroundColor: typeColor }]} />
        <View style={m.previewInner}>
          <View style={[m.previewBadge, { backgroundColor: typeColor + '22' }]}>
            <View style={[m.previewBadgeDot, { backgroundColor: typeColor }]} />
            <Text style={[m.previewBadgeText, { color: typeColor }]}>{typeData.label}</Text>
          </View>
          <Text style={m.previewBody}>{questionBody}</Text>
          {selectedType === 'vote' && (
            <View style={m.previewVoteRow}>
              <View style={[m.previewVotePill, { backgroundColor: '#1A4A2E' }]}>
                <Text style={[m.previewVoteText, { color: '#4A9E6E' }]}>{t('sheet.voteYes')}</Text>
              </View>
              <View style={[m.previewVotePill, { backgroundColor: '#4A1A1A' }]}>
                <Text style={[m.previewVoteText, { color: '#C0453A' }]}>{t('sheet.voteNo')}</Text>
              </View>
            </View>
          )}
          {selectedType === 'choice' && choiceOptions.some((o) => o.trim()) && (
            <View style={m.previewChoiceList}>
              {choiceOptions.filter((o) => o.trim()).map((o) => (
                <View key={o} style={m.previewChoiceItem}>
                  <View style={[m.previewChoiceDot, { backgroundColor: typeColor }]} />
                  <Text style={m.previewChoiceText}>{o}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Location row */}
      <View style={m.locRow}>
        <View style={m.locDot} />
        <Text style={m.locText}>
          {userLocation
            ? `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`
            : t('ask.locationErr')}
        </Text>
        {!userLocation && <View style={[m.locBadge, { backgroundColor: palette.error + '22' }]}>
          <Text style={[m.locBadgeText, { color: palette.error }]}>{t('ask.errorBadge')}</Text>
        </View>}
      </View>

      <TouchableOpacity
        style={[m.submitBtn, { backgroundColor: typeColor }, !canSubmit && m.primaryBtnDisabled]}
        activeOpacity={0.85}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting
          ? <ActivityIndicator color={palette.white} />
          : <>
              <Text style={m.submitBtnText}>{t('ask.submit')}</Text>
              <View style={m.btnArrow} />
            </>
        }
      </TouchableOpacity>
    </>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={m.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={m.kav}
        pointerEvents="box-none"
      >
        <View style={[m.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={m.handle} />
          <ScrollView
            contentContainerStyle={m.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 && Step1}
            {step === 2 && Step2}
            {step === 3 && Step3}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  kav:      { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    backgroundColor: palette.ink80,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: SCREEN_H * 0.90,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: palette.ink60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: palette.ink60,
    marginTop: 12, marginBottom: 4,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl + 8,
  },

  // Typography
  heading: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: palette.ink00,
    marginBottom: 6,
    lineHeight: 30,
  },
  subHeading: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    marginBottom: spacing.lg,
  },

  // Back row
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  backChevron: {
    width: 8, height: 8,
    borderLeftWidth: 2, borderBottomWidth: 2,
    borderColor: palette.ink40,
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  backLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
  },

  // Type mini badge (step 2 header)
  typeMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  typeMiniText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },

  // Type selection cards
  typeList: { gap: spacing.sm, marginBottom: spacing.lg },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: palette.ink70,
    borderWidth: 1.5,
    borderColor: palette.ink60,
  },
  typeIconBox: {
    width: 52, height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTextCol:  { flex: 1, gap: 5 },
  typeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.ink20,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  typeBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  typeHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
    lineHeight: 16,
  },
  typeRadio: {
    width: 20, height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.ink60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeRadioFill: {
    width: 9, height: 9,
    borderRadius: 4.5,
  },

  // Question input
  inputCard: {
    backgroundColor: palette.ink70,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: palette.ink60,
    marginBottom: spacing.base,
    overflow: 'hidden',
  },
  bodyInput: {
    padding: spacing.base,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink00,
    minHeight: 96,
    textAlignVertical: 'top',
    lineHeight: fontSize.base * 1.5,
  },
  charRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingBottom: 10,
  },
  charBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: palette.ink60,
    borderRadius: 2,
    overflow: 'hidden',
  },
  charBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  charCount: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
    minWidth: 36,
    textAlign: 'right',
  },

  // Auto Evet/Hayır
  autoOptions: {
    backgroundColor: palette.ink70,
    borderRadius: radius.md,
    padding: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: palette.ink60,
  },
  autoOptionsLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: palette.ink40,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  autoOptionRow: { flexDirection: 'row', gap: spacing.sm },
  autoOptionPill: {
    flex: 1, paddingVertical: 9,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  autoOptionText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },

  // Choice inputs
  choicesWrap: {
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  choicesLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: palette.ink40,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  choiceNum: {
    width: 30, height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceNumText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
  },
  choiceInput: {
    flex: 1,
    backgroundColor: palette.ink70,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.ink60,
    paddingHorizontal: spacing.base,
    paddingVertical: 11,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink00,
  },
  addChoiceBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  addChoiceText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },

  // Preview card (step 3)
  previewCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: palette.ink70,
    marginBottom: spacing.base,
    ...shadow.sm,
  },
  previewAccent: { height: 4, width: '100%' },
  previewInner: { padding: spacing.base, gap: 10 },
  previewBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  previewBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  previewBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 11, letterSpacing: 0.2 },
  previewBody: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    color: palette.ink00,
    lineHeight: 26,
  },
  previewVoteRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  previewVotePill: {
    paddingHorizontal: spacing.base,
    paddingVertical: 7,
    borderRadius: radius.md,
    flex: 1,
    alignItems: 'center',
  },
  previewVoteText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm },
  previewChoiceList: { gap: 5, marginTop: 2 },
  previewChoiceItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewChoiceDot: { width: 6, height: 6, borderRadius: 3 },
  previewChoiceText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink10 },

  // Location row
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    backgroundColor: palette.ink70,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.ink60,
    marginBottom: spacing.lg,
  },
  locDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: palette.success,
  },
  locText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
  },
  locBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  locBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: palette.accent,
    borderRadius: radius.lg,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.white,
  },
  submitBtn: {
    borderRadius: radius.lg,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.md,
  },
  submitBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.md,
    color: palette.white,
    letterSpacing: 0.2,
  },
  btnArrow: {
    width: 0, height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'rgba(255,255,255,0.7)',
  },
});

/**
 * App Store rating prompt. Fires expo-store-review at a positive moment
 * (after the user's 3rd successful answer) instead of on first launch.
 *
 * Only ever calls requestReview() once per install — Apple/Google already
 * throttle how often the native dialog can actually appear, but we still
 * gate our own call so we don't spam the API on every qualifying event.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const SHOWN_KEY = '@lore/review_prompt_shown';
const ANSWER_COUNT_KEY = '@lore/review_prompt_answer_count';
const ANSWERS_BEFORE_PROMPT = 3;

/** Call after a successful answer submission. No-ops once already shown. */
export async function maybeRequestReviewAfterAnswer(track?: (event: 'review_prompt_shown') => void): Promise<void> {
  try {
    const alreadyShown = await AsyncStorage.getItem(SHOWN_KEY);
    if (alreadyShown) return;

    const raw = await AsyncStorage.getItem(ANSWER_COUNT_KEY);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    await AsyncStorage.setItem(ANSWER_COUNT_KEY, String(count));
    if (count < ANSWERS_BEFORE_PROMPT) return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    await AsyncStorage.setItem(SHOWN_KEY, '1');
    track?.('review_prompt_shown');
    await StoreReview.requestReview();
  } catch {
    // Never let a rating-prompt failure affect the answer flow.
  }
}

/**
 * Content filter — App Store Guideline 1.2 (objectionable content filtering).
 *
 * Lightweight client-side profanity / hate-speech screen applied BEFORE a
 * question, answer or message is posted. This is intentionally conservative:
 * it blocks clearly offensive terms (TR + EN) while avoiding false positives.
 * Reporting + blocking remain the primary safety net for anything that slips
 * through; this filter is the proactive "filtering" layer Apple requires.
 */

// Canonical offensive roots (lowercased, diacritics-folded). Matched as
// whole-word or substring-with-boundaries to catch common variants.
const BLOCKLIST: string[] = [
  // English
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'nigga', 'faggot',
  'whore', 'slut', 'rape', 'rapist', 'pedophile', 'pedo', 'kike', 'spic',
  'retard', 'dick', 'pussy', 'motherfucker',
  // Turkish
  'amk', 'aq', 'orospu', 'piç', 'pic', 'sik', 'siktir', 'yarrak', 'yarak',
  'göt', 'got ver', 'kahpe', 'gavat', 'kaltak', 'ibne', 'oç', 'oc cocugu',
  'amına', 'amina', 'amcık', 'amcik', 'sikik', 'sikecegim', 'sikeyim',
  'pezevenk', 'döl', 'mal piç', 'gerizekalı', 'pust',
];

/** Fold Turkish/diacritic characters and lowercase for matching. */
function normalize(input: string): string {
  return input
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9\s]/g, ' ')     // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true if the text contains clearly objectionable language and should
 * be blocked from posting.
 */
export function containsObjectionableContent(text: string): boolean {
  if (!text) return false;
  const norm = normalize(text);
  const padded = ` ${norm} `;
  for (const term of BLOCKLIST) {
    const t = normalize(term);
    if (!t) continue;
    if (t.includes(' ')) {
      // multi-word phrase: simple substring
      if (norm.includes(t)) return true;
    } else {
      // single token: whole-word match (avoids over-blocking inside words)
      if (padded.includes(` ${t} `)) return true;
    }
  }
  return false;
}

import { Gender } from './storage';

// Cinsiyet renk sistemi — avatar halka rengi
export const GENDER_COLOR: Record<Gender, string> = {
  male:   '#5B8FD4',   // sakin mavi
  female: '#C47AA0',   // soft gül
  other:  '#6B7A94',   // nötr gri-mavi
};

export function genderColor(gender: Gender | null | undefined): string {
  if (!gender) return '#6B7A94';
  return GENDER_COLOR[gender];
}

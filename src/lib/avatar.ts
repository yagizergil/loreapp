export const AVATARS = [
  { key: 'fox',     emoji: '🦊', bg: '#7C4A2D' },
  { key: 'owl',     emoji: '🦉', bg: '#2D5C7C' },
  { key: 'bear',    emoji: '🐻', bg: '#3A6B2D' },
  { key: 'wolf',    emoji: '🐺', bg: '#7C2D5C' },
  { key: 'lion',    emoji: '🦁', bg: '#7C5E1A' },
  { key: 'deer',    emoji: '🦌', bg: '#1A6B4A' },
  { key: 'rabbit',  emoji: '🐰', bg: '#8B3A6B' },
  { key: 'dolphin', emoji: '🐬', bg: '#2D3D7C' },
  { key: 'cat',     emoji: '🐱', bg: '#6B2D7C' },
  { key: 'panda',   emoji: '🐼', bg: '#2D3040' },
  { key: 'tiger',   emoji: '🐯', bg: '#7C5A1A' },
  { key: 'penguin', emoji: '🐧', bg: '#1A4A6B' },
] as const;

export type AvatarKey = typeof AVATARS[number]['key'];

export function getAvatarEmoji(key: string): string {
  return AVATARS.find((a) => a.key === key)?.emoji ?? '🦊';
}

export function getAvatarBg(key: string): string {
  return AVATARS.find((a) => a.key === key)?.bg ?? '#7C4A2D';
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@lore/profile';

export type Gender = 'male' | 'female' | 'other';

export interface LocalProfile {
  id: string;
  nickname: string;
  avatar: string;
  gender: Gender;
  avatarUrl?: string | null;
  isAnonymous?: boolean;
}

export async function getLocalProfile(): Promise<LocalProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalProfile;
  } catch {
    return null;
  }
}

export async function saveLocalProfile(p: LocalProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

export async function clearLocalProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

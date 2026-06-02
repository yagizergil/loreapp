import React, { createContext, useContext } from 'react';
import { LocalProfile } from './storage';

const ProfileContext = createContext<LocalProfile | null>(null);

export function ProfileProvider({
  profile,
  children,
}: {
  profile: LocalProfile;
  children: React.ReactNode;
}) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

export function useProfile(): LocalProfile {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}

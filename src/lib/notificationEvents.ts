/**
 * Event bridge for notification deep-link navigation.
 * Mirrors the pattern used by premiumEvents / paywallEvents.
 * Wire handlers in Navigation component after navRef is ready.
 */

export type NotificationScreen =
  | { screen: 'Map' }
  | { screen: 'Answers';       questionId: string; profileId: string }
  | { screen: 'Chat';          conversationId?: string; otherUserId: string; otherNickname: string; otherAvatar: string; otherGender: 'male' | 'female' | 'other' | null }
  | { screen: 'Notifications' };

export const notificationEvents = {
  onNavigate: (_dest: NotificationScreen) => {},
};

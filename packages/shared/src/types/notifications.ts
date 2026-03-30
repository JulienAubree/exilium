export const NOTIFICATION_CATEGORIES = [
  'building',
  'research',
  'shipyard',
  'fleet',
  'combat',
  'message',
  'market',
  'alliance',
  'social',
  'quest',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  building: 'Bâtiments',
  research: 'Recherche',
  shipyard: 'Chantier spatial & Centre de commandement',
  fleet: 'Flottes',
  combat: 'Combat',
  message: 'Messages',
  market: 'Marché galactique',
  alliance: 'Alliance',
  social: 'Social',
  quest: 'Missions & Quêtes',
};

/** Map SSE event type to notification category */
export const EVENT_TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  'building-done': 'building',
  'research-done': 'research',
  'shipyard-done': 'shipyard',
  'fleet-arrived': 'fleet',
  'fleet-returned': 'fleet',
  'fleet-inbound': 'fleet',
  'fleet-attack-landed': 'combat',
  'fleet-hostile-inbound': 'combat',
  'flagship-incapacitated': 'combat',
  'new-message': 'message',
  'new-reply': 'message',
  'market-offer-reserved': 'market',
  'market-offer-sold': 'market',
  'market-offer-expired': 'market',
  'market-reservation-expired': 'market',
  'new-alliance-message': 'alliance',
  'alliance-activity': 'alliance',
  'friend-request': 'social',
  'friend-accepted': 'social',
  'friend-declined': 'social',
  'daily-quest-completed': 'quest',
  'tutorial-quest-complete': 'quest',
};

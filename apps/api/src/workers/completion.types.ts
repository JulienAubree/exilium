export type BuildCompletionResult = {
  userId: string;
  planetId: string;
  eventType: string;
  notificationPayload: Record<string, unknown>;
  eventPayload: Record<string, unknown>;
  tutorialCheck?: {
    type: string;
    targetId: string;
    targetValue: number;
  };
} | null;

export type FleetCompletionResult = {
  userId: string;
  planetId: string;
  mission: string;
  eventType: string;
  notificationPayload: Record<string, unknown>;
  eventPayload: Record<string, unknown>;
  extraEvents?: Array<{
    type: string;
    payload: Record<string, unknown>;
  }>;
  tutorialChecks?: Array<{
    type: string;
    targetId: string;
    targetValue: number;
  }>;
} | null;

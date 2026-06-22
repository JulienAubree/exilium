import type { SimState } from './state.js';
import type { Action } from './policy.js';

export interface Milestone { id: string; reach(state: SimState): boolean }
export interface RunResult {
  policy: string;
  milestones: { id: string; timeSec: number }[];
  walls: { atSec: number; waitH: number; for: string }[];
  events: number;
}

const WALL_THRESHOLD_H = 2; // réglable : une attente > 2h simulées = mur

export class Recorder {
  private reached = new Map<string, number>();
  private walls: RunResult['walls'] = [];
  private events = 0;
  constructor(private milestones: Milestone[]) {}

  onAction(state: SimState, action: Action, waitH: number): void {
    this.events++;
    for (const m of this.milestones) {
      if (!this.reached.has(m.id) && m.reach(state)) this.reached.set(m.id, state.timeSec);
    }
    if (action.type === 'build' && waitH > WALL_THRESHOLD_H) {
      this.walls.push({ atSec: state.timeSec, waitH: Math.round(waitH * 10) / 10, for: action.buildingId });
    }
  }

  result(policy: string): RunResult {
    return {
      policy,
      milestones: [...this.reached].map(([id, timeSec]) => ({ id, timeSec })),
      walls: this.walls,
      events: this.events,
    };
  }
}

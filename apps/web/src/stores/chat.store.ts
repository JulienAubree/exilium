import { create } from 'zustand';

interface ChatWindow {
  userId: string;
  username: string;
  threadId: string | null;
  minimized: boolean;
  allianceId?: string;
  allianceTag?: string;
}

interface ChatStore {
  windows: ChatWindow[];
  openChat: (userId: string, username: string, threadId?: string | null) => void;
  openAllianceChat: (allianceId: string, allianceName: string, allianceTag: string) => void;
  closeChat: (userId: string) => void;
  minimizeChat: (userId: string) => void;
  expandChat: (userId: string) => void;
  setThreadId: (userId: string, threadId: string) => void;
}

const MAX_WINDOWS = 3;

export const useChatStore = create<ChatStore>((set) => ({
  windows: [],

  openChat: (userId, username, threadId = null) =>
    set((state) => {
      const existing = state.windows.find((w) => w.userId === userId);
      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.userId === userId ? { ...w, minimized: false, threadId: threadId ?? w.threadId } : w,
          ),
        };
      }
      const windows = [...state.windows, { userId, username, threadId, minimized: false }];
      if (windows.length > MAX_WINDOWS) windows.shift();
      return { windows };
    }),

  openAllianceChat: (allianceId, allianceName, allianceTag) =>
    set((state) => {
      const key = `alliance:${allianceId}`;
      const existing = state.windows.find((w) => w.userId === key);
      if (existing) {
        return {
          windows: state.windows.map((w) =>
            w.userId === key ? { ...w, minimized: false } : w,
          ),
        };
      }
      const windows = [...state.windows, {
        userId: key,
        username: `[${allianceTag}] ${allianceName}`,
        threadId: allianceId,
        minimized: false,
        allianceId,
        allianceTag,
      }];
      if (windows.length > MAX_WINDOWS) windows.shift();
      return { windows };
    }),

  closeChat: (userId) =>
    set((state) => ({ windows: state.windows.filter((w) => w.userId !== userId) })),

  minimizeChat: (userId) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.userId === userId ? { ...w, minimized: true } : w,
      ),
    })),

  expandChat: (userId) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.userId === userId ? { ...w, minimized: false } : w,
      ),
    })),

  setThreadId: (userId, threadId) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.userId === userId ? { ...w, threadId } : w,
      ),
    })),
}));

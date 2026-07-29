import type { LiveSessionPort } from "../../core/ports/liveSessionPort";
import {
  addPlayer,
  advancePhase,
  createRoomState,
  generateRoomCode,
  recordAnswer,
  scoreboard,
  type RoomState,
} from "../../core/domain/liveQuiz";
import { NotFoundError } from "../../core/domain/errors";

/**
 * MVP live-session storage: a single-process `Map<roomCode, RoomState>`.
 * Documented limitation (not a blocker per roadmap.md): rooms only exist
 * within the process that created them, so this only works as long as
 * "create" and every subsequent join/answer/advance for a given room are
 * handled by the SAME process — see docs/ADR-live-transport.md for how the
 * transport layer is shaped around that constraint (every room mutation is
 * funneled through the WebSocket sidecar process, never split across it and
 * the main Astro server).
 *
 * A future multi-instance deployment would swap this for a `Bun.redis`
 * pub/sub-backed adapter implementing the same LiveSessionPort interface —
 * usecases and domain logic wouldn't change at all.
 */
export function createInMemoryLiveSessionPort(): LiveSessionPort {
  const rooms = new Map<string, RoomState>();

  function uniqueCode(): string {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateRoomCode();
      if (!rooms.has(code)) return code;
    }
    // Astronomically unlikely at 5 chars / 31-letter alphabet with this many
    // concurrent rooms, but fail loudly rather than silently collide.
    throw new Error("Could not generate a unique room code after 20 attempts");
  }

  function getOrThrow(code: string): RoomState {
    const room = rooms.get(code);
    if (!room) throw new NotFoundError("Room");
    return room;
  }

  return {
    async createRoom(input) {
      const code = uniqueCode();
      const room = createRoomState({ code, hostId: input.hostId, setId: input.setId, questions: input.questions });
      rooms.set(code, room);
      return room;
    },

    async getRoom(code) {
      return rooms.get(code) ?? null;
    },

    async joinRoom(code, player) {
      const room = getOrThrow(code);
      const updated = addPlayer(room, player);
      rooms.set(code, updated);
      return updated;
    },

    async submitAnswer(code, userId, cardId, rawAnswer, now) {
      const room = getOrThrow(code);
      const { room: updated, result } = recordAnswer(room, userId, cardId, rawAnswer, now);
      rooms.set(code, updated);
      return { room: updated, result };
    },

    async advanceQuestion(code, now) {
      const room = getOrThrow(code);
      const updated = advancePhase(room, now);
      rooms.set(code, updated);
      return updated;
    },

    async getScoreboard(code) {
      const room = getOrThrow(code);
      return scoreboard(room);
    },
  };
}

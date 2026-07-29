#!/usr/bin/env bun
// Slice 11 (live quiz): the WebSocket sidecar. A second `Bun.serve()` process
// on its own port (LIVE_WS_PORT) — see docs/ADR-live-transport.md for why
// this exists instead of upgrading a request inside an Astro route (the Bun
// Astro adapter doesn't expose that), and why no reverse proxy is required
// for the browser to talk to it directly.
//
// This process is the SOLE owner of live-quiz room state: it exposes both
// the "start a session" HTTP endpoint (POST /live/create) and the WebSocket
// endpoint (GET /live/:code, upgraded) that handles join/answer/advance.
// Keeping both in one process means the in-memory LiveSessionPort (see
// src/adapters/liveQuiz/inMemoryLiveSessionPort.ts) never has to be shared
// across processes — see that file's header comment for the "why" and the
// documented single-instance limitation.
//
// Wire message shapes (see docs/ADR-live-transport.md for the full writeup):
//   client -> server (over the socket, sent by htmx-ext-ws's `ws-send` forms,
//   JSON-encoded automatically by the extension):
//     {"type": "answer", "cardId": "...", "rawAnswer": "..."}
//     {"type": "advance"}                                     (host only)
//     {"type": "configureTeams", "teamCount": 3}               (host only,
//       slice 12 — lobby-phase only, see core/domain/liveQuiz.ts's
//       configureTeams; re-sending reshuffles)
//   server -> client: raw HTML fragments (hx-swap-oob), the same
//   "HTML over the wire" model as every other htmx interaction in this app —
//   NOT JSON, since the client just swaps whatever markup it's given. Two
//   targets are used: `#live-room` (the whole room view: lobby/question/
//   reveal/finished) and `#live-answer-status` (a small per-viewer ack after
//   submitting an answer). See src/lib/liveFragments.ts for every fragment.
//   "join" has no explicit client->server message: it happens automatically
//   when the socket opens (the handshake itself IS the join, gated on the
//   signed session cookie — see getUserFromCookieHeader).
import "./src/env";
import { ENV } from "varlock/env";
import { getContainer } from "./src/di/container";
import { getUserFromCookieHeader } from "./src/lib/session";
import { getOwnedSet } from "./src/core/usecases/setUsecases";
import {
  createLiveSession,
  joinLiveSession,
  submitLiveAnswer,
  advanceLiveQuestion,
  computeScoreboard,
  computeTeamScoreboard,
  getLiveRoom,
  setLiveTeams,
  assignLiveTeam,
} from "./src/core/usecases/liveQuizUsecases";
import { currentQuestion, type RoomState } from "./src/core/domain/liveQuiz";
import { NotFoundError, ForbiddenError, ValidationError } from "./src/core/domain/errors";
import type { Locale } from "./src/i18n";
import {
  renderLobbyFragment,
  renderQuestionFragment,
  renderRevealFragment,
  renderFinishedFragment,
  renderAnswerAckFragment,
  renderUnknownRoomFragment,
} from "./src/lib/liveFragments";

interface SocketData {
  code: string;
  userId: string;
  displayName: string;
  locale: Locale;
  isHost: boolean;
}

// Per-room connection registry. NOT Bun's built-in pub/sub topics, because
// each viewer needs a slightly personalized fragment (host-only controls) —
// this small in-process Set lets us render+send per-socket instead of
// broadcasting one identical string to everyone. Same single-instance
// limitation as the LiveSessionPort itself (see that adapter's header).
const roomSockets = new Map<string, Set<Bun.ServerWebSocket<SocketData>>>();

function registerSocket(ws: Bun.ServerWebSocket<SocketData>): void {
  const set = roomSockets.get(ws.data.code) ?? new Set();
  set.add(ws);
  roomSockets.set(ws.data.code, set);
}

function unregisterSocket(ws: Bun.ServerWebSocket<SocketData>): void {
  const set = roomSockets.get(ws.data.code);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) roomSockets.delete(ws.data.code);
}

/** Renders the whole-room fragment appropriate to `room`'s current phase, personalized per-viewer for host controls. */
function renderRoomFragment(room: RoomState, locale: Locale, isHost: boolean): string {
  if (room.phase === "lobby") return renderLobbyFragment({ room, locale, isHost });
  if (room.phase === "question-live") {
    const q = currentQuestion(room);
    if (!q) return renderLobbyFragment({ room, locale, isHost }); // defensive, shouldn't happen
    return renderQuestionFragment({ room, question: q, index: room.currentQuestionIndex, total: room.questions.length, locale, isHost });
  }
  if (room.phase === "reveal") {
    const q = currentQuestion(room);
    if (!q) return renderLobbyFragment({ room, locale, isHost });
    return renderRevealFragment({ room, question: q, locale, isHost });
  }
  // finished
  return null as unknown as string; // handled separately below (needs the scoreboard, computed async)
}

async function broadcastRoomState(code: string, room: RoomState): Promise<void> {
  const sockets = roomSockets.get(code);
  if (!sockets) return;
  const { liveSessionPort } = await getContainer();
  for (const ws of sockets) {
    if (room.phase === "finished") {
      const entries = await computeScoreboard(liveSessionPort, code);
      const teamEntries = await computeTeamScoreboard(liveSessionPort, code);
      ws.send(renderFinishedFragment({ entries, teamEntries, locale: ws.data.locale }));
    } else {
      ws.send(renderRoomFragment(room, ws.data.locale, ws.data.isHost));
    }
  }
}

function localeFromRequest(req: Request): Locale {
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang");
  return lang === "en" ? "en" : "pl";
}

async function handleCreate(req: Request): Promise<Response> {
  const user = await getUserFromCookieHeader(req.headers.get("cookie"));
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await req.formData();
  const setId = String(form.get("setId") ?? "");

  const { setRepo, cardRepo, liveSessionPort } = await getContainer();
  try {
    await getOwnedSet(setRepo, setId, user.id); // redundant with createLiveSession's own check, but fails fast with a clearer 403 before any room work
    const room = await createLiveSession(liveSessionPort, setRepo, cardRepo, { setId, hostId: user.id });
    const siteUrl = ENV.PUBLIC_SITE_URL || "http://localhost:4321";
    return Response.redirect(`${siteUrl}/live/${room.code}?lang=${user.locale}`, 303);
  } catch (err) {
    if (err instanceof NotFoundError) return new Response("Set not found", { status: 404 });
    if (err instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    if (err instanceof ValidationError) return new Response(err.message, { status: 400 });
    throw err;
  }
}

async function handleSocketUpgrade(req: Request, server: Bun.Server<SocketData>, code: string): Promise<Response> {
  const user = await getUserFromCookieHeader(req.headers.get("cookie"));
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { liveSessionPort } = await getContainer();
  let room;
  try {
    room = await getLiveRoom(liveSessionPort, code.toUpperCase());
  } catch (err) {
    if (err instanceof NotFoundError) return new Response("Room not found", { status: 404 });
    throw err;
  }

  const data: SocketData = {
    code: room.code,
    userId: user.id,
    displayName: user.displayName,
    locale: localeFromRequest(req),
    isHost: room.hostId === user.id,
  };
  const upgraded = server.upgrade(req, { data });
  if (!upgraded) return new Response("WebSocket upgrade failed", { status: 500 });
  // Bun handles the 101 response itself once upgraded; nothing more to return.
  return undefined as unknown as Response;
}

const port = Number(ENV.LIVE_WS_PORT) || 4322;

const server = Bun.serve<SocketData>({
  port,
  async fetch(req, srv) {
    const url = new URL(req.url);

    if (url.pathname === "/live/create" && req.method === "POST") {
      return handleCreate(req);
    }

    // Cheap existence check the main Astro app's /live/[code].astro page
    // uses (server-side fetch, not client JS) so an unknown/expired code
    // shows a clean "not found" message immediately, instead of the
    // browser opening a WebSocket that htmx-ext-ws will just retry
    // forever on an abnormal-closure code (its default reconnect
    // behavior — see ws.js). This is a plain existence check, not an auth
    // check: it doesn't leak anything a room code itself doesn't already.
    const existsMatch = url.pathname.match(/^\/live\/([^/]+)\/exists$/);
    if (existsMatch) {
      const { liveSessionPort } = await getContainer();
      const room = await liveSessionPort.getRoom(existsMatch[1]!.toUpperCase());
      return new Response(JSON.stringify({ exists: !!room }), {
        status: room ? 200 : 404,
        headers: { "content-type": "application/json" },
      });
    }

    const match = url.pathname.match(/^\/live\/([^/]+)$/);
    if (match) {
      return handleSocketUpgrade(req, srv, match[1]!);
    }

    return new Response("Not found", { status: 404 });
  },
  websocket: {
    async open(ws) {
      registerSocket(ws);
      const { liveSessionPort } = await getContainer();
      try {
        const room = await joinLiveSession(liveSessionPort, {
          code: ws.data.code,
          userId: ws.data.userId,
          displayName: ws.data.displayName,
        });
        // Unicast current state to the joiner (covers late joins mid-question)...
        if (room.phase === "finished") {
          const entries = await computeScoreboard(liveSessionPort, ws.data.code);
          const teamEntries = await computeTeamScoreboard(liveSessionPort, ws.data.code);
          ws.send(renderFinishedFragment({ entries, teamEntries, locale: ws.data.locale }));
        } else {
          ws.send(renderRoomFragment(room, ws.data.locale, ws.data.isHost));
        }
        // ...and refresh the lobby view for everyone else already waiting.
        if (room.phase === "lobby") await broadcastRoomState(ws.data.code, room);
      } catch (err) {
        if (err instanceof NotFoundError) {
          ws.send(renderUnknownRoomFragment(ws.data.locale));
          ws.close(1008, "Room not found");
          return;
        }
        throw err;
      }
    },

    async message(ws, raw) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(String(raw));
      } catch {
        return; // ignore malformed frames
      }

      const { liveSessionPort } = await getContainer();

      if (parsed.type === "answer") {
        const cardId = String(parsed.cardId ?? "");
        const rawAnswer = String(parsed.rawAnswer ?? "");
        try {
          const { result } = await submitLiveAnswer(liveSessionPort, {
            code: ws.data.code,
            userId: ws.data.userId,
            cardId,
            rawAnswer,
          });
          ws.send(renderAnswerAckFragment({ correct: result.correct, points: result.points, locale: ws.data.locale }));
        } catch {
          // Already answered / no question live / bad cardId: no-op. This is
          // ungraded practice, not a scored exam — silently ignoring a
          // duplicate/late submission is the right failure mode here.
        }
        return;
      }

      if (parsed.type === "advance") {
        if (!ws.data.isHost) return; // server-side enforcement is the real gate; see header comment
        try {
          const room = await advanceLiveQuestion(liveSessionPort, { code: ws.data.code, hostId: ws.data.userId });
          await broadcastRoomState(ws.data.code, room);
        } catch {
          // ForbiddenError can't actually happen here (isHost already
          // checked above), but NotFoundError could if the room somehow
          // vanished — nothing sensible to do but drop the message.
        }
        return;
      }

      if (parsed.type === "configureTeams") {
        // Slice 12 (teams): same double-gated host-only pattern as "advance"
        // above — the client-side hidden button is a UX nicety, this
        // transport-layer check AND setLiveTeams' own independent hostId
        // check (see liveQuizUsecases.ts) are the real enforcement.
        if (!ws.data.isHost) return;
        const teamCount = Number.parseInt(String(parsed.teamCount ?? ""), 10);
        if (!Number.isInteger(teamCount) || teamCount < 1) return; // ignore malformed input, ungraded setup step
        try {
          const room = await setLiveTeams(liveSessionPort, { code: ws.data.code, hostId: ws.data.userId, teamCount });
          await broadcastRoomState(ws.data.code, room);
        } catch {
          // ForbiddenError can't happen here (isHost already checked);
          // ValidationError (e.g. round already started) or NotFoundError
          // (room vanished) both just drop the message — team setup is a
          // pre-game step, not something worth surfacing a hard error for.
        }
        return;
      }

      if (parsed.type === "assignTeam") {
        // Manual per-player override on top of configureTeams' auto-split —
        // same double-gated host-only pattern (transport check here AND
        // assignLiveTeam's own independent hostId check).
        if (!ws.data.isHost) return;
        const targetUserId = String(parsed.userId ?? "");
        const teamId = parsed.teamId === null || parsed.teamId === "" ? null : String(parsed.teamId ?? "");
        if (!targetUserId) return; // ignore malformed input
        try {
          const room = await assignLiveTeam(liveSessionPort, {
            code: ws.data.code,
            hostId: ws.data.userId,
            userId: targetUserId,
            teamId,
          });
          await broadcastRoomState(ws.data.code, room);
        } catch {
          // Same reasoning as configureTeams above — a pre-game setup step,
          // drop silently on Forbidden/Validation/NotFound.
        }
      }
    },

    close(ws) {
      unregisterSocket(ws);
    },
  },
});

// eslint-disable-next-line no-console
console.log(`Kartka live-quiz sidecar listening on :${server.port}`);

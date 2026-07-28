# 20 feature ideas for Kartka v2 (Opus brainstorm, for human review)

Not committed to any roadmap slice — a candidate list, gathered after slice 1
shipped, to review before scoping slice 5+.

## Learning-science / scheduling depth

1. **FSRS scheduler option** — modern SRS algorithm (Anki's current default) as
   an opt-in alternative to SM-2, tuned per-user from review logs. Cuts review
   load for the same retention. (M; two scheduler code paths + migration story)
2. **Retention-target dial** — student sets desired retention % (exam vs
   casual), scheduler adapts aggressiveness. (S on FSRS, awkward on SM-2 alone)
3. **Exam-date cramming mode** — set a deadline, front-load+compress reviews to
   peak the day before, warn what got skipped. (M; deliberately trades off
   long-term retention, must be framed as a choice not the default)
4. **Leech detection & rescue** — flag repeatedly-failed cards, offer
   suspend/reword/split. (S; pairs well with slice-2 LLM for auto-rewrite)
5. **Sibling burying** — don't show cloze/reverse siblings in the same
   session so recall isn't inflated by having just seen the answer. (M;
   needs a "card generation group" concept)

## Content authoring

6. **Markdown + LaTeX + code blocks** — rich card bodies for STEM/CS students.
   (M; bundle-size tension with lean htmx/PWA footprint, needs sanitization)
7. **Audio cards / TTS** — attach audio or auto-generate pronunciation,
   audio-first review mode for language learners. (M; storage/CDN + another
   paid external adapter alongside the slice-2 LLM one)
8. **Occlusion from PDF/slides** — import a lecture PDF, drop occlusion
   regions directly on a page, reusing the image-occlusion engine. (M;
   PDF rendering is heavy client-side, rasterization adds server infra)
9. **Reverse/variant card generation** — one authored fact spawns multiple
   review directions (term→def, def→term, cloze variants) as a linked group.
   (M; same card-group dependency as #5)

## Insight / metacognition

10. **Personal retention dashboard** — per-set/tag true retention %, mature vs
    young cards, upcoming load forecast. Student-facing, distinct from
    slice-4's admin analytics. (M)
11. **Review-load forecast calendar** — heatmap of cards due per upcoming day,
    so authoring binges don't create a review-debt cliff. (S)
12. **Confidence-vs-correctness calibration** — flag when a student rates
    "Easy" but later fails, surfacing overconfidence. (M; needs self-rated
    history, noisy with too little data)

## Social / collaborative (extends slice 3 sharing)

13. **Collaborative set editing** — multiple students co-author one set
    (study-group decks) with per-card attribution. (L; concurrent edit +
    permissions well beyond slice-3's clone-on-import, hard over htmx alone)
14. **Card-level discussion/reports** — comment on or flag a wrong card on
    public sets. (M; needs slice-3 public sets first, feeds slice-4 admin)
15. **Async study duels** — challenge a friend on the same 10-card subset,
    compare accuracy/speed after the fact (not live). (M; needs slice-3
    identity/sharing; resist making it real-time)

## Teacher / classroom

16. **Class assignment mode** — teacher assigns a set with a due date, sees
    per-student completion (not grades). (L; introduces a teacher role +
    enrollment concept beyond student/admin)
17. **Aggregate weak-card heatmap for teachers** — anonymized class-wide
    failure heatmap per card. (M; depends on #16, privacy framing must be
    airtight for minors)

## Mobile / offline / habit

18. **True offline review queue** — service-worker-cached due cards, full
    session works with zero connectivity, sync ratings on reconnect. (L;
    hardest item on the list — current SSR/htmx model assumes a server
    round-trip per interaction, offline write+reconciliation is a real
    architectural stretch)
19. **Daily reminder notifications** — Web Push nudges when cards are due,
    student-set quiet hours. (M; needs a push service + VAPID keys, iOS PWA
    push support is finicky)

## Accessibility / inclusion

20. **Dyslexia & low-vision review mode** — OpenDyslexic font option,
    adjustable size/spacing/contrast, honored in review. (S; slots cleanly
    into existing i18n/theming, no real architectural tension)

## Opus's top 5 if prioritizing v2

1. FSRS scheduler (#1) — biggest quality lever, everything else compounds on it
2. True offline queue (#18) — the defensible PWA moat vs Quizlet, start early since it's hard
3. Markdown+LaTeX+code (#6) — unlocks the whole STEM/CS demographic
4. Exam-date cramming mode (#3) — matches how students actually study
5. Daily reminders (#19) — cheap habit infra; nothing else lands without daily return

Runner-up called out on principle: dyslexia/low-vision mode (#20) — S-effort,
high values-signal, arguably belongs in the top 5.

## Argued against

**Live/real-time multiplayer quiz (Kahoot-style)** — fights the htmx/SSR
architecture (needs websockets/realtime infra), pulls Kartka toward
"classroom game" and away from "serious retention tool," competes head-on
with Kahoot/Gimkit where it won't win. Async duels (#15) get most of the
motivational upside without the blast radius.

**Broad gamification (XP/badges/leaderboards)** — treat with suspicion beyond
a simple streak counter; layered points economies erode the clean, high-
signal design ethos and train students to optimize the metric instead of
their memory.

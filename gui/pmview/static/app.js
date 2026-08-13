"use strict";

// pmview front-end. Reads come from this server; writes are POSTed here and
// forwarded to the memory GUI API, so a 503 with code "memory_unavailable" means
// "start agentic-memory-gui", not "the board is broken".

const state = { project: null, view: "board", issueFilter: "all", memory: { available: false } };

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const kid of kids.flat()) if (kid != null) node.append(kid.nodeType ? kid : String(kid));
  return node;
};
const q = (params) => new URLSearchParams({ project: state.project, ...params }).toString();

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || response.statusText), data);
  return data;
}

function toast(message, bad = false) {
  const node = $("#toast");
  node.textContent = message;
  node.className = "toast" + (bad ? " bad" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.add("hidden"), 4200);
}

const shortId = (id) => (id || "").slice(0, 8);
const when = (stamp) => (stamp ? stamp.replace("T", " ").slice(0, 16) : "—");

// --- board -------------------------------------------------------------------

function stat(label, value, alert = false) {
  return el("div", { className: "stat" + (alert && value ? " alert" : "") },
    el("b", {}, value), el("span", {}, label));
}

function cardEl(card) {
  const counts = card.counts;
  const pills = [
    card.epic && el("span", { className: "pill" }, card.epic),
    counts.nodes ? el("span", { className: "pill" }, `${counts.nodes} captured`) : null,
    counts.referenced ? el("span", { className: "pill" }, `${counts.referenced} inherited`) : null,
    counts.flagged ? el("span", { className: "pill warn" }, `${counts.flagged} to review`) : null,
    counts.contradictions ? el("span", { className: "pill danger" }, `${counts.contradictions} contradictions`) : null,
    !card.linked ? el("span", { className: "pill warn" }, "not in graph") : null,
    card.plan_stub ? el("span", { className: "pill" }, "plan stub") : null,
  ];
  const node = el("div", { className: "card" },
    el("h3", {}, card.title || card.id),
    card.title && card.title !== card.id ? el("div", { className: "mono" }, card.id) : null,
    card.goal ? el("div", { className: "goal" }, card.goal) : null,
    el("div", { className: "row" }, pills),
  );
  node.onclick = () => openChange(card.id);
  return node;
}

async function renderBoard() {
  const data = await api("/api/board?" + q());
  const totals = data.totals;
  const view = $("#view-board");
  view.replaceChildren(
    el("div", { className: "totals" },
      stat("changes", totals.changes),
      stat("nodes", totals.nodes),
      stat("needs review", totals.flagged, true),
      stat("unlinked changes", totals.unlinked, true),
      stat("journal events", totals.events),
      stat("dormant nodes", totals.archived),
    ),
    el("div", { className: "columns" },
      data.stages.filter((s) => s.changes.length).map((stage) =>
        el("div", { className: "column" },
          el("h2", {}, el("span", {}, stage.name), el("span", {}, String(stage.changes.length))),
          stage.changes.map(cardEl),
        )),
    ),
  );
  if (!data.stages.some((s) => s.changes.length)) {
    view.append(el("p", { className: "empty" }, "No change folders under context/changes or context/archive."));
  }
}

// --- issues ------------------------------------------------------------------

const ISSUE_FILTERS = ["all", "disputed", "contested", "open", "dormant"];
const STATUS_CLASS = { disputed: "warn", contested: "danger", dormant: "", open: "ok" };

async function renderIssues() {
  const issues = await api("/api/issues?" + q());
  const view = $("#view-issues");
  const counts = Object.fromEntries(ISSUE_FILTERS.map((f) => [f,
    f === "all" ? issues.length : issues.filter((i) => i.status === f).length]));

  const filters = el("div", { className: "filters" },
    ISSUE_FILTERS.map((name) => {
      const button = el("button", {
        className: state.issueFilter === name ? "active" : "",
        textContent: `${name} (${counts[name]})`,
      });
      button.onclick = () => { state.issueFilter = name; renderIssues(); };
      return button;
    }));

  const shown = issues.filter((i) => state.issueFilter === "all" || i.status === state.issueFilter);
  const list = el("div", { className: "list" }, shown.map((issue) => {
    const item = el("div", { className: "item" },
      el("div", { className: "row" },
        el("span", { className: `pill ${STATUS_CLASS[issue.status] || ""}` }, issue.status),
        el("span", { className: "pill type" }, issue.type),
        el("span", { className: "pill" }, issue.tier),
        issue.change ? el("span", { className: "pill" }, issue.change) : null,
        issue.facets.map((f) => el("span", { className: "pill" }, f)),
      ),
      el("p", {}, issue.preview),
      el("div", { className: "mono" },
        `${shortId(issue.id)} · trust ${issue.trust_weight.toFixed(2)} · ${issue.event_count} events · last ${when(issue.last_event)}`),
    );
    item.onclick = () => openNode(issue.id);
    return item;
  }));

  view.replaceChildren(filters, shown.length ? list : el("p", { className: "empty" }, "Nothing in this bucket."));
}

// --- search ------------------------------------------------------------------

let searchTimer;
function wireSearch() {
  $("#q").oninput = (event) => {
    clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = setTimeout(async () => {
      const results = value.trim() ? await api("/api/search?" + q({ q: value })) : [];
      $("#search-results").replaceChildren(...results.map((node) => {
        const item = el("div", { className: "item" },
          el("div", { className: "row" },
            el("span", { className: "pill type" }, node.type),
            el("span", { className: "pill" }, node.tier),
            node.needs_review ? el("span", { className: "pill warn" }, "needs review") : null,
            node.archived ? el("span", { className: "pill" }, "dormant") : null,
          ),
          el("p", {}, node.preview),
          el("div", { className: "mono" }, `${shortId(node.id)} · ${node.path}`));
        item.onclick = () => openNode(node.id);
        return item;
      }));
      if (value.trim() && !results.length) {
        $("#search-results").replaceChildren(el("p", { className: "empty" }, "No matches."));
      }
    }, 160);
  };
}

// --- drawer ------------------------------------------------------------------

function openDrawer(...content) {
  const drawer = $("#drawer");
  const close = el("button", { className: "close", textContent: "×", title: "Close" });
  close.onclick = closeDrawer;
  // Sections are conditionally null; replaceChildren would stringify those into a
  // literal "null" in the panel, so drop them here.
  drawer.replaceChildren(close, ...content.flat().filter((node) => node != null));
  drawer.classList.remove("hidden");
  $("#scrim").classList.remove("hidden");
}
function closeDrawer() {
  $("#drawer").classList.add("hidden");
  $("#scrim").classList.add("hidden");
}

function nodeLine(entry) {
  const node = entry.node || entry;
  const line = el("div", { className: "edge" },
    entry.edge_type ? el("span", { className: "kind" }, entry.edge_type) : null,
    el("div", {},
      el("div", {}, node.preview),
      el("div", { className: "path mono" }, `${shortId(node.id)} · ${node.type} · ${node.path}`)),
  );
  line.onclick = () => openNode(node.id);
  return line;
}

async function openChange(changeId) {
  const change = await api(`/api/changes/${encodeURIComponent(changeId)}?` + q());
  const sections = Object.entries(change.sections || {})
    .filter(([name]) => name !== "Goal")
    .map(([name, text]) => el("section", {}, el("h2", {}, name), el("div", { className: "body" }, text)));

  openDrawer(
    el("h3", {}, change.title || change.id),
    el("div", { className: "mono" }, `${change.id} · ${change.stage}${change.epic ? " · " + change.epic : ""}`),
    change.warnings.length
      ? el("div", {}, change.warnings.map((w) => el("div", { className: "warn-line" }, "⚠ " + w)))
      : null,
    change.goal ? el("section", {}, el("h2", {}, "Goal"), el("div", { className: "body" }, change.goal)) : null,
    change.goal_node
      ? el("section", {}, el("h2", {}, "Goal node"), nodeLine(change.goal_node))
      : el("p", { className: "warn-line" }, "No goal node resolved — this change is not joined to the graph."),
    change.plan_phases.length
      ? el("section", {}, el("h2", {}, "Plan phases"),
          el("ol", {}, change.plan_phases.map((p) => el("li", {}, p))))
      : null,
    change.contradiction_pairs.length
      ? el("section", {}, el("h2", {}, `Contradictions (${change.contradiction_pairs.length})`),
          change.contradiction_pairs.map((pair) =>
            el("div", {}, nodeLine(pair.source), nodeLine(pair.target))))
      : null,
    el("section", {}, el("h2", {}, `Captured by this change (${change.nodes.length})`),
      change.nodes.length ? change.nodes.map(nodeLine) : el("p", { className: "empty" }, "None.")),
    change.referenced_nodes.length
      ? el("section", {}, el("h2", {}, `Inherited context (${change.referenced_nodes.length})`),
          change.referenced_nodes.map(nodeLine))
      : null,
    ...sections,
  );
}

async function openNode(nodeId) {
  const detail = await api(`/api/nodes/${encodeURIComponent(nodeId)}?` + q());
  const node = detail.node;

  const textarea = el("textarea", { value: node.body, spellcheck: false });
  const reason = el("input", { placeholder: "why (journaled with the edit)", className: "mono" });
  const save = el("button", { className: "btn", textContent: "Save body" });
  save.onclick = async () => {
    save.disabled = true;
    try {
      await api(`/api/nodes/${encodeURIComponent(node.id)}/body`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: textarea.value, reason: reason.value }),
      });
      toast("Body updated and journaled.");
      openNode(node.id);
      refresh();
    } catch (error) {
      toast(error.message, true);
    } finally {
      save.disabled = false;
    }
  };

  openDrawer(
    el("h3", {}, node.path),
    el("div", { className: "row" },
      el("span", { className: "pill type" }, node.type),
      el("span", { className: "pill" }, node.tier),
      node.needs_review ? el("span", { className: "pill warn" }, "needs review") : null,
      node.archived ? el("span", { className: "pill" }, "dormant") : null,
      detail.change ? el("span", { className: "pill" }, detail.change) : null,
      detail.facets.map((f) => el("span", { className: "pill" }, f)),
    ),
    el("div", { className: "mono" },
      `${node.id} · trust ${node.trust_weight.toFixed(2)} · retrieval ${node.retrieval_weight.toFixed(2)} · created ${when(node.created_at)}`),

    el("section", {}, el("h2", {}, "Body"), textarea,
      el("div", { className: "actions" }, save, reason)),

    node.needs_review ? resolveSection(node) : null,
    tierSection(node),

    el("section", {}, el("h2", {}, `Journal (${detail.events.length})`),
      el("div", { className: "events" }, detail.events.slice().reverse().map((event) =>
        el("div", { className: "event" + (event.polarity < 0 ? " neg" : "") },
          el("div", { className: "when" }, `${when(event.created_at)}`),
          el("div", { className: "what" },
            el("div", {}, `${event.type} · ${event.source} · w ${event.weight}`),
            event.reason ? el("div", { className: "mono" }, event.reason) : null))))),

    el("section", {}, el("h2", {}, `Outgoing (${detail.outgoing.length})`),
      detail.outgoing.length ? detail.outgoing.map(nodeLine) : el("p", { className: "empty" }, "None.")),
    el("section", {}, el("h2", {}, `Incoming (${detail.incoming.length})`),
      detail.incoming.length ? detail.incoming.map(nodeLine) : el("p", { className: "empty" }, "None.")),
  );
}

// The human gate: resolution goes through the memory server's guided endpoint,
// which is what folds trust and clears the flag. The board never touches either.
function resolveSection(node) {
  const actions = ["still_valid", "superseded", "wrong", "needs_correction", "defer"];
  const choice = el("select", {}, ...actions.map((a) => el("option", { value: a }, a)));
  const note = el("input", { placeholder: "reason (optional)" });
  const correction = el("textarea", { placeholder: "corrected body (required for needs_correction)" });
  const apply = el("button", { className: "btn", textContent: "Resolve" });
  apply.onclick = async () => {
    apply.disabled = true;
    try {
      await api(`/api/review/${encodeURIComponent(node.id)}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: choice.value, reason: note.value,
          new_body: correction.value || undefined, recompute_trust: true,
        }),
      });
      toast("Resolved.");
      openNode(node.id);
      refresh();
    } catch (error) {
      toast(error.message, true);
    } finally {
      apply.disabled = false;
    }
  };
  return el("section", {}, el("h2", {}, "Resolve review flag"),
    el("div", { className: "actions" }, choice, note, apply), correction);
}

function tierSection(node) {
  const tiers = ["short-term", "mid-term", "long-term", "lifetime"];
  const choice = el("select", {}, ...tiers.map((t) =>
    el("option", { value: t, selected: t === node.tier }, t)));
  const apply = el("button", { className: "btn secondary", textContent: "Set tier" });
  apply.onclick = async () => {
    const tier = choice.value;
    // Lifetime is the one promotion the memory server refuses without an explicit
    // human confirmation; ask for it here rather than sending a request we know fails.
    if (tier === "lifetime" && !confirm("Promote to lifetime? This node will be served by every future recall.")) return;
    apply.disabled = true;
    try {
      await api(`/api/nodes/${encodeURIComponent(node.id)}/tier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, confirmed: true, reason: "set from the project board" }),
      });
      toast(`Tier set to ${tier}.`);
      openNode(node.id);
      refresh();
    } catch (error) {
      toast(error.message, true);
    } finally {
      apply.disabled = false;
    }
  };
  return el("section", {}, el("h2", {}, "Tier"), el("div", { className: "actions" }, choice, apply));
}

// --- shell -------------------------------------------------------------------

function refresh() {
  const render = { board: renderBoard, issues: renderIssues, search: async () => {} }[state.view];
  render().catch((error) => toast(error.message, true));
}

function showView(name) {
  state.view = name;
  for (const button of document.querySelectorAll(".tabs button")) {
    button.classList.toggle("active", button.dataset.view === name);
  }
  for (const section of document.querySelectorAll(".view")) {
    section.classList.toggle("hidden", section.id !== `view-${name}`);
  }
  refresh();
}

async function boot() {
  const projects = await api("/api/projects");
  const select = $("#project");
  select.replaceChildren(...projects.map((p) => el("option", { value: p.name }, p.name)));
  select.onchange = () => { state.project = select.value; refresh(); };
  state.project = projects[0] && projects[0].name;
  if (projects[0] && projects[0].store_missing) toast(`${projects[0].name} has no memory store on disk.`, true);

  state.memory = await api("/api/memory/status");
  const badge = $("#memory-status");
  badge.textContent = state.memory.available ? "memory: connected" : "memory: read-only";
  badge.className = "pill " + (state.memory.available ? "ok" : "warn");
  badge.title = state.memory.available
    ? "writes go to the agentic-memory GUI API"
    : "start `uv run agentic-memory-gui` to enable edits, resolutions and tier changes";

  for (const button of document.querySelectorAll(".tabs button")) {
    button.onclick = () => showView(button.dataset.view);
  }
  $("#scrim").onclick = closeDrawer;
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
  wireSearch();
  showView("board");
}

boot().catch((error) => toast(error.message, true));

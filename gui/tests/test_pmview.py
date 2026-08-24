"""Tests for pmview: parsers, the lifecycle↔graph join, and the HTTP surface.

They run against the dogfooded Coffer store committed in this repo, so they cover
the real dump format rather than a hand-made fixture.
"""

from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pmview import design as design_mod  # noqa: E402
from pmview import graph as graph_mod  # noqa: E402
from pmview import lifecycle  # noqa: E402
from pmview import server as server_mod  # noqa: E402
from pmview.board import Board  # noqa: E402
from pmview.server import Project, build_server, discover  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
COFFER = REPO / "dogfood" / "coffer"


def store_path(root: Path = COFFER) -> Path:
    """The store as a fresh clone actually finds it.

    `context/memory-graph.db` is gitignored — it is a local build artifact the
    store rebuilds from the committed text dump. Tests that named the `.db`
    literally passed only on a machine that had already opened the project.
    """
    for name in server_mod.STORE_NAMES:
        candidate = root / "context" / name
        if candidate.is_file():
            return candidate
    raise AssertionError(f"no store under {root / 'context'} (looked for {server_mod.STORE_NAMES})")


def load_board(root: Path = COFFER) -> Board:
    return Board(lifecycle.scan(root / "context"), graph_mod.load(store_path(root)))


class DumpParsingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.graph = graph_mod.load(store_path())

    def test_reads_nodes_edges_and_events(self) -> None:
        self.assertGreater(len(self.graph.nodes), 100)
        self.assertGreater(len(self.graph.edges), 100)
        self.assertGreater(len(self.graph.events), 100)

    def test_node_fields_round_trip_from_the_dump(self) -> None:
        goal = self.graph.nodes["66cd3d85-2920-4768-8953-4fd191446b5c"]
        self.assertEqual(goal.type, "goal")
        self.assertEqual(goal.tier, "short-term")
        self.assertEqual(goal.path, "/goal/coffer-analytics")
        self.assertFalse(goal.archived)
        self.assertEqual(goal.trust_weight, 1.0)
        self.assertIn("analytics over classified transactions", goal.body)

    def test_booleans_are_parsed_not_truthy_strings(self) -> None:
        archived = [n for n in self.graph.nodes.values() if n.archived]
        self.assertTrue(archived, "the dogfood store has archived nodes")
        self.assertTrue(all(isinstance(n.archived, bool) for n in self.graph.nodes.values()))

    def test_edges_attach_to_their_source(self) -> None:
        out = self.graph.outgoing("66cd3d85-2920-4768-8953-4fd191446b5c")
        self.assertTrue(out)
        self.assertTrue(all(e.type == "DEPENDS_ON" for e in out))
        self.assertTrue(all(e.created_at for e in out))

    def test_events_carry_reason_and_node(self) -> None:
        event = next(e for e in self.graph.events if e.type == "manual_review" and e.reason)
        self.assertIn(event.node_id, self.graph.nodes)
        self.assertIn(event.polarity, (-1, 1))

    def test_header_comment_is_not_a_record(self) -> None:
        # The dump opens with `# agentic-memory-system dump` before the first node;
        # it must be skipped without swallowing that node.
        self.assertFalse(any(node_id.startswith("#") for node_id in self.graph.nodes))
        self.assertIn("2a712c73-6319-44f2-bb33-a63b2e3bccab", self.graph.nodes)
        self.assertTrue(all(node.type for node in self.graph.nodes.values()))

    def test_empty_and_garbage_input_do_not_raise(self) -> None:
        self.assertEqual(len(graph_mod.parse_dump("").nodes), 0)
        self.assertEqual(len(graph_mod.parse_dump("not a dump\n---\nstill not").nodes), 0)


class LifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.changes = {c.id: c for c in lifecycle.scan(COFFER / "context")}

    def test_finds_active_and_archived_changes(self) -> None:
        self.assertIn("coffer-packaging", self.changes)
        self.assertIn("coffer-analytics", self.changes)
        self.assertTrue(self.changes["coffer-analytics"].archived)
        self.assertFalse(self.changes["coffer-packaging"].archived)

    def test_parses_preamble_goal_and_node_refs(self) -> None:
        change = self.changes["coffer-analytics"]
        self.assertEqual(change.status, "archived")
        self.assertEqual(change.epic, "coffer-mvp")
        self.assertEqual(change.memory_goal, "66cd3d85-2920-4768-8953-4fd191446b5c")
        self.assertIn("attribution modes", change.goal)
        self.assertNotIn("memory_goal", change.goal)
        self.assertIn("1640b1ee", change.node_refs)

    def test_archive_note_is_kept_as_a_section(self) -> None:
        self.assertIn("Archive note", self.changes["coffer-analytics"].sections)

    def test_plan_only_folder_is_unopened_and_warned_about(self) -> None:
        change = self.changes["coffer-packaging"]
        self.assertEqual(change.stage, "unopened")
        self.assertTrue(change.plan_stub)
        self.assertTrue(change.plan_phases)
        self.assertTrue(any("no change.md" in w for w in change.warnings))

    def test_plan_phase_titles_are_clean(self) -> None:
        phases = self.changes["coffer-packaging"].plan_phases
        self.assertTrue(phases)
        self.assertEqual(phases[0], "P1 adapter-node server")
        for phase in phases:
            self.assertNotIn("*", phase)
            self.assertFalse(phase.startswith(("-", " ")))

    def test_missing_directory_yields_no_changes(self) -> None:
        self.assertEqual(lifecycle.scan(Path("/nonexistent")), [])


class BoardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.board = load_board()
        self.analytics = next(c for c in self.board.changes if c.id == "coffer-analytics")

    def test_change_joins_to_its_goal_and_anchor(self) -> None:
        goal = self.board.goal_for(self.analytics)
        anchor = self.board.anchor_for(self.analytics)
        self.assertIsNotNone(goal)
        self.assertEqual(goal.path, "/goal/coffer-analytics")
        self.assertIsNotNone(anchor)
        self.assertEqual(anchor.type, "slice")

    def test_scoped_nodes_exclude_structural_anchors(self) -> None:
        nodes = self.board.scoped_nodes(self.analytics)
        self.assertTrue(nodes)
        self.assertFalse([n for n in nodes if n.type in ("slice", "facet_value")])

    def test_scoped_to_is_read_in_the_direction_the_store_writes_it(self) -> None:
        # SCOPED_TO runs anchor → artifact. Reading it backwards silently produced
        # cards populated only by the goal's DEPENDS_ON fan-out, and an issue queue
        # where no node knew which change it belonged to.
        anchor = self.board.anchor_for(self.analytics)
        via_anchor = {
            e.target_id for e in self.board.graph.outgoing(anchor.id) if e.type == "SCOPED_TO"
        }
        self.assertTrue(via_anchor)
        self.assertEqual(self.board.scoped_ids(self.analytics), via_anchor)

    def test_captured_and_inherited_nodes_are_counted_apart(self) -> None:
        # The goal's DEPENDS_ON fan-out carries parent-refs seeded from earlier
        # slices; folding those into the captured count overstates the card.
        scoped = self.board.scoped_ids(self.analytics)
        referenced = self.board.referenced_ids(self.analytics)
        self.assertTrue(scoped and referenced)
        self.assertFalse(scoped & referenced, "the two sets must not overlap")
        card = self.board.card(self.analytics)
        self.assertEqual(card["counts"]["nodes"], len(self.board.scoped_nodes(self.analytics)))
        self.assertEqual(card["counts"]["referenced"], len(self.board.referenced_nodes(self.analytics)))

    def test_captured_count_agrees_with_the_memory_servers_own(self) -> None:
        # agentic-memory-system's /api/changes counts edges with source_id = anchor
        # and type = SCOPED_TO; the board's "captured" number must be the same one.
        for change in self.board.changes:
            anchor = self.board.anchor_for(change)
            if anchor is None:
                continue
            expected = sum(
                1 for e in self.board.graph.edges
                if e.source_id == anchor.id and e.type == "SCOPED_TO"
            )
            captured = self.board.scoped_ids(change)
            with self.subTest(change=change.id):
                self.assertEqual(len(captured), expected)

    def test_every_scoped_node_reports_its_change(self) -> None:
        issues = [i for i in self.board.issues() if i["type"] == "issue"]
        self.assertTrue(issues)
        self.assertTrue(any(i["change"] for i in issues),
                        "issue nodes must resolve back to the change that scoped them")
        for issue in issues:
            if issue["change"]:
                self.assertIn(f"/change/{issue['change']}",
                              [n.path for n in self.board.graph.nodes.values()])

    def test_node_refs_in_change_md_are_expanded_to_full_ids(self) -> None:
        ids = {n.id for n in self.board.scoped_nodes(self.analytics)}
        self.assertTrue(any(i.startswith("1640b1ee") for i in ids))

    def test_board_groups_changes_by_stage(self) -> None:
        board = self.board.board()
        stages = {s["name"]: s["changes"] for s in board["stages"]}
        self.assertTrue(stages["archived"])
        self.assertEqual([c["id"] for c in stages["unopened"]], ["coffer-packaging"])
        self.assertEqual(board["totals"]["changes"], len(self.board.changes))
        self.assertIn("coffer-mvp", board["epics"])

    def test_card_counts_are_consistent_with_the_graph(self) -> None:
        card = self.board.card(self.analytics)
        nodes = self.board.scoped_nodes(self.analytics)
        self.assertEqual(card["counts"]["nodes"], len(nodes))
        self.assertEqual(card["counts"]["flagged"],
                         len([n for n in nodes if n.needs_review and not n.archived]))
        self.assertTrue(card["linked"])

    def test_issue_view_covers_issue_nodes_and_the_review_backlog(self) -> None:
        issues = self.board.issues()
        self.assertTrue(issues)
        types = {i["type"] for i in issues}
        self.assertIn("issue", types)
        flagged = [i for i in issues if i["status"] == "disputed"]
        self.assertEqual(
            len(flagged),
            len([n for n in self.board.graph.nodes.values() if n.needs_review and not n.archived]),
        )

    def test_issue_view_can_exclude_the_flagged_backlog(self) -> None:
        only_issues = self.board.issues(include_flagged=False)
        self.assertTrue(all(i["type"] == "issue" for i in only_issues))

    def test_dormant_nodes_are_labelled_not_hidden(self) -> None:
        statuses = {i["status"] for i in self.board.issues()}
        self.assertIn("dormant", statuses)

    def test_node_detail_carries_body_journal_and_both_edge_directions(self) -> None:
        detail = self.board.node_detail("66cd3d85-2920-4768-8953-4fd191446b5c")
        self.assertIn("body", detail["node"])
        self.assertTrue(detail["outgoing"])
        self.assertTrue(detail["events"])
        stamps = [e["created_at"] for e in detail["events"]]
        self.assertEqual(stamps, sorted(stamps), "journal is shown oldest-first")

    def test_unknown_ids_return_none(self) -> None:
        self.assertIsNone(self.board.node_detail("nope"))
        self.assertIsNone(self.board.change_detail("nope"))

    def test_search_matches_body_path_and_id_prefix(self) -> None:
        self.assertTrue(self.board.search("partition"))
        self.assertTrue(self.board.search("/goal/coffer-analytics"))
        self.assertTrue(self.board.search("66cd3d85"))
        self.assertEqual(self.board.search("   "), [])

    def test_a_project_without_a_store_still_produces_a_board(self) -> None:
        board = Board(lifecycle.scan(REPO / "dogfood" / "interview-copilot" / "context"), graph_mod.Graph())
        rendered = board.board()
        self.assertTrue(rendered["totals"]["changes"])
        self.assertEqual(rendered["totals"]["unlinked"], rendered["totals"]["changes"])


def make_sqlite_store(path: Path) -> sqlite3.Connection:
    """A minimal store in the memory system's schema, in WAL mode like the real one."""
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        "CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, tier TEXT, path TEXT, body TEXT,"
        " created_at TEXT, needs_review INTEGER, retrieval_weight REAL, trust_weight REAL, archived INTEGER)")
    conn.execute("CREATE TABLE edges (source_id TEXT, target_id TEXT, type TEXT, created_at TEXT)")
    conn.execute(
        "CREATE TABLE events (id TEXT PRIMARY KEY, node_id TEXT, type TEXT, weight REAL,"
        " polarity INTEGER, source TEXT, reason TEXT, created_at TEXT)")
    conn.execute(
        "INSERT INTO nodes VALUES ('n1','decision','short-term','/artifact/x','original',"
        "'2026-01-01T00:00:00+00:00',0,1.0,1.0,0)")
    conn.commit()
    return conn


class SqliteStoreTests(unittest.TestCase):
    """The live store is SQLite; the committed dump is the same graph in text."""

    def setUp(self) -> None:
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir, True)
        (self.dir / "context").mkdir()
        self.store_path = self.dir / "context" / "memory-graph.db"
        self.conn = make_sqlite_store(self.store_path)
        self.addCleanup(self.conn.close)

    def test_sqlite_is_detected_and_read(self) -> None:
        g = graph_mod.load(self.store_path)
        self.assertEqual(g.nodes["n1"].body, "original")
        self.assertEqual(g.nodes["n1"].type, "decision")
        self.assertFalse(g.nodes["n1"].needs_review)

    def test_cache_refreshes_when_only_the_wal_sidecar_changes(self) -> None:
        # Regression: SQLite in WAL mode commits into `<db>-wal`, leaving the main
        # file's mtime untouched — a fingerprint over the `.db` alone served a stale
        # board immediately after every edit made through the memory server.
        view = server_mod.ProjectView(Project("t", self.dir))
        self.assertEqual(view.board().graph.nodes["n1"].body, "original")
        main_mtime = self.store_path.stat().st_mtime_ns

        self.conn.execute("UPDATE nodes SET body = 'edited' WHERE id = 'n1'")
        self.conn.commit()

        self.assertEqual(self.store_path.stat().st_mtime_ns, main_mtime,
                         "precondition: the WAL commit left the main file untouched")
        self.assertEqual(view.board().graph.nodes["n1"].body, "edited")

    def test_invalidate_forces_a_reread(self) -> None:
        view = server_mod.ProjectView(Project("t", self.dir))
        first = view.board()
        self.assertIs(view.board(), first, "unchanged files reuse the cached board")
        view.invalidate()
        self.assertIsNot(view.board(), first)


class DesignLaneTests(unittest.TestCase):
    """The desk: a file, folded into state that is never stored."""

    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, True)
        self.dir = self.root / "context" / "design" / "s1"
        self.dir.mkdir(parents=True)
        self.log = self.dir / "asks.jsonl"

    def test_the_surface_slug_cannot_collide(self) -> None:
        """impeccable's own slug keeps the *tail* at 50 chars, so two different
        deep paths collapse to one key — merging two surfaces' decks and, fatally,
        their append-only desks."""
        a = "web/src/components/dashboard/widgets/revenue/chart/index.html"
        b = "mobile/src/components/dashboard/widgets/revenue/chart/index.html"
        self.assertNotEqual(design_mod.gw_slug(a), design_mod.gw_slug(b))
        # …while still agreeing with impeccable on the short paths that matter.
        self.assertEqual(design_mod.gw_slug("gui/pmview/static/index.html"),
                         "gui-pmview-static-index-html")

    def test_ask_state_is_folded_not_stored(self) -> None:
        design_mod.append(self.log, [
            {"kind": "ask", "id": "a1", "session": "s", "by": "agent"},
            {"kind": "ask", "id": "a2", "session": "s", "by": "agent"},
            {"kind": "ask", "id": "a3", "session": "s", "by": "agent"},
            {"kind": "ask", "id": "a4", "session": "s", "by": "agent"},
            {"kind": "ask", "id": "a5", "session": "s", "by": "agent"},
            {"kind": "answer", "id": "h1", "ask": "a2", "by": "human"},
            {"kind": "ack", "id": "k1", "session": "s", "refs": ["a3"], "by": "agent"},
            {"kind": "decline", "id": "h2", "ask": "a4", "by": "human"},
            {"kind": "retire", "id": "r1", "refs": ["a5"], "by": "agent"},
        ])
        states = {t["id"]: t["state"] for t in design_mod.read_asks(self.log)["threads"]}
        self.assertEqual(states, {"a1": "open", "a2": "answered", "a3": "landed",
                                  "a4": "declined", "a5": "retired"})

    def test_the_delivery_cursor_is_per_session(self) -> None:
        """A global cursor means agent B acking an answer to agent A's ask makes
        that answer invisible to A — so A times out having never seen the reply."""
        design_mod.append(self.log, [
            {"kind": "ask", "id": "a1", "session": "A", "by": "agent"},
            {"kind": "answer", "id": "h1", "ask": "a1", "by": "human"},
            {"kind": "ack", "id": "k1", "session": "B", "refs": ["h1"], "by": "agent"},
        ])
        to_a = [l["id"] for l in design_mod.read_asks(self.log, session="A")["undelivered"]]
        to_b = [l["id"] for l in design_mod.read_asks(self.log, session="B")["undelivered"]]
        self.assertEqual(to_a, ["h1"], "A must still be delivered its own answer")
        self.assertEqual(to_b, [], "B acked it")

    def test_one_malformed_line_never_takes_down_the_desk(self) -> None:
        self.log.write_text(
            '{"kind":"ask","id":"a1","session":"s"}\n'
            'not json at all\n'
            '{"kind":"answer","id":"h1","ask":"a1"}\n', encoding="utf-8")
        desk = design_mod.read_asks(self.log)
        self.assertEqual(desk["lines"], 2)
        self.assertEqual(len(desk["warnings"]), 1)
        self.assertEqual(desk["threads"][0]["state"], "answered")

    def test_a_broken_deck_degrades_to_a_warning(self) -> None:
        (self.dir / "deck.json").write_text("{ not json", encoding="utf-8")
        deck, warnings = design_mod.read_deck(self.dir / "deck.json")
        self.assertEqual(deck, {})
        self.assertTrue(warnings and "not valid JSON" in warnings[0])
        self.assertEqual(design_mod.surfaces(self.root)[0]["surface"], "s1")

    def test_a_deck_whose_target_keys_elsewhere_is_flagged(self) -> None:
        (self.dir / "deck.json").write_text(
            json.dumps({"target": "some/other/path.html", "screens": []}), encoding="utf-8")
        warnings = design_mod.surfaces(self.root)[0]["warnings"]
        self.assertTrue(any("sharing one desk" in w for w in warnings), warnings)

    def test_pmview_cannot_construct_an_agent_line(self) -> None:
        for kind in sorted(design_mod.AGENT_KINDS):
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                design_mod.construct(kind, "s1", "b1", {"text": "x"})

    def test_a_constructed_line_is_stamped_by_the_server(self) -> None:
        line = design_mod.construct("answer", "s1", "b1",
                                    {"ask": "a1", "choice": "A", "text": "x" * 9000,
                                     "by": "agent", "id": "forged", "src": "cli"})
        self.assertEqual((line["by"], line["src"], line["batch"]), ("human", "pmview", "b1"))
        self.assertNotEqual(line["id"], "forged")
        self.assertEqual(len(line["text"]), design_mod.MAX_TEXT)

    def test_a_surface_name_that_is_not_a_slug_resolves_to_nothing(self) -> None:
        for name in ("../../etc", "a/b", "", "x" * 200, "has space"):
            with self.subTest(name=name):
                self.assertIsNone(design_mod.surface_dir(self.root, name))


class StoreResolutionTests(unittest.TestCase):
    """A fresh clone has the committed dump and no `.db` — the board must work
    from what git actually carries."""

    def test_the_committed_dump_is_a_store(self) -> None:
        self.assertEqual(store_path(COFFER).name, "memory-graph.dump")
        self.assertFalse((COFFER / "context" / "memory-graph.db").exists(),
                         "precondition: the .db is gitignored, so it is absent here")
        self.assertGreater(len(graph_mod.load(store_path(COFFER)).nodes), 100)

    def test_the_live_sqlite_store_wins_when_both_are_present(self) -> None:
        root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, root, True)
        (root / "context").mkdir()
        make_sqlite_store(root / "context" / "memory-graph.db").close()
        (root / "context" / "memory-graph.dump").write_text(
            "# agentic-memory-system dump\n# format_version: 1\n", encoding="utf-8")
        self.assertEqual(Project("t", root).store.name, "memory-graph.db")

    def test_a_file_that_vanishes_mid_scan_does_not_crash_the_fingerprint(self) -> None:
        """`rglob` yields a path, then the file goes away before `stat()`. The
        handler does not override `handle_error`, so an unguarded stat prints a
        traceback into the terminal the operator is watching."""
        root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, root, True)
        (root / "context" / "changes" / "c1").mkdir(parents=True)
        (root / "context" / "changes" / "c1" / "change.md").write_text("# c1", encoding="utf-8")
        view = server_mod.ProjectView(Project("t", root))
        self.assertIsNone(server_mod.ProjectView._file_stamp(root / "nope" / "gone.md"))
        self.assertTrue(view.board().board()["stages"] is not None)


class DiscoveryTests(unittest.TestCase):
    def test_parent_directory_expands_to_each_project(self) -> None:
        names = {p.name for p in discover([REPO / "dogfood"])}
        self.assertEqual(names, {"coffer", "interview-copilot", "kartka"})

    def test_project_directory_is_used_directly(self) -> None:
        projects = discover([COFFER])
        self.assertEqual([p.name for p in projects], ["coffer"])
        self.assertEqual(projects[0].store, store_path())


class ServerTests(unittest.TestCase):
    """End-to-end over the real socket, with no memory server running — the
    read-only mode a fresh checkout is in."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.server = build_server(
            [Project("coffer", COFFER)], "127.0.0.1", 0,
            memory_url="http://127.0.0.1:9",  # deliberately dead
        )
        cls.base = "http://127.0.0.1:%d" % cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def get(self, path: str):
        with urllib.request.urlopen(self.base + path, timeout=10) as response:
            return response.status, json.loads(response.read())

    def post(self, path: str, payload: dict):
        request = urllib.request.Request(
            self.base + path, data=json.dumps(payload).encode(), method="POST",
            headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as exc:
            return exc.code, json.loads(exc.read())

    def raw_post(self, path: str, body: bytes, **headers):
        request = urllib.request.Request(
            self.base + path, data=body, method="POST", headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as exc:
            return exc.code, json.loads(exc.read())

    # --- the write guard ----------------------------------------------------
    # pmview binds to loopback, but loopback is not a boundary a browser
    # respects. These three cover the shapes a page the operator merely visited
    # could actually send.

    def test_a_write_that_is_not_json_is_refused(self) -> None:
        """A cross-origin form or `sendBeacon` can only send a simple content
        type, and a simple request needs no preflight — so this is the one that
        would otherwise get through."""
        status, body = self.raw_post(
            "/api/nodes/x/tier", b'{"tier":"lifetime"}',
            **{"Content-Type": "text/plain;charset=UTF-8"})
        self.assertEqual(status, 415)
        self.assertEqual(body["code"], "unsupported_media_type")

    def test_a_write_from_a_foreign_origin_is_refused(self) -> None:
        status, body = self.raw_post(
            "/api/nodes/x/tier", b'{"tier":"lifetime"}',
            **{"Content-Type": "application/json", "Origin": "http://evil.example"})
        self.assertEqual(status, 403)
        self.assertEqual(body["code"], "forbidden_origin")

    def test_a_write_from_this_servers_own_origin_is_allowed_through(self) -> None:
        """Reaching `memory_unavailable` means the guard passed it: the request
        got as far as the proxy, which is dead in this fixture."""
        for origin in (self.base, "http://localhost:%d" % self.server.server_address[1]):
            with self.subTest(origin=origin):
                status, body = self.raw_post(
                    "/api/nodes/x/tier", b'{"tier":"lifetime"}',
                    **{"Content-Type": "application/json", "Origin": origin})
                self.assertEqual(status, 503)
                self.assertEqual(body["code"], "memory_unavailable")

    def test_a_write_with_no_origin_is_allowed_through(self) -> None:
        """No `Origin` means no browser — curl, a script, a test. The operator
        already has their own shell; refusing here buys nothing and breaks
        scripting."""
        status, body = self.post("/api/nodes/x/tier", {"tier": "lifetime"})
        self.assertEqual(status, 503)
        self.assertEqual(body["code"], "memory_unavailable")

    def test_projects_and_board(self) -> None:
        status, projects = self.get("/api/projects")
        self.assertEqual(status, 200)
        self.assertEqual(projects[0]["name"], "coffer")
        status, board = self.get("/api/board?project=coffer")
        self.assertEqual(status, 200)
        self.assertTrue(board["stages"])
        self.assertEqual(board["project"]["name"], "coffer")

    def test_issues_change_node_and_search_endpoints(self) -> None:
        self.assertTrue(self.get("/api/issues?project=coffer")[1])
        self.assertEqual(self.get("/api/changes/coffer-analytics?project=coffer")[1]["id"],
                         "coffer-analytics")
        self.assertTrue(self.get("/api/search?project=coffer&q=partition")[1])
        node = self.get("/api/nodes/66cd3d85-2920-4768-8953-4fd191446b5c?project=coffer")[1]
        self.assertEqual(node["node"]["path"], "/goal/coffer-analytics")

    def test_unknown_project_and_endpoints_are_404(self) -> None:
        for path in ("/api/board?project=ghost", "/api/nodes/ghost?project=coffer",
                     "/api/changes/ghost?project=coffer", "/api/nothing"):
            with self.subTest(path=path):
                try:
                    urllib.request.urlopen(self.base + path, timeout=10)
                    self.fail("expected 404")
                except urllib.error.HTTPError as exc:
                    self.assertEqual(exc.code, 404)

    def test_memory_status_reports_unavailable_rather_than_failing(self) -> None:
        status, payload = self.get("/api/memory/status")
        self.assertEqual(status, 200)
        self.assertFalse(payload["available"])
        self.assertIn("reason", payload)

    def test_writes_report_memory_unavailable_and_change_nothing(self) -> None:
        before = store_path().read_bytes()
        for path, payload in (
            ("/api/nodes/66cd3d85-2920-4768-8953-4fd191446b5c/body", {"body": "rewritten"}),
            ("/api/nodes/66cd3d85-2920-4768-8953-4fd191446b5c/tier", {"tier": "lifetime"}),
            ("/api/review/66cd3d85-2920-4768-8953-4fd191446b5c/resolve", {"action": "still_valid"}),
            ("/api/edges", {"source": "a", "target": "b", "type": "DEPENDS_ON"}),
        ):
            with self.subTest(path=path):
                status, body = self.post(path, payload)
                self.assertEqual(status, 503)
                self.assertEqual(body["code"], "memory_unavailable")
        self.assertEqual(store_path().read_bytes(), before,
                         "the board must never write to the store itself")

    def test_empty_body_is_rejected_before_it_reaches_the_memory_api(self) -> None:
        status, body = self.post("/api/nodes/whatever/body", {"body": "   "})
        self.assertEqual(status, 400)
        self.assertNotIn("code", body)

    def test_static_index_is_served_and_traversal_is_refused(self) -> None:
        with urllib.request.urlopen(self.base + "/", timeout=10) as response:
            self.assertIn(b"Graph&nbsp;Workflow", response.read())
        try:
            urllib.request.urlopen(self.base + "/../server.py", timeout=10)
            self.fail("expected the traversal to be refused")
        except urllib.error.HTTPError as exc:
            self.assertEqual(exc.code, 404)


if __name__ == "__main__":
    unittest.main()

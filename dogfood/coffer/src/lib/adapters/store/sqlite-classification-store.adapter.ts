/**
 * SqliteClassificationStoreAdapter — the default ClassificationStorePort
 * implementation ([dec:a49130e3]), backed by better-sqlite3.
 *
 * Opens a SECOND connection to the same configured db file as
 * `SqliteStoreAdapter` (both are constructed with the same `dbPath` by the
 * composition root in P6), so `assignments.tx_content_hash` genuinely
 * FK-references `transactions.content_hash` — a separate `:memory:` database
 * would NOT share rows with the primary connection. Both `PRAGMA
 * foreign_keys = ON` and `PRAGMA busy_timeout = 5000` are set on every
 * connection (R2 plan-review gate): better-sqlite3 leaves FK enforcement off
 * by default, and two connections against one file need a busy timeout to
 * avoid SQLITE_BUSY on near-simultaneous writes.
 *
 * `db` is intentionally a public, readonly field (not hidden behind the
 * port) — this is an adapter, not core/ports, so boundary-lint does not
 * guard it, and the sqlite-only FK-enforcement contract test (R2) needs
 * direct access to prove the pragma actually took effect.
 */
import DatabaseCtor from 'better-sqlite3';
import type Database from 'better-sqlite3';
import type { Group } from '../../core/model/group.js';
import { wouldCreateCycle } from '../../core/model/group.js';
import type { Predicate, Rule } from '../../core/model/rule.js';
import type { Assignment, AssignmentSource } from '../../core/model/assignment.js';
import type { ClassificationStorePort } from '../../ports/classification-store.port.js';
import { runMigrations } from './migration-runner.js';

interface GroupRow {
	readonly id: string;
	readonly name: string;
	readonly parent_id: string | null;
	readonly kind: 'group' | 'tag';
}

function rowToGroup(row: GroupRow): Group {
	return { id: row.id, name: row.name, parentId: row.parent_id, kind: row.kind };
}

interface RuleRow {
	readonly id: string;
	readonly name: string | null;
	readonly order: number;
	readonly predicate: string;
	readonly assign: string;
	readonly stop_after: number;
}

/**
 * `Predicate` may hold `bigint` amount values (`core/model/rule.ts`'s
 * `AmountComparePredicate`/`AmountBetweenPredicate`), and `JSON.stringify`
 * throws on `bigint` — the store-boundary conversion the P2 memory note
 * flagged ([node:8e2878b4]): walk the tree converting `bigint` <-> `string`
 * only at this adapter boundary, never in core.
 */
function predicateToJson(predicate: Predicate): unknown {
	switch (predicate.kind) {
		case 'field':
			if (predicate.field === 'amount') {
				return predicate.op === 'between'
					? { ...predicate, value: [predicate.value[0].toString(), predicate.value[1].toString()] }
					: { ...predicate, value: predicate.value.toString() };
			}
			return predicate;
		case 'all':
		case 'any':
			return { ...predicate, predicates: predicate.predicates.map(predicateToJson) };
	}
}

function predicateFromJson(json: any): Predicate {
	switch (json.kind) {
		case 'field':
			if (json.field === 'amount') {
				return json.op === 'between'
					? { ...json, value: [BigInt(json.value[0]), BigInt(json.value[1])] }
					: { ...json, value: BigInt(json.value) };
			}
			return json;
		case 'all':
		case 'any':
			return { ...json, predicates: json.predicates.map(predicateFromJson) };
		default:
			throw new Error(`predicateFromJson: unknown predicate kind ${json.kind}`);
	}
}

function rowToRule(row: RuleRow): Rule {
	return {
		id: row.id,
		name: row.name ?? undefined,
		order: row.order,
		predicate: predicateFromJson(JSON.parse(row.predicate)),
		assign: JSON.parse(row.assign),
		stopAfter: row.stop_after === 1 ? true : undefined
	};
}

interface AssignmentRow {
	readonly tx_content_hash: string;
	readonly group_id: string;
	readonly source: AssignmentSource;
	readonly rule_id: string | null;
}

function rowToAssignment(row: AssignmentRow): Assignment {
	return {
		txContentHash: row.tx_content_hash,
		groupId: row.group_id,
		source: row.source,
		ruleId: row.rule_id ?? undefined
	};
}

export class SqliteClassificationStoreAdapter implements ClassificationStorePort {
	readonly db: Database.Database;

	/** `dbPath` defaults to `:memory:`; the real container passes the SAME file path as SqliteStoreAdapter. */
	constructor(dbPath: string = ':memory:') {
		this.db = new DatabaseCtor(dbPath);
		this.db.pragma('foreign_keys = ON');
		this.db.pragma('busy_timeout = 5000');
	}

	async migrate(): Promise<void> {
		runMigrations(this.db);
	}

	async upsertGroup(group: Group): Promise<Group> {
		const existing = this.db
			.prepare('SELECT id, name, parent_id, kind FROM groups')
			.all() as GroupRow[];
		const others = existing.filter((g) => g.id !== group.id).map(rowToGroup);
		if (wouldCreateCycle(others, group.id, group.parentId)) {
			throw new Error(
				`upsertGroup: setting parentId of ${group.id} to ${group.parentId} would create a cycle`
			);
		}
		this.db
			.prepare(
				`INSERT INTO groups (id, name, parent_id, kind) VALUES (@id, @name, @parentId, @kind)
				 ON CONFLICT (id) DO UPDATE SET name = excluded.name, parent_id = excluded.parent_id, kind = excluded.kind`
			)
			.run(group);
		return group;
	}

	async getGroup(id: string): Promise<Group | undefined> {
		const row = this.db
			.prepare('SELECT id, name, parent_id, kind FROM groups WHERE id = ?')
			.get(id) as GroupRow | undefined;
		return row ? rowToGroup(row) : undefined;
	}

	async listGroups(): Promise<Group[]> {
		const rows = this.db.prepare('SELECT id, name, parent_id, kind FROM groups').all() as GroupRow[];
		return rows.map(rowToGroup);
	}

	async deleteGroup(id: string): Promise<void> {
		this.db.prepare('DELETE FROM groups WHERE id = ?').run(id);
	}

	async upsertRule(rule: Rule): Promise<Rule> {
		this.db
			.prepare(
				`INSERT INTO rules (id, name, "order", predicate, assign, stop_after)
				 VALUES (@id, @name, @order, @predicate, @assign, @stopAfter)
				 ON CONFLICT (id) DO UPDATE SET
					name = excluded.name, "order" = excluded."order",
					predicate = excluded.predicate, assign = excluded.assign,
					stop_after = excluded.stop_after`
			)
			.run({
				id: rule.id,
				name: rule.name ?? null,
				order: rule.order,
				predicate: JSON.stringify(predicateToJson(rule.predicate)),
				assign: JSON.stringify(rule.assign),
				stopAfter: rule.stopAfter ? 1 : 0
			});
		return rule;
	}

	async listRules(): Promise<Rule[]> {
		const rows = this.db
			.prepare('SELECT id, name, "order", predicate, assign, stop_after FROM rules ORDER BY "order" ASC')
			.all() as RuleRow[];
		return rows.map(rowToRule);
	}

	async saveAssignments(assignments: readonly Assignment[]): Promise<void> {
		const insert = this.db.prepare(
			`INSERT OR IGNORE INTO assignments (tx_content_hash, group_id, source, rule_id, created_at)
			 VALUES (@txContentHash, @groupId, @source, @ruleId, @createdAt)`
		);
		const runAll = this.db.transaction((rows: readonly Assignment[]) => {
			for (const a of rows) {
				insert.run({
					txContentHash: a.txContentHash,
					groupId: a.groupId,
					source: a.source,
					ruleId: a.ruleId ?? null,
					createdAt: new Date().toISOString()
				});
			}
		});
		runAll(assignments);
	}

	async assignmentsFor(contentHash: string): Promise<Assignment[]> {
		const rows = this.db
			.prepare('SELECT tx_content_hash, group_id, source, rule_id FROM assignments WHERE tx_content_hash = ?')
			.all(contentHash) as AssignmentRow[];
		return rows.map(rowToAssignment);
	}

	async allAssignments(): Promise<Assignment[]> {
		const rows = this.db
			.prepare('SELECT tx_content_hash, group_id, source, rule_id FROM assignments')
			.all() as AssignmentRow[];
		return rows.map(rowToAssignment);
	}

	async unmatched(contentHashes: readonly string[]): Promise<string[]> {
		if (contentHashes.length === 0) {
			return [];
		}
		const placeholders = contentHashes.map(() => '?').join(', ');
		const rows = this.db
			.prepare(`SELECT DISTINCT tx_content_hash FROM assignments WHERE tx_content_hash IN (${placeholders})`)
			.all(...contentHashes) as { tx_content_hash: string }[];
		const assigned = new Set(rows.map((r) => r.tx_content_hash));
		return contentHashes.filter((hash) => !assigned.has(hash));
	}

	async close(): Promise<void> {
		this.db.close();
	}
}

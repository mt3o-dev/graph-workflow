/**
 * English catalog — the SHAPE OF TRUTH for the typed message catalog
 * ([node:a0330a47]). `keys.ts` derives `MessageKey` from this object's keys;
 * `pl.ts` must supply a value of the exact same type (string-for-string,
 * function-for-function-with-matching-params) for every key, or the
 * typecheck fails.
 *
 * Keys stay flat, dot-namespaced, and semantically neutral (`nav.dashboard`,
 * not `nav.theTreasury`) — the FANTASY REGISTER lives only in the values
 * ([node:2e5f97e2]): chrome reads Forgotten-Realms flavorful in both
 * languages, but the key a component reaches for names the *thing*, not the
 * flavor text, so re-theming later never touches call sites.
 *
 * No `as const` here: entries stay widened to `string` / a function type so
 * `pl.ts`'s translated strings (different text, same shape) satisfy the
 * derived `Catalog` type. `satisfies` (not `: Record<...>`) keeps the
 * literal key set intact for `keyof typeof en` while still checking every
 * value against `MessageValue`.
 */
import type { MessageValue } from './types.js';

export const en = {
	// --- Brand (kept as-is across locales; allowlisted in the no-hardcoded-
	// string guard as the one literal permitted straight in markup). ---
	'brand.name': 'Coffer',

	// --- Nav / chrome shell ---
	'nav.dashboard': 'The Treasury',
	'nav.import': 'Tally the Takings',
	'nav.review': 'The Scriptorium',
	'nav.settings': "The Steward's Study",
	'nav.logout': 'Take Your Leave',
	'chrome.themeToggleLabel': 'Trade candlelight for daylight',
	'chrome.localeSelectLabel': 'Tongue Spoken',
	'chrome.skipToContent': 'Skip to the ledger',

	// --- Common actions (shared across all four screens) ---
	'common.save': 'Seal It',
	'common.cancel': 'Stand Down',
	'common.delete': 'Cast to the Vault Fire',
	'common.edit': 'Amend the Ledger',
	'common.confirm': 'So Be It',
	'common.submit': 'Submit for the Steward',
	'common.back': 'Retrace Your Steps',
	'common.add': 'Add to the Hoard',
	'common.remove': 'Strike from the Rolls',
	'common.search': 'Search the Archives',
	'common.loading': 'The Scribes Are Working…',
	'common.error': 'A Curse Has Struck',
	'common.retry': 'Try the Rite Again',
	'common.close': 'Shut the Ledger',

	// --- Auth: login / logout ---
	'auth.loginTitle': 'Speak the Passphrase',
	'auth.loginSubtitle': 'Only the Steward of this Treasury may enter',
	'auth.passphraseLabel': 'Passphrase',
	'auth.loginButton': 'Cross the Threshold',
	'auth.loginError': 'The wards reject that phrase — try again',
	'auth.logoutButton': 'Take Your Leave',
	'auth.sessionExpired': 'Your watch has ended — speak the passphrase anew',

	// --- Dashboard ("The Treasury") ---
	'dashboard.title': 'The Treasury',
	'dashboard.subtitle': 'A reckoning of coin, in and out',
	'dashboard.incomeLabel': 'Coin Received',
	'dashboard.outcomeLabel': 'Coin Spent',
	'dashboard.netLabel': 'Net Hoard',
	'dashboard.byGroupHeading': 'By Coffer',
	'dashboard.unclassifiedSeriesLabel': 'Unsorted Coin',
	'dashboard.modeLabel': (params: { mode: string }) => `Reckoning by ${params.mode}`,
	'dashboard.welcomeBack': (params: { name: string }) => `Well met again, ${params.name}`,
	'dashboard.emptyState': 'No coin has yet crossed the threshold',
	'dashboard.cashflowHeading': 'The Flow of Coin',
	'dashboard.granularityLabel': 'Reckon By',
	'dashboard.granularity.day': 'Day',
	'dashboard.granularity.week': 'Week',
	'dashboard.granularity.month': 'Month',
	'dashboard.attributionModeLabel': 'Attribution',
	'dashboard.variantLabel': 'Coffer Reckoning',
	'dashboard.variant.self': 'Named Coffer Only',
	'dashboard.variant.rollup': 'Coffer and Its Wards',
	'dashboard.attributionMode.overlap': 'Overlap',
	'dashboard.attributionMode.partition': 'Partition',
	'dashboard.currencyHeading': (params: { currency: string }) => `In ${params.currency}`,
	'dashboard.grandTotalLabel': 'Grand Reckoning',

	// --- Import ("Tally the Takings") ---
	'import.title': 'Tally the Takings',
	'import.subtitle': 'Bring in a statement and let the scribes tally it',
	'import.dropHint': 'Drop a statement here, or choose one below',
	'import.selectFile': 'Choose a Statement',
	'import.uploadButton': 'Begin the Tally',
	'import.parsing': 'The scribes are reading the parchment…',
	'import.successCount': (params: { count: number }) => `${params.count} entries tallied into the ledger`,
	'import.duplicateCount': (params: { count: number }) => `${params.count} entries already known, set aside`,
	'import.errorCount': (params: { count: number }) => `${params.count} entries the scribes could not read`,
	'import.accountLabel': 'Account of Origin',
	'import.currencyLabel': 'Coin of the Realm',
	'import.fileLabel': 'Statement Parchment',
	'import.enabledParsersHeading': 'Scripts the Scribes Can Read',
	'import.resultHeading': 'The Tally',
	'import.batchLabel': (params: { id: string }) => `Batch ${params.id}`,
	'import.genericError': 'The scribes could not make sense of that parchment',

	// --- Review ("The Scriptorium") ---
	'review.title': 'The Scriptorium',
	'review.subtitle': 'Entries awaiting judgment',
	'review.unclassifiedLabel': 'Awaiting Judgment',
	'review.assignButton': 'Bind to Coffer',
	'review.suggestLabel': 'The Scribes Suggest',
	'review.confidenceLabel': (params: { percent: number }) => `${params.percent}% certain`,
	'review.emptyState': 'The Scriptorium stands empty — all is judged',
	'review.dateHeading': 'Date',
	'review.descriptionHeading': 'Description',
	'review.counterpartyHeading': 'Counterparty',
	'review.amountHeading': 'Amount',
	'review.groupsSelectLabel': 'Bind to Coffers',
	'review.promoteButton': 'Enshrine as Standing Order',
	'review.noSuggestions': 'The Scribes have no counsel to offer',
	'review.suggestButton': 'Ask the Scribes',
	'review.tableCaption': 'Entries awaiting judgment',

	// --- Settings ("The Steward's Study") ---
	'settings.title': "The Steward's Study",
	'settings.subtitle': 'Set the rules that govern this treasury',
	'settings.themeLabel': 'Study by',
	'settings.localeLabel': 'Tongue Spoken',
	'settings.groupsHeading': 'Coffers',
	'settings.rulesHeading': 'Standing Orders',
	'settings.addGroupButton': 'Found a New Coffer',
	'settings.addRuleButton': 'Issue a Standing Order',
	'settings.groupsEmptyState': 'No coffers have yet been founded',
	'settings.rulesEmptyState': 'No standing orders have yet been issued',
	'settings.kind.group': 'Coffer',
	'settings.kind.tag': 'Mark',
	'settings.ruleOrderLabel': (params: { order: number }) => `Order ${params.order}`,
	'settings.ruleAssignLabel': 'Binds To'
} satisfies Record<string, MessageValue>;

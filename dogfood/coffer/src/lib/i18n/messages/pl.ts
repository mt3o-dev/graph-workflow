/**
 * Polish catalog. Must satisfy `Catalog` ([keys.ts]) — every key `en.ts`
 * declares, with a value of the exact same shape (plain string, or a
 * function taking the exact same param type). Delete or rename a key here
 * without a matching change and `pnpm typecheck` fails; that's the point
 * ([node:a0330a47]).
 *
 * Same fantasy register as `en.ts` ([node:2e5f97e2]), flavor carried
 * natively in Polish rather than translated word-for-word — the register
 * must read equally flavorful in both tongues, not literally identical.
 */
import type { Catalog } from '../keys.js';

export const pl: Catalog = {
	'brand.name': 'Coffer',

	// --- Nav / chrome shell ---
	'nav.dashboard': 'Skarbiec',
	'nav.import': 'Zliczanie Łupów',
	'nav.review': 'Skryptorium',
	'nav.settings': 'Gabinet Zarządcy',
	'nav.logout': 'Opuść Zamek',
	'chrome.themeToggleLabel': 'Zamień blask świec na światło dnia',
	'chrome.localeSelectLabel': 'Mowa Używana',
	'chrome.skipToContent': 'Przejdź do rejestru',

	// --- Common actions ---
	'common.save': 'Zapieczętuj',
	'common.cancel': 'Wstrzymaj Się',
	'common.delete': 'Rzuć w Ogień Skarbca',
	'common.edit': 'Popraw Zapis',
	'common.confirm': 'Niech Tak Będzie',
	'common.submit': 'Przedłóż Zarządcy',
	'common.back': 'Zawróć',
	'common.add': 'Dodaj do Skarbca',
	'common.remove': 'Wykreśl z Rejestru',
	'common.search': 'Przeszukaj Archiwa',
	'common.loading': 'Skrybowie Pracują…',
	'common.error': 'Spadła na Nas Klątwa',
	'common.retry': 'Powtórz Rytuał',
	'common.close': 'Zamknij Rejestr',

	// --- Auth ---
	'auth.loginTitle': 'Wypowiedz Hasło',
	'auth.loginSubtitle': 'Tylko Zarządca tego Skarbca może wejść',
	'auth.passphraseLabel': 'Hasło',
	'auth.loginButton': 'Przekrocz Próg',
	'auth.loginError': 'Wrota odrzucają to hasło — spróbuj ponownie',
	'auth.logoutButton': 'Opuść Zamek',
	'auth.sessionExpired': 'Twoja warta dobiegła końca — wypowiedz hasło na nowo',

	// --- Dashboard ("Skarbiec") ---
	'dashboard.title': 'Skarbiec',
	'dashboard.subtitle': 'Rozliczenie monet — wpływy i wydatki',
	'dashboard.incomeLabel': 'Moneta Wpłynięta',
	'dashboard.outcomeLabel': 'Moneta Wydana',
	'dashboard.netLabel': 'Stan Skarbca',
	'dashboard.byGroupHeading': 'Wedle Skrzyni',
	'dashboard.unclassifiedSeriesLabel': 'Moneta Niesklasyfikowana',
	'dashboard.modeLabel': (params: { mode: string }) => `Rozliczenie wedle: ${params.mode}`,
	'dashboard.welcomeBack': (params: { name: string }) => `Witaj ponownie, ${params.name}`,
	'dashboard.emptyState': 'Żadna moneta nie przekroczyła jeszcze progu',
	'dashboard.cashflowHeading': 'Bieg Monety',
	'dashboard.granularityLabel': 'Licz Wedle',
	'dashboard.granularity.day': 'Dnia',
	'dashboard.granularity.week': 'Tygodnia',
	'dashboard.granularity.month': 'Miesiąca',
	'dashboard.attributionModeLabel': 'Sposób Przypisania',
	'dashboard.variantLabel': 'Sposób Liczenia Skrzyń',
	'dashboard.variant.self': 'Tylko Wskazana Skrzynia',
	'dashboard.variant.rollup': 'Skrzynia i Jej Poddane',
	'dashboard.attributionMode.overlap': 'Nakładanie',
	'dashboard.attributionMode.partition': 'Podział',
	'dashboard.currencyHeading': (params: { currency: string }) => `W walucie ${params.currency}`,
	'dashboard.grandTotalLabel': 'Wielkie Rozliczenie',

	// --- Import ("Zliczanie Łupów") ---
	'import.title': 'Zliczanie Łupów',
	'import.subtitle': 'Przynieś wyciąg, niech skrybowie go zliczą',
	'import.dropHint': 'Upuść tu wyciąg lub wybierz go poniżej',
	'import.selectFile': 'Wybierz Wyciąg',
	'import.uploadButton': 'Rozpocznij Zliczanie',
	'import.parsing': 'Skrybowie odczytują pergamin…',
	'import.successCount': (params: { count: number }) => `${params.count} wpisów wciągnięto do rejestru`,
	'import.duplicateCount': (params: { count: number }) => `${params.count} wpisów już znanych, odłożonych na bok`,
	'import.errorCount': (params: { count: number }) => `${params.count} wpisów, których skrybowie nie zdołali odczytać`,
	'import.accountLabel': 'Rachunek Pochodzenia',
	'import.currencyLabel': 'Moneta Krainy',
	'import.fileLabel': 'Pergamin Wyciągu',
	'import.enabledParsersHeading': 'Pisma, Które Skrybowie Znają',
	'import.resultHeading': 'Wynik Zliczenia',
	'import.batchLabel': (params: { id: string }) => `Partia ${params.id}`,
	'import.genericError': 'Skrybowie nie zrozumieli tego pergaminu',

	// --- Review ("Skryptorium") ---
	'review.title': 'Skryptorium',
	'review.subtitle': 'Wpisy czekające na osąd',
	'review.unclassifiedLabel': 'Czeka na Osąd',
	'review.assignButton': 'Przypisz do Skrzyni',
	'review.suggestLabel': 'Skrybowie Sugerują',
	'review.confidenceLabel': (params: { percent: number }) => `pewność: ${params.percent}%`,
	'review.emptyState': 'Skryptorium stoi puste — wszystko osądzone',
	'review.dateHeading': 'Data',
	'review.descriptionHeading': 'Opis',
	'review.counterpartyHeading': 'Kontrahent',
	'review.amountHeading': 'Kwota',
	'review.groupsSelectLabel': 'Przypisz do Skrzyń',
	'review.promoteButton': 'Ustanów Stały Rozkaz',
	'review.noSuggestions': 'Skrybowie nie mają rady do udzielenia',
	'review.suggestButton': 'Zapytaj Skrybów',
	'review.tableCaption': 'Wpisy czekające na osąd',

	// --- Settings ("Gabinet Zarządcy") ---
	'settings.title': 'Gabinet Zarządcy',
	'settings.subtitle': 'Ustanów zasady rządzące tym skarbcem',
	'settings.themeLabel': 'Oświetlenie Gabinetu',
	'settings.localeLabel': 'Mowa Używana',
	'settings.groupsHeading': 'Skrzynie',
	'settings.rulesHeading': 'Stałe Rozkazy',
	'settings.addGroupButton': 'Załóż Nową Skrzynię',
	'settings.addRuleButton': 'Wydaj Stały Rozkaz',
	'settings.groupsEmptyState': 'Nie założono jeszcze żadnej skrzyni',
	'settings.rulesEmptyState': 'Nie wydano jeszcze żadnego stałego rozkazu',
	'settings.kind.group': 'Skrzynia',
	'settings.kind.tag': 'Znak',
	'settings.ruleOrderLabel': (params: { order: number }) => `Kolejność ${params.order}`,
	'settings.ruleAssignLabel': 'Przypisuje Do'
};

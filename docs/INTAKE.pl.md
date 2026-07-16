# graph-workflow — Checklista intake przed startem projektu

*(English version: [INTAKE.en.md](INTAKE.en.md))*

Dwanaście obszarów do przemyślenia **zanim** uruchomisz `/gw-init` na projekcie.
Każdy obszar zadaje 4–6 pytań, a każde pytanie ma przykład — albo użyteczną
odpowiedź, albo to, co pójdzie nie tak bez niej. Pytania, których nie dało się
pewnie osadzić w faktycznej mechanice workflow, zostały usunięte zamiast dopchane.

Jak z tego korzystać: przejdź obszary po kolei z ludźmi, którzy będą pełnić role
ludzkie (recenzent, osoba promująca, właściciel dokumentów). Zapisz odpowiedzi —
najlepszym miejscem jest `CLAUDE.md` projektu (polityka capture, reguły facetów,
routing trybów) oraz `context/foundation/` (wszystko, co normatywne, co
`/gw-foundation` następnie zdestyluje). Pomijaj pytania, które ewidentnie nie
dotyczą twojej konfiguracji (deweloperzy solo mogą prześlizgnąć się po obszarach
5 i 8), ale pomijaj je świadomie.

---

## 1. Gotowość fundamentów

`/gw-foundation` może zdestylować tylko to, co istnieje na papierze. Graf
startuje pusty, a pierwsze zmiany działają na tym, co przebieg fundamentowy
umieścił w root secie lifetime — więc stan twojego PRD, ADR-ów i dokumentów
tech-stack w momencie adopcji bezpośrednio ustala podłogę jakości każdego
wczesnego recallu.

1. Czy dokumenty fundamentowe w ogóle istnieją — PRD, decision record tech-stacku, ADR-y — i czy są na tyle aktualne, żeby je destylować, czy raczej `/gw-foundation` scapture'owałby stwierdzenia, o których już wiesz, że są nieaktualne?
   *Destylacja PRD, w którym wciąż stoi „faktury są mutowalnymi szkicami", sadzi lifetime'owy `constraint`, któremu pierwsza prawdziwa zmiana natychmiast rzuca CONTRADICTS — zaczynasz projekt od zaległości w kolejce review zamiast od fundamentu.*

2. Które stwierdzenia w tych dokumentach są faktycznie **normatywne** — ograniczenia, które przyszła praca musi respektować, ustalone pojęcia domenowe, decyzje z uzasadnieniem — a które są narracją, aspiracją albo roadmapowym szumem?
   *„Płatności nie mogą wyjść przed KYC" to constraint wart węzła; „mamy nadzieję wejść na rynek UE w 2027" to aspiracja, która w bundlu recallu nie ma żadnej wartości egzekucyjnej.*

3. Kto jest człowiekiem, który wypromuje węzły fundamentowe do tieru lifetime w GUI, i czy zgodził się zrobić to w momencie adopcji — a nie „później"?
   *Niewypromowane węzły fundamentowe to krótkoterminowa pamięć robocza: w chwili gdy zakres `foundation` zostanie zdeaktywowany i sweepnięty, zasypiają i każdy przyszły recall nie serwuje nic. Cały krok wisi na jednej osobie potwierdzającej listę promocji.*

4. Czy znane, zaakceptowane luki są gdziekolwiek spisane, tak by dało się je scapture'ować jako węzły `issue`, zamiast być odkrywane na nowo przez każdą zmianę?
   *„Brak wielowalutowości w v1; kwoty zakładają PLN" scapture'owane raz jako issue oszczędza N agentom niezależnego dochodzenia, czemu schemat nie ma kolumny waluty.*

5. Gdy dokument fundamentowy zostaje później zmieniony, kto uruchamia przepływ poprawki (recall → `impact_of` → capture z CONTRADICTS → ludzka re-promocja) i czy to ta sama osoba, która edytuje dokument?
   *Jeśli właściciel dokumentu edytuje PRD, ale nigdy nie dotyka grafu, dokument i graf rozjeżdżają się po cichu — a graf dalej serwuje stary constraint z autorytetem lifetime.*

## 2. Język domenowy i słownik facetów

Facety to słownik kontrolowany, nie wolna chmura tagów. Każdy
`capture_artifact` niesie etykiety facetów, bliskie synonimy wracają jako
`facet_warnings`, a dryf facetów rozszczepia graf — dwa pół-słowniki, które
nigdy nie rankują w swoje recalle nawzajem. Słownik zasługuje na świadomy
pierwszy szkic przed pierwszym capture, a nie na organiczne narastanie.

1. Jaki jest początkowy zestaw facetów — czy potrafisz dziś wypisać 10–20 etykiet, których użyje pierwszy miesiąc capture'ów?
   *Zestaw startowy dla produktu fakturowego: `invoicing`, `payments`, `tax`, `reporting`, `auth`, `data-layer`. Start od zera uzgodnionych facetów oznacza, że pierwszych trzech agentów wymyśli każdy swoje, a detektor kolizji spędzi życie na pytaniu „czy chodziło o…?".*

2. Czy twoje facety rozdzielają oś **podsystemu** (gdzie w kodzie) od osi **domeny** (jakie pojęcie biznesowe) i czy wiesz, do której osi należy dana etykieta?
   *`data-layer` to podsystem; `vat` to pojęcie domenowe. Węzeł o zaokrąglaniu VAT w kodzie persystencji zasadnie niesie oba — zlanie osi w jedną mętną listę sprawia, że zapytania recall omijają połowę istotnych węzłów.*

3. Kto jest właścicielem rozszerzeń słownika — gdy agent trafia na naprawdę nowe pojęcie, czy jest wskazany człowiek, który zatwierdza nowy facet, czy agent decyduje sam?
   *Bez właściciela `billing`, `invoicing` i `invoices` wejdą do słownika w ciągu tygodnia, a ostrzeżenia o bliskich synonimach staną się szumem, który wszyscy na nowo ignorują.*

4. Jaka jest stała instrukcja obsługi `facet_warnings` — kiedy agent powinien przyjąć sugerowaną istniejącą etykietę, a kiedy utrzymanie odrębnej nowej jest uzasadnione?
   *Użyteczna reguła: przyjmij sugestię, chyba że te dwa pojęcia kiedykolwiek będą musiały być recallowane osobno. `tax` vs `vat` mogą naprawdę się różnić (akcyza, podatek u źródła); `invoice` vs `invoicing` — nigdy.*

5. Czy kluczowe terminy domenowe projektu są zdefiniowane na tyle spójnie, by stać się węzłami `concept` — czy może członkowie zespołu obecnie rozumieją to samo słowo różnie?
   *Jeśli „konto" oznacza konto księgowe dla finansów, a login użytkownika dla inżynierii, scapture'uj teraz dwa odrębne koncepty z odrębnymi facetami — inaczej pierwszy recall, który je pomiesza, wprowadzi w błąd z pełną pewnością siebie.*

## 3. Granulacja i nazewnictwo zmian

Zmiana jest w tym workflow jednostką wszystkiego: jeden worktree, jeden świeży
kontekst agenta, jeden liveness root, jeden węzeł goal, jedna wartość facetu.
Pomyl granulację, a albo sweep zarchiwizuje na wpół skończone myślenie (za duża,
porzucona w połowie), albo graf zapełni się węzłami goal, z których każdy
kotwiczy dwa artefakty (za mała).

1. Czym jest „jedna zmiana" dla tego projektu — czy potrafisz podać heurystykę rozmiaru w kategoriach faz i wysiłku review?
   *Działająca reguła: zmiana to tyle, ile jeden agent zaimplementuje względem jednego plan.md, a jeden człowiek zrecenzuje na jednym posiedzeniu. „Przebudować moduł raportowy" to pozycja roadmapy, nie change-id.*

2. Jaka jest konwencja nazewnicza change-id — nazwane od rezultatu, kebab-case, unikalne na zawsze?
   *`invoice-vat-rounding` nazywa rezultat; `fix-bug` i `johns-task-3` nie nazywają niczego, a skoro id staje się trwałym facetem na każdym węźle scapture'owanym przez zmianę, zła nazwa zanieczyszcza graf długo po zarchiwizowaniu folderu.*

3. Gdy zmiana puchnie w trakcie, jaki jest wyzwalacz podziału — i czy zespół wie, że głęboki wynik `impact_of` na etapie planu to sygnał do podziału, a nie do parcia dalej?
   *Plan, który musi zastąpić węzeł z zależnymi na głębokości 3 w dwóch podsystemach, to dwie zmiany noszące jedno id: podziel i daj drugiej zmianie `parent_refs` do scapture'owanych decyzji pierwszej.*

4. Kiedy użyjesz `parent_refs` — czy zmiany kontynuacyjne i siostrzane linkują do ocalałych węzłów zmian, na których budują?
   *Zmiana kontynuacyjna otwarta po zarchiwizowaniu `invoice-vat-rounding` powinna przekazać `parent_refs: [node_0801]` (jego kluczowa decyzja), tak by recall nowego celu przyciągnął stożek poprzedniego epizodu, zamiast odkrywać go na nowo szczęściem do słów kluczowych.*

5. Czy praca kontynuacyjna jest zawsze **nową** zmianą — czy zespół ma jasność, że zarchiwizowanej zmiany nigdy nie otwiera się ponownie w miejscu?
   *`context/archive/` jest niemutowalne, a jego zakres jest uśpiony z założenia; „niech tylko otworzę stary folder" to ten jeden ruch, na którym workflow przerywa. Nowa praca, nowe id, parent_refs wstecz.*

## 4. Polityka capture

Jakość capture jest sufitem całego systemu: retrieval jest deterministyczny,
więc recall serwuje dokładnie to, co capture zapisał — nic lepszego. Projekt
potrzebuje własnej, konkretnej odpowiedzi na pytanie „co jest tu trwałym
osadem?", spisanej we własnym języku domenowym, zanim agenci zaczną pisać węzły.

1. Czy potrafisz podać projektowe przykłady każdego typu artefaktu — po jednym prawdziwym `decision`, `constraint`, `invariant`, `issue` i `concept` z twojej domeny, sformułowanym tak, by dało się je czytać „na zimno"?
   *Dla produktu logistycznego: decision — „Optymalizacja tras biegnie nocą, nie na żądanie: API przewoźników limitują do 100 req/h." Constraint — „Etykiety przesyłek są niemutowalne po przekazaniu przewoźnikowi." Invariant — „Każda paczka ma dokładnie jedną aktywną trasę." Jeśli zespół nie umie ich wytworzyć teraz, agenci będą później zgadywać rejestr.*

2. Gdzie dla tego projektu przebiega granica między trwałym osadem a narracją — czego jawnie NIE będziesz capture'ować?
   *„Zrefaktorowałem serwis paczek i przeniosłem trzy pliki" to historia gita, nie wiedza. „Serwis paczek nie może importować z billingu (reguła warstw odkryta w review)" to constraint wart węzła. Wpisz oba przykłady do CLAUDE.md projektu, żeby kontrast był stałą instrukcją.*

3. Jaka jest domyślna polityka tierów — kiedy agent może ustawić `mid-term` zamiast `short-term` w momencie capture?
   *Użyteczna reguła: short-term, chyba że artefakt już wiadomo, że przeżyje zmianę (odkryta reguła warstw, dziwactwo API przewoźnika, na które trafi każda przyszła integracja). Long-term i lifetime nigdy nie są ustawiane przy capture — to wyniki ludzkiej promocji.*

4. Czy agenci znają regułę jedno-stwierdzenie-na-węzeł i czy istnieje stała kontrola rozmiaru?
   *Trzy małe węzły — decyzja o zaokrąglaniu, ryzyko ścieżki raportów, constraint migracji — rankują w recallu niezależnie. Jeden 400-słowny blob „podsumowanie fazy 2" albo rankuje zawsze, albo nigdy, i nie da się go z żadną precyzją powiązać krawędziami.*

5. Czy krawędzie są częścią standardu capture — czy artefakt bez powiązywalnego celu jest traktowany jako sygnał do ponownego rozważenia capture?
   *Węzeł+krawędzie commitują się atomowo; decyzja, która od niczego nie DEPENDS_ON i niczemu nie zaprzecza, jest albo fundamentowa (rzadkie po przebiegu /gw-foundation), albo zbyt mglista, by serwować. „Z czym to się wiąże?" dostaje odpowiedź w momencie capture, nie retrospektywnie.*

6. Kto recenzuje jakość capture w pierwszych tygodniach — czy sesje `/gw-review` będą jawnie sprawdzać scapture'owane węzły zmiany względem tej polityki, póki formują się nawyki?
   *Pierwsze dziesięć zmian ustawia rejestr dla każdego capture po nich; recenzent, który wcześnie flaguje węzły-narracje i węzły-bloby, jest tańszy niż późniejsze sprzątanie grafu.*

## 5. Role ludzkie i przepustowość review

Workflow ma działania wyłącznie ludzkie wbudowane w swój model bezpieczeństwa:
rozstrzyganie flag, promocja tierów i bramka review nie mogą być wykonane przez
agentów — jedynie wystawione człowiekowi. Jeśli nikt nie jest właścicielem tych
działań, spory się kumulują, nic nie jest promowane, a graf powoli degraduje się
do nierankowanego short-termowego szumu. Zdecyduj, kim są ludzie, zanim otworzy
się pierwsza zmiana.

1. Kto przerabia kolejkę review (`uv run agentic-memory-gui` → zakładka Review) i z jaką kadencją?
   *Przykład: „Autor zmiany triażuje własne sporne węzły przy PR; tech lead przechodzi całą kolejkę w każdy piątek." Bez właściciela para `disputed` z pierwszego tygodnia wciąż jest nierozstrzygnięta w trzecim miesiącu, a każdy recall, który jej dotyka, zmusza agentów do rozumowania z obiema stronami.*

2. Kto ma uprawnienia do promocji — zwłaszcza do tieru lifetime, który wymaga jawnego potwierdzenia w GUI?
   *Przykład: „Każdy może promować do long-term; promocje lifetime (wiedza na poziomie fundamentów) wymagają potwierdzenia architekta." Węzły lifetime siedzą w zawsze-żywym root secie i rankują w każdy istotny recall na zawsze — nieostrożna promocja lifetime to najdroższy błąd, jaki człowiek może tu popełnić.*

3. Jaka jest twoja przepustowość review w zmianach na tydzień i czy faktycznie ograniczysz otwarte zmiany do tej liczby?
   *Przykład: „Dwie osoby są w stanie zrecenzować ~5 zmian/tydzień, więc nigdy nie mamy otwartych więcej niż 5 zmian." Przepustowość review to zaprojektowany limit throughputu: więcej agentów bez review oznacza więcej niezrecenzowanego kodu i nieprzerobioną kolejkę pamięci, nie więcej dowożenia.*

4. Co się dzieje, gdy kolejka się zapycha — przestajecie otwierać zmiany, czy zaległość po cichu rośnie?
   *Przykład: „Jeśli kolejka review przekroczy 10 spornych węzłów albo 3 niezrecenzowane PR-y, /gw-new jest wstrzymany, aż zostanie przerobiona." Workflow mówi: przestań otwierać nowe zmiany; ustalcie z góry, kto to ogłasza, bo inaczej nie zrobi tego nikt.*

5. Kto rozstrzyga o kandydatach do konsolidacji przy każdym PR — węźle podsumowania zmiany i artefaktach CONFIRMED, które wypisuje /gw-review?
   *Przykład: „Recenzent PR-a albo promuje podsumowanie zmiany, albo jawnie je odrzuca na tym samym posiedzeniu." Niewypromowane podsumowanie zasypia przy sweepie, co niweczy jego cel — przyszłe recalle w tym rejonie nie dostają z epizodu nic.*

## 6. Miks trybów wykonania

Każda zmiana trafia do dokładnie jednego trybu wykonania: interaktywnego
`/gw-implement` (bramki ręczne, osąd w trakcie) albo headless `/gw-goal`
(deterministyczna weryfikacja, ludzie dopiero przy PR). Decyzja o routingu jest
realna tylko wtedy, gdy warunki wstępne headless da się faktycznie spełnić — co
zwykle oznacza pracę nad infrastrukturą testową przed pierwszym przebiegiem
`/gw-goal`.

1. Jaki odsetek twoich typowych zmian jest ograniczony i weryfikowalny komendą — twardy warunek wstępny trybu headless?
   *Przykład: „Podbicia zależności, refaktory w stylu codemod i endpointy CRUD względem naszej suity testów API: headless. Wszystko, co dotyka silnika cenowego: interaktywnie." Jeśli szczera odpowiedź brzmi „prawie nic nie jest weryfikowalne komendą", planuj wyłącznie tryb interaktywny, dopóki to się nie zmieni.*

2. Czy komendy weryfikacji per faza istnieją dziś, czy trzeba je najpierw zbudować?
   *Przykład: „`pytest tests/invoicing -k phase_marker` istnieje; nie ma odpowiednika dla frontendu, więc zmiany frontendowe zostają interaktywne, dopóki nie wyląduje pokrycie Playwrightem." /gw-goal odmawia startu bez komendy weryfikacji per faza — plan.md z „ręcznie sprawdź UI" jako weryfikacją to plan interaktywny.*

3. Jakie warunki stopu dostają przebiegi headless poza porażką testów — i czy wszyscy wiedzą, że węzeł `disputed` istotnie wpływający na fazę zawsze nim jest?
   *Przykład: „Stop przy: porażce weryfikacji po retry'ach, dowolnym spornym bloku recallu dotykającym fazy, dowolnym zapisie rozwiązującym się pod context/archive/." Agent bez nadzoru nie może obstawiać żadnej strony sprzeczności; ten spór czeka na bramkę PR.*

4. Jaki budżet retry dostają fazy headless, zanim scapture'ują `issue` i przejdą w `status: blocked`?
   *Przykład: „Domyślnie 3 próby na fazę; migracje dostają 1 — nieudana migracja ponawiana na ślepo jest gorsza niż zablokowana zmiana." Uczciwy wynik częściowy bije miotającą się pętlę; wybierz liczbę świadomie, zamiast dziedziczyć wszędzie domyślną.*

5. Kto czyta raporty przebiegów headless przed /gw-review i jak szybko?
   *Przykład: „Właściciel zmiany czyta raport przebiegu (ukończone fazy, capture'y, sprzeczności, zużyte retry) tego samego dnia; zablokowane przebiegi są triażowane w ciągu 24h." Zablokowana zmiana headless trzyma worktree, aktywny liveness root i być może oflagowany węzeł — nie powinna leżeć nieprzeczytana przez tydzień.*

## 7. Równoległość i strategia worktree

Równoległe zmiany są sednem 10x-owej strony tego workflow — ale każda z nich to
worktree, świeży kontekst agenta i aktywny liveness root we wspólnym storze.
Zdecyduj o kształcie tej równoległości, zanim ją przeskalujesz.

1. Ile zmian będzie biec równolegle i czy ta liczba jest na poziomie lub poniżej twojej przepustowości review z obszaru 5?
   *Przykład: „Maksymalnie trzy równoległe zmiany, bo tyle wchłania dwóch recenzentów." Limit nie jest sugestią: każda otwarta zmiana to aktywny liveness root i przyszła pozycja w kolejce review.*

2. Jaka jest twoja konwencja nazewnictwa i umiejscowienia worktree?
   *Przykład: „`git worktree add ../<repo>-<change-id> -b <change-id>` — katalog siostrzany, branch nazwany od zmiany." Jedna zmiana na worktree, jeden worktree na zmianę; wspólny katalog roboczy dwóch agentów oznacza dwie zmiany piszące jeden niezacommitowany stan.*

3. Czy wszyscy agenci dostają świeży kontekst per zmiana, czy kusi cię ponowne użycie długo żyjącej sesji między zmianami?
   *Przykład: „Każda zmiana startuje nową sesję agenta; kontekst wnosi recall startowy z /gw-new, nie historia rozmowy." Ponowne użycie jednej sesji między zmianami niweczy projekt — pamięcią jest graf, nie scrollback czatu.*

4. Czego oczekujesz, gdy dwie równoległe zmiany sobie zaprzeczą — i czy zespół wie, że to system działający poprawnie?
   *Przykład: „Zmiana A capture'uje «sumy czytane z nagłówka», migracja zmiany B temu zaprzecza; agent B rejestruje CONTRADICTS, oba węzły pokazują się jako disputed w recallach drugiej strony, a para ląduje w kolejce review, zanim którakolwiek się zmerguje." Jeśli zespół traktuje sporną parę jako błąd do stłumienia, a nie pozycję kolejki do rozstrzygnięcia, praca równoległa będzie się po cichu degradować.*

5. Czy nakładające się podsystemy w ogóle będą biec równolegle, czy partycjonujecie zmiany po facecie/podsystemie?
   *Przykład: „Dwie zmiany nie mogą w tym samym tygodniu obie dotykać `invoicing`; pary między podsystemami biegną swobodnie." Store czyni konflikty między zmianami widocznymi, ale partycjonowanie gorących podsystemów utrzymuje kolejkę review małą.*

## 8. Zespół i współdzielenie store'a

Jest jeden store na projekt (`context/memory-graph.db`), binarka pozostaje poza
gitem, a powierzchnią merge'a jest czytelny dump. Użycie solo jest trywialne;
użycie zespołowe wymaga jawnej dyscypliny, bo równoległy zapis binarki przez
dwie osoby jest niezdefiniowany.

1. Solo czy zespół — a jeśli zespół, to czy wszyscy faktycznie będą dzielić jeden graf, czy każdy członek prowadzi prywatny store?
   *Przykład: „Zespół trzyosobowy, jeden wspólny graf — inaczej constrainty Alicji nigdy nie pojawią się w recallach Boba i cała między-zmianowa wypłata z workflow przepada." Zespół z prywatnymi store'ami to tak naprawdę N projektów solo noszących jedno repo.*

2. Czy dyscyplina dump/restore jest spisana tam, gdzie nikt jej nie przeoczy — dump przed pushem, restore po pullu?
   *Przykład: „Hook pre-push uruchamia `scripts/dump_db.py`; hook post-merge uruchamia `scripts/restore_db.py`; plik dumpa jest commitowany, .db jest w .gitignore." Niezacommitowany dump oznacza, że agenci twoich kolegów recallują graf, w którym brakuje twojego ostatniego tygodnia capture'ów.*

3. Kto i jak rozwiązuje konflikty merge na pliku dumpa?
   *Przykład: „Konflikty na dumpie rozwiązuje autor zmiany jak każdy konflikt tekstowy, po czym `restore_db.py` przebudowuje lokalny store; jeśli konflikt dotyczy spornych węzłów, idzie zamiast tego do właściciela kolejki review." Zdecydujcie o tym przed pierwszym konfliktem, nie w jego trakcie.*

4. Czy zapobiegacie równoległym piszącym do jednego pliku store'a — osobne klony z własnymi lokalnymi store'ami, synchronizowane wyłącznie przez git?
   *Przykład: „Klon każdego członka ma własny context/memory-graph.db odbudowany z zacommitowanego dumpa; nikt nie celuje dwiema sesjami w jeden store przez udział sieciowy." Założenie pojedynczego piszącego jest strukturalne, nie jest kwestią stylu.*

5. Jak zarejestrowany jest serwer MCP — dla całego użytkownika przez `claude mcp add`, czy przez zacommitowany `.mcp.json`, żeby każdy kontrybutor dostał go automatycznie?
   *Przykład: „Zacommitowany .mcp.json ze ścieżką `--directory` uzgodnioną w README, więc onboarding to `git clone` + `uv sync` i serwer po prostu działa." Rejestracja dla całego użytkownika działa solo; w zespole oznacza, że każdy nowy członek po cichu działa bez pamięci, aż zauważy, że capture'y są tracone, nie kolejkowane.*

6. Czy CI albo jakakolwiek automatyzacja otwiera sesje przeciw store'owi — a jeśli tak, dostaje store jednorazowy czy prawdziwy?
   *Przykład: „CI uruchamia smoke testy /gw-goal przeciw store'owi odtworzonemu z dumpa do katalogu tymczasowego, nigdy przeciw żywemu .db dewelopera." Automatyzacja pisząca do store'a, którego nikt nie recenzuje, produkuje szum journalowy psujący ranking wszystkim.*

## 9. Środowisko i narzędzia

Workflow degraduje się do czystego 10x w chwili, gdy serwer pamięci jest
nieosiągalny — a capture'y są *tracone, nie kolejkowane*. Załatw hydraulikę
przed pierwszą zmianą, nie w jej trakcie.

1. Gdzie będzie mieszkać agentic-memory-system i czy `uv` jest dostępne wszędzie tam, gdzie działają agenci?
   *Przykład: wspólny klon w `/opt/agentic-memory-system` z `uv` na każdej maszynie deweloperskiej — kontra każdy kontrybutor klonujący do innej ścieżki, psując zacommitowany `.mcp.json` wszystkim pozostałym.*

2. Czy serwer MCP będzie zarejestrowany dla całego użytkownika (`claude mcp add`), czy per projekt przez zacommitowany `.mcp.json`?
   *Przykład: deweloper solo pracujący na wielu projektach rejestruje dla całego użytkownika; zespół commituje `.mcp.json`, żeby każdy kontrybutor dostał serwer bez konfiguracji — ale wtedy ścieżka `--directory` musi być taka, którą wszyscy faktycznie mają.*

3. Czy katalog roboczy serwera (albo jawny `MEMORY_DB_PATH`) rozwiązuje się do `context/memory-graph.db` *tego* projektu — i tylko tego projektu?
   *Przykład: uruchomienie serwera z niewłaściwego katalogu po cichu otwiera inny store; jeden store wycelowany w dwa projekty zatruwa oba.*

4. Jaka jest reguła zespołu, gdy powierzchnia pamięci leży — które fazy stają, które idą dalej?
   *Przykład: „poprawki mechaniczne mogą iść dalej wyłącznie na plikach; research i granice planu czekają" — bo capture wykonany przeciw martwemu serwerowi nie jest kolejkowany na później, po prostu nigdy się nie wydarzył.*

5. Czy CI i środowiska headless w ogóle potrzebują serwera, a jeśli tak, kto go startuje?
   *Przykład: przebieg `/gw-goal` w CI potrzebuje serwera MCP w kontenerze joba; zwykły pipeline testowy nie — późna decyzja oznacza albo niestabilne przebiegi headless, albo serwer przykręcony do każdego niepowiązanego joba.*

6. Kto może uruchamiać powierzchnie uprzywilejowane — skrypt cyklu życia (`memory_lifecycle.py`) i GUI — i skąd?
   *Przykład: archiwizacja przy merge'u wymaga, żeby `uv run python scripts/memory_lifecycle.py deactivate <id> --sweep` dało się uruchomić z projektu; jeśli tylko maszyna jednej osoby dosięga repo pamięci, każdy merge staje w kolejce za nią.*

## 10. Wrażliwość wiedzy i higiena

Recall serwuje treść węzła **dosłownie** każdej przyszłej sesji agenta, a w
trybie zespołowym czytelny dump jest commitowany do gita. Traktuj każdy
`capture_artifact` jak zapis do trwałego, współdzielonego, greppowalnego
dokumentu.

1. Jakie klasy treści są w grafie zakazane z góry?
   *Przykład: poświadczenia, klucze API, PII, poufne warunki klientów — „klucz Stripe mieszka w vaultcie X" to constraint w porządku; sam klucz w treści węzła kończy w commitowanym do gita dumpie na zawsze.*

2. Czy store jest współdzielony przez zacommitowany dump i czy wszyscy rozumieją, że to czyni treść węzłów widoczną w repo?
   *Przykład: kontraktor z dostępem do repo czyta każdą scapture'owaną decyzję, w tym uzasadnienie cennika, które ktoś wkleił do węzła `decision` „dla kontekstu".*

3. Jak będziecie formułować artefakty o wrażliwych systemach bez osadzania wrażliwej części?
   *Przykład: capture „tokeny auth rotują co 24h; konsumenci nie mogą ich cache'ować" (constraint), a nie format tokenu, przykładowe wartości ani nazwiska klientów z post-mortem incydentu.*

4. Kto audytuje graf pod kątem wyciekłej treści i kiedy?
   *Przykład: recenzent skanuje nowe węzły przy bramce pamięci `/gw-review` — w tym samym momencie, w którym rozstrzyga o promocjach — bo po merge'u dump jest w historii, a usunięcie oznacza rewrite.*

5. Czy cokolwiek w samym PRD/ADR-ach wymaga redakcji, zanim `/gw-foundation` to zdestyluje?
   *Przykład: ADR nazywający partnera objętego NDA zostaje zdestylowany jako „partner płatniczy wymaga idempotentnych webhooków", a nie z nazwą partnera.*

## 11. Konserwacja i kadencja cyklu życia

Folding trustu, rozstrzyganie flag i promocja to operacje uprzywilejowane,
biegnące *poza* powierzchnią agenta. Jeśli nikt ich nie zaplanuje, kolejka
rośnie, sporne węzły się piętrzą, a recall powoli zapełnia się nieaktualną,
kontestowaną wiedzą — graf gnije dokładnie tak szybko, jak ludzie go ignorują.

1. Kto przerabia kolejkę staleness/review i z jaką kadencją?
   *Przykład: recenzent otwiera `uv run agentic-memory-gui` → zakładkę Review przy każdej bramce PR, plus cotygodniowy przegląd wszystkiego, co PR-y przeoczyły — kontra kolejka bez właściciela, w której każdy sporny węzeł pozostaje sporny na zawsze.*

2. Kiedy faktycznie biegnie evaluator / uprzywilejowana konserwacja (folding trustu, regułowe rozstrzyganie flag) i kto ją wyzwala?
   *Przykład: zaplanowana cotygodniowa paczka — zmiany headless `/gw-goal` zależą od ścieżki reguły+evaluator dla swojej ważności, więc „nigdy" oznacza, że ich sprzeczności kumulują się bez triażu.*

3. Czy recenzenci będą egzekwować konsolidację przy `/gw-review`, czy w praktyce jest ona opcjonalna?
   *Przykład: pozycja checklisty PR — „węzeł podsumowania zmiany istnieje, a kandydaci do promocji rozstrzygnięci" — bo niewypromowane podsumowanie zasypia przy sweepie i epizod znika z żywego recallu.*

4. Jak wygląda „zdrowy" stan tego grafu i kto to sprawdza?
   *Przykład: recalle wynoszą na wierzch głównie wypromowane, bezsporne węzły; kolejka review dąży do pustej po każdym cyklu PR. Gnicie: recalle startowe zdominowane tagami `disputed`, kandydaci do promocji nigdy nierozstrzygnięci, sweepy archiwizujące wszystko, bo nic nie zostało wypromowane.*

5. Jaka jest reguła dla zmian, które utknęły albo zostały porzucone — kto zamyka ich zakres pamięci?
   *Przykład: zmiana uśpiona od miesiąca wciąż trzyma swój liveness root włączony, utrzymując swój short-termowy szum żywym w każdym recallu; ktoś musi zdecydować o jej `/gw-archive` ze `status: abandoned`.*

## 12. Kryteria sukcesu i strategia wyjścia

Workflow kosztuje dyscyplinę na każdej granicy fazy. Zdecyduj z góry, po czym
poznasz, że się spłaca — i jak wygląda odejście — tak by decyzja o kontynuacji
była dowodem, a nie kosztem utopionym.

1. Jaka obserwowalna zmiana oznacza, że graf działa?
   *Przykład: recalle startowe nowych zmian wynoszą na wierzch istotne constrainty, które świeży agent inaczej wyprowadzałby od nowa; plany przestają nieświadomie naruszać ustalone decyzje; ten sam spór architektoniczny przestaje być rozstrzygany od nowa co kwartał.*

2. Co faktycznie sprawdzisz i kiedy?
   *Przykład: po pierwszych pięciu zarchiwizowanych zmianach przeczytaj trzy świeże bundle recallu — jeśli najwyżej rankowane bloki to węzły fundamentowe i skonsolidowane podsumowania, a nie szum, jakość capture się trzyma; jeśli recalle wracają puste albo nieistotne, napraw dyscyplinę capture, zanim przeskalujesz.*

3. Jaki wiodący sygnał porażki będziesz obserwować?
   *Przykład: agenci pomijający `append_events` (sesje niewidzialne dla rankingu) albo capture'y czytające się jak narracja — oba degradują recall na miesiące, zanim ktokolwiek to zauważy, więc wyrywkowo sprawdzaj journal wcześnie.*

4. Jeśli porzucisz workflow, co przetrwa?
   *Przykład: dokumenty fundamentowe zawsze były ludzkim źródłem prawdy, więc nic krytycznego dla wiedzy nie żyje wyłącznie w grafie; zacommitowany dump jest czytelnym tekstem, więc dawne decyzje pozostają greppowalne nawet bez serwera.*

5. Jaki jest minimalny sensowny odwrót, krótszy niż pełne porzucenie?
   *Przykład: zejdź do czystego 10x (same pliki), ale zachowaj `/gw-foundation` i konsolidację przy bramce review — dwa najcenniejsze punkty capture — zamiast wyjścia wszystko-albo-nic.*

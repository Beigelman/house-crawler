# Property interface checks

Profile: light
Plan: `.specs/features/property-interface/plan.md`
Feature base: `9c01baa38fbe8d8d7ce818df07f1f416c7058745`

64 checks in 4 slices · 8 one-way doors · 0 open blockers.

Proof commands use Deno’s built-in test runner (confirmed by `deno test --help`) and Playwright Test (package registry confirmed). The frontend is new, so its test harness is introduced by this feature. Database proofs target a disposable local Supabase stack, never the environment’s production project.

## Checks

### S1

**C1** - WHEN the configured owner completes email magic-link authentication THEN the interface SHALL open the requested private route, defaulting to `/`. (AC 1)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC01`

**C2** - WHEN an unauthenticated visitor opens a private route THEN the interface SHALL redirect to `/login` without displaying cached property data. (AC 2)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC02`

**C3** - IF an authenticated non-owner calls a property Data API or enqueue RPC THEN the database SHALL deny access to all property records and mutations. (AC 3)
Proof: `rtk deno test -A tests/database_test.ts --filter AC03`

**C4** - The deployed frontend bundle SHALL contain zero server-side Supabase credentials and zero Resend API keys. (AC 4)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC04`

**C5** - WHEN the additive migration runs twice on the same legacy fixture THEN the database SHALL retain exactly the original listing identities and original `titulo`, `valor`, and `created_at` values. (AC 5)
Proof: `rtk deno test -A tests/database_test.ts --filter AC05`

**C6** - WHEN a stored price is unambiguously parseable as BRL THEN the migration SHALL convert `R$ 1.234.567,89` to `123456789` centavos. (AC 6)
Proof: `rtk deno test -A tests/database_test.ts --filter AC06`

**C7** - IF a stored price is absent, a range, or unparseable THEN the numeric price SHALL remain null. (AC 7)
Proof: `rtk deno test -A tests/database_test.ts --filter AC07`

**C8** - WHEN the owner opens `/imoveis` THEN the interface SHALL show 30 results per page ordered by first-seen time descending with canonical URL ascending as the tie-breaker. (AC 8)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC08`

**C9** - WHEN browse filters change THEN the listing query SHALL apply the conjunction of text, source, inclusive price/area bounds, exact room count, neighborhood, first-seen date, availability, and mark filters before pagination. (AC 9)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC09`

**C10** - WHEN the owner chooses price order THEN numeric price SHALL determine ascending or descending ordering with unknown prices last and canonical URL ascending as the tie-breaker. (AC 10)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC10`

**C11** - WHEN the owner reloads or shares a browse URL within their session THEN the interface SHALL restore its filters, order, and page from the URL query. (AC 11)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC11`

**C12** - WHEN the owner opens a listing THEN the details screen SHALL display its title, source link, original price text, available structured attributes, and first/last observation timestamps, using `Não informado` for unknown attributes. (AC 12)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC12`

**C13** - IF a listing photo is absent or fails to load THEN its card SHALL display a fixed-size placeholder without hiding the listing link. (AC 13)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC13`

**C14** - WHEN the owner opens `/` THEN the dashboard SHALL show active listing count, listings first seen in the last 7 days, counts per source, and the latest persisted run outcome, using zero or `Sem execuções` when no data exists. (AC 14)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC14`

**C15** - WHILE any private screen has its initial query pending THEN that screen SHALL display a labeled loading state instead of a zero-result state. (AC 15)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC15`

**C16** - IF a list query succeeds with zero records THEN the corresponding dashboard, listings, searches, or runs screen SHALL show its named empty state with a next action. (AC 16)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC16`

**C17** - IF a private screen query fails THEN that screen SHALL show a Portuguese error message and a retry control without claiming the result is empty. (AC 17)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC17`

**C18** - IF a requested canonical URL has no saved listing THEN the detail screen SHALL show `Imóvel não encontrado` with a link back to `/imoveis`. (AC 18)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC18`

**C19** - WHEN any screen is rendered at viewport widths 375px and 1440px THEN its page SHALL have no horizontal document overflow. (AC 19)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC19`

**C20** - WHEN the owner navigates interactive controls using only a keyboard THEN each control SHALL expose an accessible name and visible focus indicator. (AC 20)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC20`

### S2

**C21** - WHEN the owner saves a favorite, contacted, or discarded status THEN that listing's single owner mark SHALL persist the selected status after reload. (AC 21)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC21`

**C22** - WHEN the owner saves a note of at most 2,000 characters THEN that listing's mark SHALL preserve the note as plain text after reload. (AC 22)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC22`

**C23** - IF a note exceeds 2,000 characters THEN the save SHALL reject it without changing the persisted note. (AC 23)
Proof: `rtk deno test -A tests/database_test.ts --filter AC23`

**C24** - IF saving a mark fails THEN the interface SHALL restore the last persisted mark and show a save error. (AC 24)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC24`

**C25** - WHEN the owner clears a status THEN the mark SHALL preserve any existing note. (AC 25)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC25`

**C26** - The mark controls SHALL treat discarded as a reversible status and SHALL expose no hard-delete listing action. (AC 26)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC26`

### S3

**C27** - WHEN the owner creates or edits a saved search THEN `/buscas` SHALL persist its name, enabled state, providers, neighborhoods, room counts, suite count, area bounds, price bounds, elevator requirement, and parking requirement. (AC 27)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC27`

**C28** - IF a profile has no supported provider/neighborhood/room, a name outside 1–80 characters, a non-integer room or suite count outside 0–10 (rooms minimum 1), negative/nonfinite bounds, or minimum above maximum THEN the database SHALL reject the entire profile write with no partial save. (AC 28)
Proof: `rtk deno test -A tests/database_test.ts --filter AC28`

**C29** - WHEN profiles are initialized from the existing entry point THEN the default profile SHALL preserve its exact current search criteria and provider selection. (AC 29)
Proof: `rtk deno test -A tests/database_test.ts --filter AC29`

**C30** - WHEN collection starts THEN the run SHALL persist an immutable snapshot of the enabled profile configuration it uses. (AC 30)
Proof: `rtk deno test -A tests/database_test.ts --filter AC30`

**C31** - WHEN providers return candidate listings THEN persisted profile matches SHALL include only listings satisfying all required criteria using observed attributes; unknown required attributes do not satisfy the requirement. (AC 31)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC31`

**C32** - WHEN the owner requests collection with a new request key and valid enabled profiles THEN the enqueue RPC SHALL return `accepted` only after a queued request is durable. (AC 32)
Proof: `rtk deno test -A tests/database_test.ts --filter AC32`

**C33** - WHEN the same owner repeats a request key with the same profile selection THEN the enqueue RPC SHALL return the original request ID with `replayed` and create no second request. (AC 33)
Proof: `rtk deno test -A tests/database_test.ts --filter AC33`

**C34** - IF a request key is reused with a different profile selection THEN the enqueue RPC SHALL return HTTP 400 without changing the original request. (AC 34)
Proof: `rtk deno test -A tests/database_test.ts --filter AC34`

**C35** - IF another manual request is queued or running THEN a new enqueue call SHALL return `busy` with that request ID without creating another request. (AC 35)
Proof: `rtk deno test -A tests/database_test.ts --filter AC35`

**C36** - IF a new enqueue call occurs less than 60 seconds after that owner's last accepted request and none is active THEN the RPC SHALL return `rate_limited` with a positive remaining retry interval without creating a request. (AC 36)
Proof: `rtk deno test -A tests/database_test.ts --filter AC36`

**C37** - WHEN a healthy idle worker polls THEN it SHALL attempt to claim queued work at intervals no greater than 30 seconds. (AC 37)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC37`

**C38** - WHEN scheduled collection, validation, and manual collection contend for the property lease THEN exactly one contender SHALL contact providers during the active lease. (AC 38)
Proof: `rtk deno test -A tests/database_test.ts --filter AC38`

**C39** - IF a worker's lease has expired THEN any subsequent run-data write using its old fencing token SHALL be rejected. (AC 39)
Proof: `rtk deno test -A tests/database_test.ts --filter AC39`

**C40** - IF an unfinished run's lease expires THEN the next healthy worker SHALL mark that run and its request `interrupted` before executing new work. (AC 40)
Proof: `rtk deno test -A tests/database_test.ts --filter AC40`

**C41** - WHEN the worker is stopped or the browser is closed after enqueueing THEN a queued request SHALL remain stored until a worker claims it; browser closure does not cancel running work. (AC 41)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC41`

**C42** - WHEN the owner opens `/execucoes` THEN the screen SHALL show runs newest first with source counts, start/end timestamps, per-source errors, and separate email delivery outcome. (AC 42)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC42`

**C43** - WHEN heartbeat age exceeds 120 seconds THEN the dashboard SHALL show the worker as offline and display its last-seen timestamp; absent heartbeat shows `Nunca conectado`. (AC 43)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC43`

**C44** - IF at least one source succeeds and at least one fails THEN the run SHALL finish `partial` while retaining listings collected from successful sources. (AC 44)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC44`

**C45** - IF every source fails THEN the run SHALL finish `failed` without marking existing listings removed. (AC 45)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC45`

**C46** - WHEN the existing CLI entry points finish THEN they SHALL exit 0 for complete runs, 1 for failed/partial runs, or 2 for lease contention, and print a summary containing the run ID and outcome. (AC 46)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC46`

**C47** - IF the database is unreachable before lease acquisition THEN the worker or scheduled command SHALL make zero provider requests and report the database error. (AC 47)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC47`

**C48** - WHEN a source request exceeds 30 seconds THEN the run SHALL record a timeout for that request; HTTP 429/5xx/network failures receive at most 2 retries with 2-second then 4-second delays, and 403 responses receive zero automatic retries. (AC 48)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC48`

**C49** - WHEN run diagnostics are persisted THEN they SHALL contain run/source identifiers and error categories without credentials, Auth tokens, or raw environment-variable values. (AC 49)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC49`

### S4

**C50** - WHEN either existing provider parses a listing fixture THEN its observation SHALL include source, canonical URL, price, area, rooms, neighborhood, optional photo, and optional elevator/parking/suite evidence, with null for absent attributes. (AC 50)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC50`

**C51** - WHEN a known listing is observed at a changed numeric price THEN persistence SHALL update its current price and append exactly one run-linked price observation. (AC 51)
Proof: `rtk deno test -A tests/database_test.ts --filter AC51`

**C52** - WHEN a known listing is observed at the same numeric price or the same run/listing write is retried THEN persistence SHALL append zero duplicate price observations. (AC 52)
Proof: `rtk deno test -A tests/database_test.ts --filter AC52`

**C53** - IF an observation's price is unparseable THEN persistence SHALL preserve the last known numeric price and its observation timestamp rather than presenting the unknown observation as a price drop. (AC 53)
Proof: `rtk deno test -A tests/database_test.ts --filter AC53`

**C54** - WHEN validation confirms a 404, 410, or explicit provider removal THEN the listing SHALL become removed while preserving its marks and price history. (AC 54)
Proof: `rtk deno test -A tests/database_test.ts --filter AC54`

**C55** - IF validation encounters a 403, timeout, network failure, or missing parser fields THEN it SHALL record unknown verification without changing the listing's last confirmed availability. (AC 55)
Proof: `rtk deno test -A tests/database_test.ts --filter AC55`

**C56** - WHEN a removed listing is observed active again THEN it SHALL return to active under the same canonical identity and retain its price history. (AC 56)
Proof: `rtk deno test -A tests/database_test.ts --filter AC56`

**C57** - WHEN the owner opens listing details THEN the price-history view SHALL order observations by observation timestamp ascending and identify legacy-import observations separately. (AC 57)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC57`

**C58** - WHEN a listing has at least 5 qualifying peers under door 7 THEN its comparison SHALL display their median asking-price/m², peer count, cohort label, and subject percentage difference, excluding the subject from the cohort. (AC 58)
Proof: `rtk deno test -A tests/database_test.ts --filter AC58`

**C59** - IF fewer than 5 qualifying peers exist THEN the comparison SHALL show `Dados insuficientes` without a discount badge or rank value. (AC 59)
Proof: `rtk deno test -A tests/database_test.ts --filter AC59`

**C60** - WHEN comparisons are displayed THEN the interface SHALL label them `Preços pedidos dos anúncios coletados` and display the comparison computation timestamp. (AC 60)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC60`

**C61** - WHEN the owner sorts listings by opportunity THEN comparable listings SHALL be ordered by percentage below their cohort median descending, with unscored listings last and canonical URL ascending as the tie-breaker. (AC 61)
Proof: `rtk npm --prefix frontend exec -- playwright test --grep AC61`

**C62** - WHEN a collection saves new or updated listings THEN comparison values SHALL be recomputed from that committed dataset before the run is marked complete. (AC 62)
Proof: `rtk deno test -A tests/database_test.ts --filter AC62`

**C63** - WHEN collection detects new listings THEN the existing email integration SHALL receive only those new listings using environment-configured recipients, with zero price-change-only emails. (AC 63)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC63`

**C64** - IF email delivery fails after collection commits THEN the run SHALL retain collected listings and record delivery failure without rerunning collection or automatically resending the email. (AC 64)
Proof: `rtk deno test -A tests/worker_test.ts --filter AC64`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `/login` states (6) | 200 C1 · idle C1 · sending C1 · sent C1 · error C1 · unauthorized-account C3 | - |
| `/` states (6) | 200 C14 · loading C15 · ready C14 · empty C16 · error C17 · unauthorized C2 | - |
| `/imoveis` states (6) | 200 C8 · loading C15 · ready C8 · empty C16 · error C17 · unauthorized C2 | - |
| `/imoveis/:encodedLink` states (6) | 200 C12 · loading C15 · ready C12 · not-found C18 · error C17 · unauthorized C2 | - |
| `/buscas` states (8) | 200 C27 · loading C15 · ready C27 · empty C16 · invalid C28 · saving C27 · error C17 · unauthorized C2 | - |
| `/execucoes` states (6) | 200 C42 · loading C15 · ready C42 · empty C16 · error C17 · unauthorized C2 | - |
| `POST /rest/v1/rpc/enqueue_property_crawl` HTTP statuses (4) | 200 C32 · 400 C34 · 401 C3 · 403 C3 | - |
| enqueue outcomes (4) | accepted C32 · replayed C33 · busy C35 · rate_limited C36 | - |
| mark statuses (4) | favorite C21 · contacted C21 · discarded C21 · null C25 | - |
| worker entry assemblies (3) | scheduled collection C38 · validation C38 · request worker C38 | - |
| run outcomes (5) | succeeded C46 · partial C44 · failed C45 · interrupted C40 · running C38 | - |
| sources (2) | dfimoveis C50 · wimoveis C50 | - |
| validation outcomes (3) | active C56 · removed C54 · unknown C55 | - |
| doors (8) | frontend C1 · private access C3 · identity/marks C5 · profiles C29 · queue/lease C38 · history C51 · comparisons C58 · local proof harness C38 | - |
| entities (9) | Owner C3 · Listing C5 · ListingMark C21 · SearchProfile C27 · CrawlRequest C32 · Run C42 · WorkerLease C38 · PriceObservation C51 · ProfileMatch C31 | - |
| cohort boundaries (3) | 4 peers C59 · 5 peers C58 · 6 peers C58 | - |

## Swept

- validation: C7, C23, C28
- failure modes: C24, C44, C45, C64
- idempotency: C33, C34, C51, C52
- authorization: C2, C3, C4, C36
- concurrency: C8, C30, C38, C39, C40
- data lifecycle: C5, C54, C55, C56, C57
- dependency failure: C43, C47, C48
- state transitions: C32, C40, C54, C56
- observability: C14, C42, C43, C49

## Handoff

One builder; budget 150k tokens. Existing affected TypeScript/SQL/scripts are approximately 45 KB / 4 = 11.25k tokens. Estimated additions: S1 45 KB / 4 = 11.25k; S2 12 KB / 4 = 3k; S3 85 KB / 4 = 21.25k; S4 35 KB / 4 = 8.75k; proofs/docs 65 KB / 4 = 16.25k. Total approximately 71.75k, below 150k. No builder delegation; independent verification is dispatched after the final feature commit.

Test policy: no project-wide guidelines changed; light profile. Assertions are derived from the approved claims before implementation. No proof is complete until its actual command passes with located evidence.

Build notes: fixtures use the Postgres driver's JSON encoder to preserve JSON object shape, handle empty HTTP 204 responses, and inject the browser session once per tab rather than on every navigation. The logout fixture explicitly awaits completion before exercising signed-out navigation. These are test assembly corrections; no required outcome or assertion was removed or weakened. Browser and database proof suites must run sequentially because they share the disposable database.

## Author proof status

All 64 checks: implemented; individual named proofs passed in the author run. Database/worker: 38 tests; browser: 28 tests. Additional checks: strict plan gate, checks gate, Deno typecheck/lint, frontend production build, local Supabase security advisors, and desktop/mobile visual inspection. Independent verification is pending; this is not a completion verdict.

## Verification follow-up

Round 1 at `2e6ad94` returned FAIL: stale persisted profile membership and run-wide new-listing email eligibility, plus incomplete boundary assertions. The original claims/proof selectors remain fixed. Supplementary tests now exercise actual magic links, populated authorization/mutation attempts, isolated legacy-schema migrations, complete UI values and ordering boundaries, real provider adapters, CLI subprocess exits, queue durability with stopped workers/browser closure, persisted diagnostics, and the existing email adapter. A centavo-bound regression additionally exposed binary-float multiplication at inclusive money bounds; shared decimal shifting now agrees with integer storage. The approved layout is retained (user: “Keep this layout”).

The first independent report is preserved as `verification.round1.md`. Round 2 must rerun all proofs at the fix HEAD and reassess every previously unproven check; no author completion verdict replaces it.

Round 2 at `8d4ef85` independently proved 63/64 checks. Its remaining padded-name case is covered by a new rejection/valid-boundary proof and an idempotent upgrade of the existing name constraint. Both previous independent reports are retained; final scoped verification is pending.

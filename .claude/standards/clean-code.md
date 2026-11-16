# Clean Code and SOLID

> Managed by the dev template. Applies to every stack; stack standards add language-specific rules.

Code is read far more often than it is written. Optimize for the next reader. These rules guide
design; apply them with judgment, and when two rules conflict, prefer the simpler code.

## Naming

- Names reveal intent: `elapsedDays`, not `d`; `fetchActiveUsers()`, not `getData()`.
- Classes and types are nouns (`InvoiceRepository`), functions are verbs (`sendInvoice`), booleans read as
  questions (`isExpired`, `hasAccess`).
- One word per concept across the codebase (do not mix `fetch`, `get`, `retrieve` for the same thing).
- No abbreviations, Hungarian notation, or type suffixes (`userList`, `strName`) unless the codebase already uses them.
- Use the domain's vocabulary (ubiquitous language); the same term in code, tests, and conversation.

## Functions

- Small and doing one thing, at one level of abstraction. If you need "and" to describe it, split it.
- Few parameters (ideally ≤ 3). Group related ones into an object/value type; avoid boolean flag
  parameters that switch behaviour (split into two functions instead).
- No hidden side effects: a function named `checkPassword` does not also start a session.
- Command-query separation: a function either changes state or returns information, not both.
- Prefer early returns over deep nesting; keep cyclomatic complexity low.
- Prefer pure functions for business logic; push I/O (network, disk, clock, randomness) to the edges.

## Classes and modules

- Small and cohesive: their fields and methods serve one purpose.
- Hide internals: expose behaviour, not data structures (tell, don't ask). Keep fields private by default.
- Prefer composition over inheritance. Inherit only for real "is-a" relationships with substitutable behaviour.
- Prefer immutable values; make mutation explicit and local.
- Respect the Law of Demeter: avoid chains like `order.customer.address.city.name` across boundaries.

## SOLID

- **S: Single Responsibility.** A module has one reason to change, i.e. one actor it serves.
  Separate business rules, persistence, presentation and transport (HTTP, UI). A UI widget/view does not
  talk to the database; a repository does not format prices for display.
- **O: Open/Closed.** Add behaviour by adding code (a new implementation, strategy, or handler) rather than
  editing a growing `switch`/`if` chain on types. Apply it where variation actually exists, not speculatively.
- **L: Liskov Substitution.** Any implementation must honour the contract of its interface or base type:
  no stricter preconditions, no weaker guarantees, no `throw NotImplemented` overrides. If a subtype cannot
  do what the parent promises, the hierarchy is wrong.
- **I: Interface Segregation.** Clients depend only on what they use. Prefer several small, role-based
  interfaces (`InvoiceReader`, `InvoiceWriter`) over one broad one.
- **D: Dependency Inversion.** Business logic depends on abstractions it owns (ports); infrastructure
  implements them (adapters). Inject dependencies through constructors; no hidden singletons, service
  locators, or `new HttpClient()` inside domain code. This is what makes code unit-testable.

## Architecture

- Dependencies point inward: UI / framework / infrastructure → application → domain. The domain imports
  no framework, database, or network code.
- Organize by feature (vertical slices) first, then by layer inside a feature, unless the project already
  follows another structure.
- Keep framework code thin: controllers, widgets, views, and view controllers delegate to testable classes.
- Validate and convert external data at the boundary into domain types; inside, trust the types.

## Errors

- Fail fast with explicit errors; never swallow exceptions silently or return magic values (`-1`, `null`)
  for errors.
- Use the language's idiomatic mechanism (exceptions, `Result`, typed errors) consistently within a project.
- Error messages say what failed and with what input, without leaking secrets or personal data.

## Comments and formatting

- Code explains *what* and *how*; comments explain *why* (decisions, constraints, links to issues).
- No commented-out code, no redundant comments (`// increment i`), no journal comments: git has history.
- Public APIs get doc comments when their contract is not obvious from the signature.
- Formatting is the formatter's job; keep the project's formatter and linter clean.

## Simplicity first (the guard rails on all of the above)

- **KISS** and **YAGNI**: build what the current requirement needs. No interface with a single
  implementation "just in case", no generic framework for one use, no layers that only forward calls.
  Introduce an abstraction when a second real need appears, or when it is needed to test the code.
- **DRY** applies to knowledge, not to code that merely looks alike. Duplicate twice; extract on the third
  occurrence when the copies change for the same reason.
- Boy-scout rule, scoped: leave the code you touch cleaner than you found it, but refactors beyond the task
  go in their own commit or branch (see core standards: keep changes focused).
- Refactor under tests: make sure behaviour is covered before restructuring, and keep tests green at each step.

## Review checklist

When writing or reviewing code, check:

1. Can each function and class be described in one sentence without "and"?
2. Would a newcomer understand the names without reading the implementation?
3. Does business logic depend on framework, database or network code directly?
4. Can the logic be unit tested without a real database, network, or UI?
5. Is there an abstraction without a second use or a test need (over-engineering)?
6. Are errors handled explicitly and consistently?

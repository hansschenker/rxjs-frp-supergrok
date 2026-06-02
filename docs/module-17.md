# Module 17: Architecture Patterns

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

This module explores modern **reactive architecture patterns** for building large-scale applications. You will learn how to structure applications using feature-based design, integrate RxJS with modern Signals (Angular 16+, Vue, Solid), and refactor legacy codebases into clean reactive architectures. These patterns are used by leading teams at Google, Netflix, and many enterprise organizations.

**Estimated Total Time:** 125–145 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Modules 10–12 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Design feature-based reactive architectures
- Integrate RxJS with Signals (hybrid patterns)
- Refactor legacy applications to reactive patterns
- Build scalable, maintainable reactive systems
- Make informed architectural decisions

---

## Lesson 17.1: Feature-Based Reactive Architecture

**Estimated Time:** 22 minutes

### Organize by Feature, Not by Type
Instead of grouping by technical type (all components here, all services there), group by **business feature** — everything a feature needs lives together:

```text
src/
  features/
    cart/
      cart.api.ts        <- data access (HTTP)
      cart.store.ts      <- state (scan + reducer, Module 10)
      cart.facade.ts     <- public API the UI talks to
      cart.operators.ts  <- domain operators (Module 04)
      cart.component.ts   <- thin presentation
    checkout/
      ...
  shared/
    operators/           <- cross-feature operators (Module 16)
    ui/
```

### Why It Scales
- **Cohesion** — related code is co-located; a feature is easy to find, change, or delete.
- **Boundaries** — features expose a small public surface (the facade); internals stay private.
- **Team ownership** — a team owns a feature folder end to end.

### The Facade Pattern
Each feature exposes a **facade**: a small object with read-only state streams and intent methods. The UI never touches the store, API, or operators directly — only the facade.

```ts
class CartFacade {
  readonly viewModel$ = /* derived state stream */;
  add(item: Item) { /* dispatch */ }
  remove(id: string) { /* dispatch */ }
}
```

### Mental Model
> A feature is a **black box** with a facade for a lid. Outside code sees `viewModel$` and a few methods; the store, effects, and API are sealed inside.

### Common Mistake
**Leaking the store/Subjects out of the feature.** If components import the raw `BehaviorSubject` or call the API directly, the boundary erodes and the feature becomes un-refactorable. Export only the facade.

### Quick Exercise
Sketch the folder + facade for a "notifications" feature: what's in `api`, `store`, `facade`, and `component`?

**Key Takeaway:** Organize by feature with a facade as the public boundary — the UI sees read-only state streams and intent methods, never the store/API directly.

---

## Lesson 17.2: RxJS + Signals Hybrid Patterns (2026)

**Estimated Time:** 22 minutes

### Two Tools, Different Jobs
Modern frameworks (Angular 16+, Solid, Vue) ship **signals** — synchronous, glitch-free reactive *values*. RxJS remains the tool for **async, time, and event streams**. The 2026 best practice is a **hybrid**:

| Use… | For… |
|------|------|
| **RxJS** | HTTP, websockets, debouncing, retries, complex event orchestration, effects |
| **Signals** | synchronous derived UI state, template bindings, fine-grained rendering |

### Bridging the Two
Frameworks provide adapters (Angular's `toSignal` / `toObservable`):

```ts
// RxJS → Signal: consume an async stream as a signal in the template
const users = toSignal(this.facade.users$, { initialValue: [] });

// Signal → RxJS: react to a signal with stream operators
toObservable(this.query).pipe(
  debounceTime(300),
  switchMap(q => this.api.search(q))
).subscribe(/* ... */);
```

### A Vanilla "Signal" (to see the idea)
A rough mental model is "a synchronous value with a getter and subscribers." A real framework signal also has dependency tracking, fine-grained invalidation, and no Observable-style `error`/`complete` channel. Conceptually:

```ts
function signal<T>(initial: T) {
  const s = new BehaviorSubject<T>(initial);
  const accessor = () => s.value;        // read synchronously
  accessor.set = (v: T) => s.next(v);
  accessor.$ = s.asObservable();         // bridge to RxJS when you need streams
  return accessor;
}
```

### The Decision Rule
> If it involves **time or async** (debounce, HTTP, retry, merge), it's RxJS. If it's **synchronous derived state** for the view, it's a signal. Bridge at the edges.

### Common Mistake
**Rebuilding async orchestration with signals + `effect`.** Signal effects can approximate timers and async work, but RxJS is the better primitive for debounce, cancellation, retry, and multi-event coordination. Keep async orchestration in RxJS and bridge the resulting state to signals.

### Quick Exercise
For each, pick RxJS or signal: (a) the current theme, (b) a typeahead search, (c) a form's validity, (d) a websocket feed.

**Key Takeaway:** Use RxJS for async/time/event orchestration and signals for synchronous view state; bridge with `toSignal`/`toObservable` — don't reinvent async in signals.

---

## Lesson 17.3: Layered Architecture with Domain Operators

**Estimated Time:** 22 minutes

### The Layers
A reactive feature has clear layers, each depending only on the one below:

```text
Presentation  (component)        renders viewModel$, calls facade methods
      │
Facade        (facade)           public API: state streams + intent methods
      │
Application   (store + effects)  scan+reducer state (M10), effects (M05)
      │
Domain        (operators)        business rules as operators (M04, M16)
      │
Data          (api)              HTTP/websocket sources
```

### Dependencies Point Down
- Presentation knows the **facade** only.
- The facade composes the **store**, **effects**, and **domain operators**.
- Domain operators are pure and reusable; the **data** layer is swappable (real API ↔ mock) without touching anything above.

### Domain Operators as the Business Layer
The domain operators from Modules 04 & 16 *are* your business-rule layer. They keep rules out of components and stores:

```ts
orders$.pipe(eligibleOrders(), withLoyaltyDiscount(), readyToFulfil());
```

### Testability Falls Out
Each layer is testable in isolation: operators with `toArray` (M16), the store with dispatched actions (M10), the facade with a mock API. Swapping the data layer for a mock makes the whole feature unit-testable.

### Common Mistake
**Business logic in components.** When discount math or validation lives in a component, it can't be reused or tested and it leaks across the app. Push rules down into domain operators.

### Quick Exercise
Identify the layer for each: `debounceTime` on search input, an HTTP GET, "VIP customers get free shipping", `viewModel$`.

**Key Takeaway:** Layer features Presentation → Facade → Application (store/effects) → Domain (operators) → Data, with dependencies pointing down and business rules living in domain operators.

---

## Lesson 17.4: Refactoring Legacy Code to Reactive Streams

**Estimated Time:** 22 minutes

### Before: Tangled Imperative Component
Everything in one place — fetch, state, debounce, DOM — impossible to test or reuse:

```ts
// ❌ BEFORE: a component doing everything
let timer, lastQuery, users = [];
input.addEventListener('input', e => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (e.target.value === lastQuery) return;
    lastQuery = e.target.value;
    fetch('/api/users?q=' + e.target.value)
      .then(r => r.json())
      .then(data => { users = data; renderList(users); });
  }, 300);
});
```

### After: Layered Reactive
Each concern moves to its layer; the component becomes thin:

```ts
// data layer
const searchUsers = (q: string) => ajax.getJSON(`/api/users?q=${q}`);

// facade (application + domain)
class UsersFacade {
  private query$ = new Subject<string>();
  readonly users$ = this.query$.pipe(
    map(q => q.trim()), filter(q => q.length >= 2),
    debounceTime(300), distinctUntilChanged(),
    switchMap(q => searchUsers(q).pipe(catchError(() => of([])))),
    shareReplay(1)
  );
  search(q: string) { this.query$.next(q); }
}

// presentation: thin
facade.users$.subscribe(renderList);
input.addEventListener('input', e => facade.search(e.target.value));
```

### A Safe Refactoring Strategy
1. **Characterize** — add tests around the current behavior first.
2. **Extract the data layer** — wrap fetch/`setTimeout` in Observables.
3. **Introduce a facade** — move state + orchestration behind it.
4. **Thin the component** — it now only renders and dispatches.
5. **Migrate incrementally** — one feature at a time; the facade can wrap legacy code during transition.

### Micro-Frontends & Shared Reactive State
Across micro-frontends, share state via a small reactive **shared store** (a `BehaviorSubject`/facade on a shared module or custom event bus). Each micro-frontend subscribes; none reaches into another's internals — the facade boundary scales to the app-of-apps level.

### Common Mistake
**Big-bang rewrites.** Rewriting everything at once is risky and stalls delivery. Refactor incrementally behind facades — wrap legacy, migrate feature by feature, keep shipping.

### Quick Exercise
Take the "before" snippet and list which lines move to data, which to the facade, and what remains in the component.

**Key Takeaway:** Refactor legacy code incrementally — characterize with tests, extract a data layer, introduce a facade, thin the component — and share cross-app state through reactive facades, never big-bang rewrites.

---

## Lesson 17.5: Project Workshop – Large-Scale App Refactoring Case Study

**Estimated Time:** 30 minutes

### Project Goal

Build a feature the **right** way — a layered, facade-driven "Users" feature — so you can see the architecture from Lessons 17.1–17.4 running end to end:

- A **data layer** (mock API returning Observables with latency)
- A **facade** exposing a single `viewModel$` and intent methods (`search`, `setActiveOnly`)
- **Domain logic** as operators (filter active users) and a **debounced** search pipeline
- A **thin presentation** that only renders `viewModel$` and calls facade methods

### Why This Project Matters

The component ends up ~10 lines: subscribe to `viewModel$`, wire two inputs to facade methods. *All* the complexity (debounce, fetch, error handling, derived state) lives behind the facade — testable, reusable, and swappable. That is the architecture.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN.
2. **Data layer** — `searchUsers(q)` returns `of(...)` with `delay` (a fake API).
3. **Facade** — `query$` + `activeOnly$` Subjects; `viewModel$` composes search + filter + loading/error states.
4. **Presentation** — render `viewModel$`; inputs call `facade.search` / `facade.setActiveOnly`.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Layered Architecture • RxJS Facade</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-xl mx-auto p-8">
    <h1 class="text-3xl font-semibold tracking-tight mb-1">Users Feature</h1>
    <p class="text-zinc-400 mb-6">Thin component · all logic behind a facade</p>

    <div class="flex gap-3 mb-2">
      <input id="search" placeholder="Search users…" class="flex-1 bg-zinc-900 border border-zinc-700 focus:border-emerald-500 outline-none rounded-xl px-4 py-2.5 placeholder-zinc-600">
      <label class="flex items-center gap-2 text-sm text-zinc-400"><input id="active" type="checkbox"> Active only</label>
    </div>
    <div id="status" class="text-xs text-zinc-500 mb-3 h-4"></div>
    <ul id="list" class="space-y-2"></ul>
  </div>

  <script>
    const { Subject, combineLatest, of } = rxjs;
    const { map, filter, debounceTime, distinctUntilChanged, switchMap, startWith, catchError, delay } = rxjs.operators;

    // ===== DATA LAYER (swappable: real API ↔ this mock) =====
    const DB = [
      { id: 1, name: 'Ada Lovelace', active: true },
      { id: 2, name: 'Alan Turing', active: true },
      { id: 3, name: 'Grace Hopper', active: false },
      { id: 4, name: 'Edsger Dijkstra', active: true },
      { id: 5, name: 'Barbara Liskov', active: false },
      { id: 6, name: 'Donald Knuth', active: true },
    ];
    const api = {
      searchUsers: (q) => of(DB.filter(u => u.name.toLowerCase().includes(q.toLowerCase())))
        .pipe(delay(350)) // simulate network latency
    };

    // ===== DOMAIN RULE (business logic, reusable & testable) =====
    const activeOnly = (users, on) => on ? users.filter(u => u.active) : users;

    // ===== FACADE (application + domain, sealed) =====
    class UsersFacade {
      #query$ = new Subject();
      #active$ = new Subject();

      results$ = this.#query$.pipe(
        startWith(''),
        map(q => q.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q =>
          api.searchUsers(q).pipe(
            map(users => ({ users, loading: false, error: null })),
            startWith({ users: null, loading: true, error: null }),
            catchError(() => of({ users: [], loading: false, error: 'Search failed' }))
          )
        )
      );

      // Single view-model the UI binds to
      viewModel$ = combineLatest([this.results$, this.#active$.pipe(startWith(false))]).pipe(
        map(([res, activeFilter]) => ({
          ...res,
          users: res.users ? activeOnly(res.users, activeFilter) : res.users,
        }))
      );

      search(q) { this.#query$.next(q); }
      setActiveOnly(on) { this.#active$.next(on); }
    }

    // ===== PRESENTATION (thin: render + dispatch) =====
    const facade = new UsersFacade();
    const listEl = document.getElementById('status');
    facade.viewModel$.subscribe(vm => {
      document.getElementById('status').textContent =
        vm.loading ? 'Loading…' : vm.error ? vm.error : `${vm.users.length} user(s)`;
      document.getElementById('list').innerHTML = (vm.users || []).map(u => `
        <li class="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
          <span>${u.name}</span>
          <span class="text-xs ${u.active ? 'text-emerald-400' : 'text-zinc-500'}">${u.active ? 'active' : 'inactive'}</span>
        </li>`).join('');
    });

    document.getElementById('search').addEventListener('input', e => facade.search(e.target.value));
    document.getElementById('active').addEventListener('change', e => facade.setActiveOnly(e.target.checked));
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **The component is ~10 lines** — subscribe to `viewModel$`, wire two inputs. All complexity is sealed in the facade.
- **One `viewModel$` to bind** — loading, error, and filtered users arrive as a single state object (easy to render, easy to bridge to a signal).
- **The data layer is swappable** — replace the mock `api` with a real HTTP call and nothing above changes.
- **Domain rule is an operator** — "active only" is a reusable `map` step, not component code.

### Stretch Goals (Recommended Practice)

1. Add a `toSignal`-style accessor over `viewModel$` (Lesson 17.2) for a synchronous read.
2. Split the file into `users.api / users.facade / users.component` modules with a barrel.
3. Add an error-retry button using the resilience patterns from Module 08.
4. Add a second feature and share a "current user" facade between them (micro-frontend style).

### Deliverable

A layered Users feature: a swappable data layer, a facade exposing one `viewModel$` (debounced search + active filter + loading/error), and a thin presentation that only renders and dispatches.

**Key Takeaway:** You built a feature with real architecture — data, domain, application, facade, presentation — where the component is trivial and every layer is testable and swappable.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What is the core idea of feature-based architecture?
   - A) Group everything a business feature needs together, exposed via a small public facade
   - B) Group code by technical type (all services together, all components together)
   - C) Put all state in one global store
   - D) Avoid using folders

2. What is the role of a feature **facade**?
   - A) To style the components
   - B) To cache HTTP responses
   - C) The public boundary — read-only state streams + intent methods; internals stay sealed
   - D) To replace RxJS entirely

3. In the 2026 RxJS + Signals hybrid, which tool handles async orchestration (debounce, HTTP, retry)?
   - A) Signals with `effect`
   - B) RxJS
   - C) Plain `setTimeout`
   - D) The template

4. In a layered architecture, which direction do dependencies point?
   - A) Upward (data depends on presentation)
   - B) In every direction (circular)
   - C) It doesn't matter
   - D) Downward (presentation → facade → application → domain → data)

5. What is the recommended way to refactor a large legacy codebase to reactive?
   - A) A big-bang rewrite of everything at once
   - B) Never refactor; keep it as-is
   - C) Incrementally, behind facades — wrap legacy, migrate feature by feature
   - D) Move all logic into components

**Correct Answers:** 1-A, 2-C, 3-B, 4-D, 5-C

**Explanations:**
- Q1: Feature-based architecture co-locates everything a feature needs and exposes a small facade, improving cohesion and ownership.
- Q2: The facade is the feature's public API — read-only streams and intent methods — keeping store/API/operators sealed inside.
- Q3: RxJS is the better tool for async/time orchestration (debounce, HTTP, retry, cancellation); signals handle synchronous view state.
- Q4: Dependencies point downward; the data layer is swappable without affecting the layers above.
- Q5: Refactor incrementally behind facades — characterize with tests, extract layers, migrate feature by feature — never big-bang.

---

## Module Summary & Next Steps

You can now architect reactive apps at scale:
- Feature-based organization with a **facade** as each feature's public boundary
- RxJS + Signals hybrids: RxJS for async/time, signals for synchronous view state, bridged with `toSignal`/`toObservable`
- Layered design (Presentation → Facade → Application → Domain → Data) with business rules as domain operators
- Incremental, facade-driven refactoring of legacy code, and reactive state sharing across micro-frontends

**Next Module:** Module 18 – Performance (memory-leak prevention, `shareReplay` strategies, high-throughput optimization, and bundle size)

**Recommended Practice:** Split the project into per-layer modules, add a `toSignal`-style accessor, and wrap a piece of legacy code behind a new facade.

---

*Improved Module 17 v2.0 – Part of the RxJS Mastery Professional Course*

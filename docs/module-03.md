# Module 03: Pipe Composition

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

This module teaches you the **heart of RxJS power**: the `pipe()` method and operator composition. You will learn how to build clean, declarative, and highly reusable data transformation pipelines — the skill that separates beginners from professionals.

**Estimated Total Time:** 100–120 minutes  
**Difficulty:** Intermediate  
**Prerequisites:** Module 01 & 02 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Master the `pipe()` method and operator chaining
- Understand the difference between pure and impure operators
- Build complex transformation pipelines
- Refactor real-world code using clean pipe composition
- Create reusable, testable operator chains

---

## Lesson 3.1: The pipe() Method and Declarative Operator Chaining

**Estimated Time:** 18 minutes

### Why pipe() Matters
Before `pipe()`, operators were called as methods on the Observable. The `pipe()` method (introduced in RxJS 6) brings several major benefits:
- Better tree-shaking
- Cleaner code
- Easier to read and maintain
- Consistent with functional programming style

### Basic Syntax

```ts
source$.pipe(
  operator1(),
  operator2(),
  operator3()
).subscribe(observer);
```

Each operator takes the Observable produced by the one above it and returns a **new** Observable. Data flows top to bottom, exactly like reading a recipe.

### A Little History: `pipe` vs Method Chaining
RxJS 5 and earlier used "patched" prototype operators, so you wrote:

```ts
// Old (RxJS 5) — operators patched onto the Observable prototype
source$
  .map(x => x * 2)
  .filter(x => x > 10)
  .subscribe(observer);
```

This looked convenient but had a fatal flaw: importing `rxjs/add/operator/map` patched the **global** prototype, so bundlers could not tree-shake unused operators, and one library's imports could leak into another's. RxJS 6 replaced this with **pipeable operators** — plain functions you compose with `pipe()`:

```ts
// Modern (RxJS 6+) — pipeable operators
import { map, filter } from 'rxjs/operators';

source$.pipe(
  map(x => x * 2),
  filter(x => x > 10)
).subscribe(observer);
```

### Mental Model
> `pipe()` is function composition for streams. `source$.pipe(a, b, c)` is conceptually `c(b(a(source$)))` — but written in the order data actually flows.

### Key Concept
Operators are just **functions that take an Observable and return an Observable**. Because of that, you can store a chain in a variable and reuse it (more on this in Lesson 3.2).

### Common Mistake
**Forgetting that `pipe()` returns a new Observable and does nothing until subscribed.** Building a pipeline never executes it — no `subscribe()`, no work.

### Quick Exercise
Take `of(1, 2, 3, 4, 5)` and build a pipe that doubles each value and keeps only results greater than 4. Predict the output before running it.

**Key Takeaway:** `pipe()` is declarative function composition for Observables — readable, tree-shakeable, and reusable.

---

## Lesson 3.2: Pure vs Impure Operators – Writing Side-Effect-Free Code

**Estimated Time:** 20 minutes

### Why This Matters
The single biggest predictor of whether a reactive codebase stays maintainable is **purity**. Pure pipelines are predictable, testable, and safe to reuse. Impure ones hide bugs that only appear under specific timing or subscription patterns.

### What "Pure" Means
A **pure** transformation:
1. Returns the same output for the same input, every time
2. Causes **no side effects** (no DOM writes, no `console.log`, no mutating outside state, no HTTP calls)

`map`, `filter`, and `scan` are pure operators **when you give them pure functions**. They become impure the moment your callback reaches outside itself.

### Code Comparison

```ts
// ❌ IMPURE — side effect hidden inside map
source$.pipe(
  map(user => {
    console.log('Got user:', user);   // side effect!
    document.title = user.name;        // side effect!
    return user.name;
  })
).subscribe();

// ✅ PURE — map only transforms; side effects live in tap, at the edge
source$.pipe(
  tap(user => console.log('Got user:', user)), // side effects are explicit
  map(user => user.name),                       // pure transform
  tap(name => document.title = name)            // explicit side effect
).subscribe();
```

`tap()` exists **precisely** to hold side effects. It passes every value through unchanged, so it is the designated, honest place for logging, debugging, and DOM pokes.

### Reusable Operator Chains
Because pure operators are just functions, you can extract and reuse a chain:

```ts
import { pipe } from 'rxjs';
import { map, filter } from 'rxjs/operators';

// A reusable, testable, pure transformation
const onlyActiveNames = pipe(
  filter((u: User) => u.isActive),
  map(u => u.name)
);

users$.pipe(onlyActiveNames).subscribe(/* ... */);
```

### Common Mistakes
- **Hiding side effects in `map()`.** If a reader has to read the body of your `map` to discover it writes to the DOM, the pipeline lies about what it does. Use `tap()`.
- **Overusing `tap()`.** `tap` is for genuine side effects (logging, analytics). Using it to *mutate* values or build state is an anti-pattern — reach for `map`/`scan` instead.
- **Mutating the emitted object.** Returning a mutated input from `map` breaks purity and can corrupt other subscribers of a shared stream. Return a new object.

### Quick Exercise
Rewrite this impure pipeline to be pure, moving every side effect into `tap()`:
```ts
source$.pipe(
  map(n => { console.log(n); return n * 2; })
)
```

**Key Takeaway:** Keep `map`/`filter`/`scan` pure and push every side effect into `tap()` — your pipelines become testable and honest.

---

## Lesson 3.3: Transformation Operators – map, scan, tap (and pluck)

**Estimated Time:** 22 minutes

### Why This Matters
Transformation operators are how you reshape data as it flows. Master these four and you can express the vast majority of everyday stream logic.

### The Core Transformation Operators

| Operator | What it does | Pure? |
|----------|--------------|-------|
| `map`    | Transform each value with a function | Yes (with a pure fn) |
| `scan`   | Accumulate over time, emitting each intermediate result | Yes |
| `tap`    | Run a side effect; pass the value through unchanged | No (by design) |
| `pluck`  | Extract a nested property — **deprecated in RxJS 7+** | Yes |

### map

```text
source: --1--2--3--|
            map(x => x * 10)
output: --10--20--30--|
```

### scan — Accumulation Over Time
`scan` is `reduce` that **emits every step** instead of only the final value. You met it in Module 01's dashboard; here is the essence:

```text
source: --1--2--3--|
            scan((acc, n) => acc + n, 0)
output: --1--3--6--|
```

```ts
clicks$.pipe(
  scan(count => count + 1, 0)   // a running click counter
).subscribe(total => console.log('clicks:', total));
```

> This running-accumulator pattern is the seed of state management — we go much deeper in Module 10.

### tap — Debugging Without Disturbing the Stream
`tap` is your reactive `console.log`. It sees every notification and changes nothing:

```ts
source$.pipe(
  tap(v => console.log('before map:', v)),
  map(v => v * 2),
  tap(v => console.log('after map:', v))
).subscribe();
```

### A Note on `pluck`
`pluck('user', 'name')` used to extract `value.user.name`. It is **deprecated in RxJS 7** (slated for removal in v8) because it is not type-safe. Use `map` instead:

```ts
// ❌ Deprecated
source$.pipe(pluck('user', 'name'));

// ✅ Preferred — type-safe and explicit
source$.pipe(map(v => v.user?.name));
```

### Common Mistake
**Using `scan` when you only want the final value.** If you do not need intermediate emissions, `reduce` (emits once, on complete) is the right tool — but it never emits for infinite streams.

### Quick Exercise
Build a stream from `interval(1000)` that emits a running sum of all emitted values so far (`0, 1, 3, 6, 10, …`). Then add a `tap` that logs each step.

**Key Takeaway:** `map` transforms, `scan` accumulates and emits each step, `tap` observes without disturbing — and prefer `map` over the deprecated `pluck`.

---

## Lesson 3.4: Filtering & Utility Operators – filter, debounceTime, distinctUntilChanged, delay

**Estimated Time:** 22 minutes

### Why This Matters
Transformation reshapes values; **filtering and timing** operators control *which* values get through and *when*. They are what make reactive UIs feel fast and intelligent (think: search-as-you-type).

### The Operators

| Operator | What it does | Classic use |
|----------|--------------|-------------|
| `filter` | Let through only values that pass a predicate | Drop invalid input |
| `debounceTime` | Wait for a pause, then emit the **last** value | Search input, resize |
| `distinctUntilChanged` | Suppress consecutive duplicate values | Avoid redundant work |
| `delay` | Time-shift every emission by a fixed amount | Animations, retries |

### filter

```text
source: --1--2--3--4--|
            filter(x => x % 2 === 0)
output: -----2-----4--|
```

### debounceTime — Wait for Quiet
Emits a value only after the source has been **silent** for the specified time. Rapid bursts collapse to their last value:

```text
source: --a-b-c-------d--|
            debounceTime(t)
output: --------c-------d--|
```

This is why a search box waits until you stop typing before firing a request.

### distinctUntilChanged — Skip Repeats
Suppresses a value if it equals the **previous** emitted value:

```text
source: --a--a--b--b--a--|
            distinctUntilChanged()
output: --a-----b-----a--|
```

Note the final `a` is **kept** — it is not consecutive with the first `a`.

### The Search Combo
Together these three form the canonical search-input pipeline:

```ts
input$.pipe(
  map(e => e.target.value),
  filter(text => text.length >= 2),
  debounceTime(250),          // wait until the user pauses
  distinctUntilChanged()      // ignore "react" → "react" (no real change)
).subscribe(query => runSearch(query));
```

### Common Mistakes
- **`debounceTime` vs `throttleTime` confusion.** Debounce emits the *last* value after silence; throttle emits the *first* value then ignores others for a window. Search wants debounce; rate-limiting a button wants throttle.
- **`distinctUntilChanged` on objects.** It uses reference (`===`) equality by default, so two structurally-equal objects are "different." Pass a comparator: `distinctUntilChanged((a, b) => a.id === b.id)`.
- **Putting `debounceTime` after the expensive work.** Debounce belongs *before* the costly operation, so you skip the work entirely for intermediate values.

### Quick Exercise
Create a stream from a text input that logs the query only after the user stops typing for 300ms and only when the value actually changed. (You will build the full version in Lesson 3.5.)

**Key Takeaway:** `filter` chooses values, `debounceTime` waits for a pause, `distinctUntilChanged` drops repeats — together they make reactive input feel instant and efficient.

---

## Lesson 3.5: Project Workshop – Search Feature Refactoring: From Callback Hell to Clean Pipes

**Estimated Time:** 30 minutes

### Project Goal

Build a **live search box** that filters a list of RxJS operators as you type — first seeing why the imperative "callback hell" version is fragile, then refactoring it into one clean, declarative pipe:

- Capture keystrokes with `fromEvent`
- Trim and normalize input (`map`)
- Ignore too-short queries and react to clearing (`filter`)
- Wait for the user to pause typing (`debounceTime`)
- Skip redundant identical searches (`distinctUntilChanged`)
- Transform the query into results (`map`) and render them
- Keep the pipeline **pure**, with side effects isolated in `tap`/the subscriber

This project is the payoff for the whole module: every operator from Lessons 3.1–3.4 working together.

### The "Before": Callback Hell

Here is the imperative version most developers write first. It works — until it doesn't:

```ts
let debounceTimer;
let lastQuery = '';

searchInput.addEventListener('input', (e) => {
  const value = e.target.value.trim();

  clearTimeout(debounceTimer);             // manual debounce
  debounceTimer = setTimeout(() => {
    if (value.length < 2) return;          // manual length guard
    if (value === lastQuery) return;       // manual dedupe
    lastQuery = value;

    const results = search(value);         // do the work
    renderResults(value, results);         // mixed with DOM updates
  }, 250);
});
```

Problems: shared mutable state (`debounceTimer`, `lastQuery`), manual timer bookkeeping, guards tangled with business logic and DOM updates, and nothing is reusable or testable. **Each requirement we add makes it worse.**

### The "After": One Clean Pipe

Every imperative concern above becomes a single, named, declarative operator. This is the heart of the workshop.

### Why This Project Matters

The refactor is not about fewer lines — it is about **expressing intent**. `debounceTime(250)` says exactly what it means; a `setTimeout`/`clearTimeout` dance does not. Once you see the translation, you will reach for pipes instinctively.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; a search input and a results list.
2. **Capture input** — `fromEvent(input, 'input')` → `map` to the trimmed value.
3. **Guard** — `filter` to allow either an empty value (to reset) or length ≥ 2.
4. **Debounce & dedupe** — `debounceTime(250)` then `distinctUntilChanged()`.
5. **Transform** — `map` the query into `{ query, matches }` (pure).
6. **Render** — subscribe and update the DOM (the one side effect, at the edge).

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Operator Search • RxJS Pipe Composition</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
  <style>
    .result-item { transition: background-color 0.15s ease; }
    mark { background: #fde68a; color: #1c1917; border-radius: 3px; padding: 0 2px; }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-2xl mx-auto p-8">
    <div class="mb-6">
      <h1 class="text-3xl font-semibold tracking-tight">Operator Search</h1>
      <p class="text-zinc-400 mt-1">A clean, debounced search built with one RxJS pipe</p>
    </div>

    <!-- Search box -->
    <div class="relative mb-3">
      <input id="search" type="text" autocomplete="off"
             placeholder="Search RxJS operators (e.g. map, debounce)…"
             class="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-500 outline-none
                    rounded-xl px-4 py-3 text-lg placeholder-zinc-600">
      <span id="status"
            class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500"></span>
    </div>

    <!-- Results -->
    <ul id="results" class="space-y-2"></ul>
  </div>

  <script>
    const { fromEvent } = rxjs;
    const { map, filter, debounceTime, distinctUntilChanged, tap } = rxjs.operators;

    // A tiny dataset to search (name + description)
    const OPERATORS = [
      { name: 'map', desc: 'Transform each emitted value' },
      { name: 'filter', desc: 'Emit only values passing a predicate' },
      { name: 'scan', desc: 'Accumulate over time, emitting each step' },
      { name: 'tap', desc: 'Run a side effect without changing the value' },
      { name: 'debounceTime', desc: 'Emit the last value after a pause' },
      { name: 'distinctUntilChanged', desc: 'Skip consecutive duplicate values' },
      { name: 'delay', desc: 'Time-shift every emission' },
      { name: 'mergeMap', desc: 'Flatten by merging inner observables' },
      { name: 'switchMap', desc: 'Flatten by switching to the latest inner observable' },
      { name: 'concatMap', desc: 'Flatten inner observables in order' },
      { name: 'take', desc: 'Emit the first N values, then complete' },
      { name: 'takeUntil', desc: 'Emit until a notifier fires' },
      { name: 'combineLatest', desc: 'Combine the latest value from each source' },
      { name: 'catchError', desc: 'Gracefully handle an error in the stream' }
    ];

    const input = document.getElementById('search');
    const resultsEl = document.getElementById('results');
    const statusEl = document.getElementById('status');

    // Pure transform: query -> matching operators
    function search(query) {
      const q = query.toLowerCase();
      return OPERATORS.filter(
        op => op.name.toLowerCase().includes(q) || op.desc.toLowerCase().includes(q)
      );
    }

    // Side effect (at the edge): render to the DOM
    function renderResults(query, matches) {
      if (query === '') {
        resultsEl.innerHTML =
          `<li class="text-zinc-600 px-1">Start typing to search ${OPERATORS.length} operators…</li>`;
        statusEl.textContent = '';
        return;
      }
      statusEl.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}`;
      if (matches.length === 0) {
        resultsEl.innerHTML =
          `<li class="text-zinc-500 px-1">No operators match “${query}”.</li>`;
        return;
      }
      const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
      resultsEl.innerHTML = matches.map(op => `
        <li class="result-item bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-4 py-3">
          <code class="text-emerald-400 font-semibold">${op.name.replace(re, '<mark>$1</mark>')}</code>
          <span class="text-zinc-400"> — ${op.desc.replace(re, '<mark>$1</mark>')}</span>
        </li>`).join('');
    }

    // === The entire search feature: ONE declarative pipe ===
    fromEvent(input, 'input').pipe(
      map(e => e.target.value.trim()),       // normalize (pure)
      tap(() => statusEl.textContent = '…'),  // tiny side effect: "typing" hint
      filter(text => text.length === 0 || text.length >= 2), // guard (allow empty to reset)
      debounceTime(250),                      // wait for the user to pause
      distinctUntilChanged(),                 // ignore identical consecutive queries
      map(query => ({ query, matches: search(query) })) // pure transform to results
    ).subscribe(({ query, matches }) => {
      renderResults(query, matches);          // the one DOM side effect, at the edge
    });

    // Initial state
    renderResults('', []);

    // NOTE: In a real app (Angular/React), store this subscription and unsubscribe
    // on destroy (ngOnDestroy / useEffect cleanup) — see Module 02, Lesson 2.4.
  </script>
</body>
</html>
```

### Important Note on Async Search

Our `search()` runs synchronously over a local array, so a plain `map` is perfect. When the query triggers a **real HTTP request**, you would swap that last `map` for `switchMap` — which cancels the previous in-flight request when a new query arrives. That is a *higher-order* operator; we cover it thoroughly in **Module 04 (Domain Operators)** and **Module 05 (Combination)**.

### Key Lessons from This Project

- **Every imperative concern maps to one operator** — `setTimeout` → `debounceTime`, manual dedupe → `distinctUntilChanged`, guard clauses → `filter`.
- **Pure core, side effects at the edge** — the pipe transforms; the subscriber (and one tiny `tap`) touch the DOM.
- **The pipe is the spec** — reading the operator chain top-to-bottom describes the feature in plain language.
- **No shared mutable state** — the fragile `lastQuery`/`debounceTimer` variables are gone entirely.

### Stretch Goals (Recommended Practice)

1. Add a loading spinner using `tap` to show "searching…" and clear it in the subscriber.
2. Replace the local `search()` with a fake async one (return a `Promise`/`of(...).pipe(delay(...))`) and refactor to `switchMap` (preview of Module 04).
3. Add keyboard navigation (arrow keys) over the results using another `fromEvent` stream.
4. Highlight matches case-insensitively across multiple words.

### Deliverable

A working search feature that:
- Debounces and de-duplicates input declaratively
- Keeps its transformation pure
- Renders results with highlighted matches
- Reads, top to bottom, like a description of itself

**Key Takeaway:** You refactored tangled callback logic into a single, pure, declarative pipe — the defining skill of professional RxJS.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. Why did RxJS 6 move from prototype-patched operators to pipeable operators with `pipe()`?
   - A) Pipeable operators run faster at runtime
   - B) They enable tree-shaking and avoid polluting the global Observable prototype
   - C) Method chaining was removed from JavaScript
   - D) `pipe()` automatically subscribes for you

2. Which operator is the **correct** place to put a side effect like logging or a DOM update?
   - A) `map`
   - B) `filter`
   - C) `tap`
   - D) `scan`

3. What does `scan` emit compared to `reduce`?
   - A) Only the final accumulated value
   - B) Each intermediate accumulated value, as it goes
   - C) The same as `map`
   - D) Nothing until you unsubscribe

4. In a search-as-you-type input, which operator waits for the user to stop typing before emitting?
   - A) `distinctUntilChanged`
   - B) `filter`
   - C) `throttleTime`
   - D) `debounceTime`

5. In the Operator Search project, why is the final `map(query => ({ query, matches: search(query) }))` considered pure?
   - A) Because it uses `map` instead of `tap`
   - B) Because it returns a new value based only on its input and causes no side effects
   - C) Because it runs inside `debounceTime`
   - D) Because it mutates the input event

**Correct Answers:** 1-B, 2-C, 3-B, 4-D, 5-B

**Explanations:**
- Q1: Pipeable operators are plain functions, so bundlers can drop unused ones (tree-shaking) and no global prototype is patched.
- Q2: `tap` exists to hold side effects; it passes values through unchanged, keeping `map`/`filter` pure.
- Q3: `scan` emits every intermediate accumulation; `reduce` emits only the final value (on complete).
- Q4: `debounceTime` emits only after a pause in the source — exactly the search-input behavior.
- Q5: It derives its output solely from the input query and produces no side effects, so it is pure (the DOM update happens later, in the subscriber).

---

## Module Summary & Next Steps

You now command the **core composition skill** of RxJS:
- The `pipe()` method and why pipeable operators replaced prototype patching
- Pure vs impure operators, and isolating side effects in `tap`
- Transformation operators: `map`, `scan`, `tap` (and why `pluck` is deprecated)
- Filtering & timing operators: `filter`, `debounceTime`, `distinctUntilChanged`, `delay`
- Refactoring tangled callback code into a single declarative pipe

**Next Module:** Module 04 – Domain Operators (higher-order mapping with `mergeMap`, `switchMap`, `concatMap`, `exhaustMap`, plus building and testing custom operators)

**Recommended Practice:** Take a piece of imperative event-handling code from one of your own projects and refactor it into a single pipe. Name each operator's job before you write it.

---

*Improved Module 03 v2.0 – Part of the RxJS Mastery Professional Course*

# Module 05: Flattening Operators

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

This module focuses on one of the most important and commonly misunderstood topics in RxJS: **Higher-Order Observables** and **Flattening Operators**. Mastering these operators will allow you to handle complex asynchronous workflows (like nested API calls, search with suggestions, and real-time updates) elegantly and safely.

**Estimated Total Time:** 130–150 minutes  
**Difficulty:** Intermediate to Advanced  
**Prerequisites:** Modules 01–04 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Understand Higher-Order Observables
- Confidently choose between `switchMap`, `concatMap`, `mergeMap`, and `exhaustMap`
- Handle complex nested async operations
- Build real-world applications like GitHub Search with autocomplete
- Avoid common pitfalls that cause bugs and memory leaks

---

## Lesson 5.1: Higher-Order Observables Explained

**Estimated Time:** 22 minutes

### What is a Higher-Order Observable?
A Higher-Order Observable is an Observable that emits **other Observables**.

```ts
const higherOrder$ = source$.pipe(
  map(value => interval(1000))   // each value becomes an Observable
);
```

Subscribing to `higherOrder$` gives you... Observables, not values. That is rarely what you want.

### The Problem It Solves
The moment one async action depends on another (a click triggers an HTTP call; a keystroke triggers a search), you have a stream **of streams**. The naive fix is to subscribe inside a subscribe:

```ts
// ❌ The "nested subscribe" anti-pattern
search$.subscribe(term => {
  http.get('/api?q=' + term).subscribe(results => {
    render(results);   // leaks, races, impossible to cancel cleanly
  });
});
```

This leaks inner subscriptions, cannot cancel stale requests, and breaks composition.

### Flattening to the Rescue
A **flattening operator** subscribes to each inner Observable *for you* and emits its values on a single, flat output stream:

```ts
// ✅ Flattened — one stream, automatic inner subscription management
search$.pipe(
  switchMap(term => http.get('/api?q=' + term))
).subscribe(render);
```

### Mental Model
> `map` gives you an Observable *of Observables*. A flattening operator (`*Map`) **maps and merges in one step**, so you get an Observable *of values* again.

### Key Concept
There are four flatteners. They differ in exactly **one** decision: *what to do with the previous inner Observable when a new outer value arrives.* That single difference is the whole module.

### Common Mistake
**Using `map` when you meant a flattener.** If your projection returns an Observable (or Promise), you almost always want `switchMap`/`mergeMap`/`concatMap`/`exhaustMap`, not `map`.

### Quick Exercise
Take `fromEvent(button, 'click')` and, on each click, start `interval(500).pipe(take(3))`. Try it first with `map` (observe you get Observables), then with `mergeMap` (observe you get numbers).

**Key Takeaway:** A higher-order Observable emits Observables; a flattening operator subscribes to them for you and flattens the result back to values.

---

## Lesson 5.2: switchMap, concatMap, mergeMap, exhaustMap – Choosing the Right Flattener

**Estimated Time:** 26 minutes

All four diagrams below use the same input: the outer stream emits `a` then `b`, and **each** letter maps to an inner stream of three values (`a1 a2 a3` / `b1 b2 b3`). `b` arrives while `a`'s inner stream is still running — that overlap is what reveals the difference.

### mergeMap — Run Everything Concurrently
Subscribes to every inner Observable immediately and lets them all run in parallel. Values interleave.

```text
source:   --a--------b---------|
mergeMap:   --a1--a2--a3-b1--b2--b3|   (nothing is cancelled; all interleave)
```

### switchMap — Keep Only the Latest
When a new outer value arrives, it **unsubscribes** from the previous inner Observable and switches to the new one.

That unsubscription only aborts the underlying work if the inner source supports teardown (for example `ajax`/XHR or `fromFetch` with abort support). If the inner is a native Promise, the Promise continues running even though its result is ignored.

```text
source:    --a--------b---------|
switchMap:   --a1--a2----b1--b2--b3|   (a3 is cancelled when b arrives)
```

### concatMap — Queue and Preserve Order
Runs inner Observables **one at a time**, in order. A new inner waits until the current one completes.

```text
source:    --a--------b---------------|
concatMap:   --a1--a2--a3--b1--b2--b3|  (b's inner starts only after a's finishes)
```

### exhaustMap — Ignore While Busy
While an inner Observable is active, new outer values are **dropped**.

```text
source:     --a--------b---------|
exhaustMap:   --a1--a2--a3|          (b is ignored; a was still running)
```

### Comparison Table

| Operator     | Concurrent inners | When a new value arrives    | Classic use case |
|--------------|-------------------|-----------------------------|------------------|
| `switchMap`  | 1 (latest)        | **cancel** previous inner   | Type-ahead search |
| `mergeMap`   | many (or N)       | run **concurrently**        | Parallel independent requests |
| `concatMap`  | 1 (queued)        | **queue** until current done| Ordered writes / saves |
| `exhaustMap` | 1                 | **ignore** new until done   | Prevent double-submit |

### When to Use Which (Decision Tree)

```text
Do you only care about the LATEST result?
├─ Yes → switchMap            (search, autocomplete, "cancel the stale one")
└─ No, I need every result
   ├─ Must run IN ORDER?      → concatMap   (sequential saves, logs)
   ├─ Order doesn't matter,
   │  run in PARALLEL?        → mergeMap     (independent fetches; cap with concurrency)
   └─ IGNORE new triggers
      while one is running?   → exhaustMap   (submit button, login)
```

### Common Mistake
**Using `switchMap` for writes.** Cancelling an in-flight `POST`/`PUT` when a new value arrives can lose data or leave the server half-updated. Use `concatMap` (ordered) or `mergeMap` (parallel) for writes; reserve `switchMap` for reads where only the latest matters.

### Quick Exercise
For each scenario, name the operator: (a) live search box, (b) "save" button that must persist every click in order, (c) firing 50 independent analytics pings, (d) a login button that must ignore rapid double-clicks.

**Key Takeaway:** All four flatteners differ only in how they treat the previous inner Observable — cancel (`switchMap`), parallel (`mergeMap`), queue (`concatMap`), or ignore (`exhaustMap`).

---

## Lesson 5.3: Common Pitfalls and Performance Implications

**Estimated Time:** 22 minutes

### mergeMap Without a Limit
`mergeMap` has **unbounded** concurrency by default. Map 1,000 IDs to 1,000 HTTP calls and you fire 1,000 simultaneous requests — hammering the server and the browser's connection pool.

```ts
// ✅ Cap concurrency: at most 4 inner Observables active at once
ids$.pipe(
  mergeMap(id => http.get(`/api/item/${id}`), 4)   // 4 = max concurrency
).subscribe();
```

The optional second argument to `mergeMap` (and `concatMap` is just `mergeMap` with concurrency `1`) controls how many inner streams run at once.

### switchMap Cancels — That Can Be a Bug
For reads, cancellation is a feature. For writes, it is data loss. Never `switchMap` a save.

### concatMap Can Build a Backlog
If outer values arrive faster than inner Observables complete, `concatMap` queues them forever. Fine for bursts; dangerous for a firehose. Consider `mergeMap` with concurrency or dropping with `exhaustMap`.

### Inner Errors Kill the Outer Stream
An error in **any** inner Observable propagates to the output and terminates the whole stream — your search box dies after one failed request:

```ts
// ✅ Isolate failures: catchError INSIDE the flattener
search$.pipe(
  switchMap(q =>
    http.get('/api?q=' + q).pipe(
      catchError(() => of([]))   // inner recovers; outer keeps living
    )
  )
).subscribe(render);
```

> Placing `catchError` *outside* the `switchMap` would kill the entire search after the first error. Inside, only that one request fails.

### Don't Forget the Outer Subscription
Flatteners manage *inner* subscriptions, but the **outer** subscription is still yours to clean up (`takeUntil`, `take`, unsubscribe) — see Module 02.

### Common Mistake
**Nesting flatteners when you meant to chain them.** `switchMap(a => inner$.pipe(mergeMap(...)))` is sometimes right (nested HOO), but often you really wanted a single flattener. Be deliberate about each level.

### Quick Exercise
Rewrite an unbounded `mergeMap(id => fetchItem(id))` over 100 IDs to cap concurrency at 5, and add a per-item `catchError` so one failure doesn't sink the batch.

**Key Takeaway:** Cap `mergeMap` concurrency, never `switchMap` writes, recover inner errors *inside* the flattener, and still clean up the outer subscription.

---

## Lesson 5.4: Real-World Flattening Patterns (HTTP + User Input)

**Estimated Time:** 22 minutes

### Pattern 1 — Type-ahead Search (switchMap)
The canonical pattern: debounce input, drop duplicates, cancel stale requests.

```ts
input$.pipe(
  map(e => e.target.value.trim()),
  debounceTime(400),
  distinctUntilChanged(),
  switchMap(q =>
    ajax.getJSON(`/api/search?q=${q}`).pipe(
      catchError(() => of({ items: [] }))
    )
  )
).subscribe(render);
```

### Pattern 2 — Sequential Writes (concatMap)
Persist every change, in order, without overlap:

```ts
saves$.pipe(
  concatMap(payload => http.put('/api/doc', payload))
).subscribe();
```

### Pattern 3 — Parallel Fetch with a Cap (mergeMap)
Fetch many independent resources, but politely:

```ts
ids$.pipe(
  mergeMap(id => http.get(`/api/item/${id}`), 4)
).subscribe();
```

### Pattern 4 — Double-Submit Guard (exhaustMap)
Ignore extra clicks until the in-flight request finishes:

```ts
submitClicks$.pipe(
  exhaustMap(() => http.post('/api/login', form))
).subscribe();
```

### Pattern 5 — Combining Flatteners (Nested Higher-Order)
Real features often nest: switch to the latest search, then fetch details for each result **in parallel** with a cap:

```ts
query$.pipe(
  debounceTime(300),
  switchMap(q =>
    searchUsers(q).pipe(                       // outer: only the latest query
      mergeMap(user =>                          // inner: enrich each in parallel
        getProfile(user.id).pipe(map(p => ({ ...user, ...p }))),
        5                                        // ...capped at 5 concurrent
      ),
      toArray()                                  // collect enriched results
    )
  )
).subscribe(render);
```

This is the heart of "intelligent flattening": the outer `switchMap` guarantees only the latest search survives, while the inner `mergeMap` parallelizes enrichment.

### Common Mistake
**Debouncing in the wrong place.** Put `debounceTime`/`distinctUntilChanged` *before* the `switchMap`, so you skip work entirely for intermediate keystrokes — not after, where the request has already started.

### Quick Exercise
Sketch the pipeline for "autocomplete that, for the latest query, fetches the top 3 results' thumbnails in parallel." Which operator is outer? Which is inner?

**Key Takeaway:** Match the operator to the intent — `switchMap` for latest-only reads, `concatMap` for ordered writes, `mergeMap` (capped) for parallel work, `exhaustMap` for guarded actions — and nest them for compound features.

---

## Lesson 5.5: Project Workshop – GitHub Search App with Intelligent Flattening

**Estimated Time:** 30 minutes

### Project Goal

Build a **live GitHub user search** that calls the **real GitHub API** and demonstrates why `switchMap` is the right flattener for type-ahead:

- Debounce keystrokes and drop duplicate queries
- `switchMap` so a new query **cancels** the previous in-flight request (no race conditions, no stale results)
- Handle every UI state: **idle**, **loading**, **results**, **empty**, and **error** (including the GitHub rate limit)
- Keep failures isolated with `catchError` *inside* the `switchMap`

### Why This Project Matters

This is the textbook case for flattening. Type fast and you will *see* `switchMap` cancel obsolete requests — the results never flicker to a stale query. Swap it for `mergeMap` and you would get out-of-order results; `concatMap` would lag behind your typing. `switchMap` is correct, and you will feel why.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN (the UMD bundle includes `rxjs.ajax`).
2. **Capture input** — `fromEvent` → `map` to the trimmed value → `debounceTime(400)` → `distinctUntilChanged()`.
3. **Flatten with switchMap** — short queries short-circuit to an idle state; real queries call `ajax.getJSON`.
4. **States** — `startWith` a loading marker; `catchError` to an error state; map the response to a results/empty state.
5. **Render** — the one side effect, at the edge.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub Search • RxJS switchMap</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-2xl mx-auto p-8">
    <div class="mb-6">
      <h1 class="text-3xl font-semibold tracking-tight">GitHub User Search</h1>
      <p class="text-zinc-400 mt-1">Type-ahead powered by <code class="text-emerald-400">switchMap</code></p>
    </div>

    <input id="search" type="text" autocomplete="off"
           placeholder="Search GitHub users (e.g. hansschenker)…"
           class="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-500 outline-none
                  rounded-xl px-4 py-3 text-lg placeholder-zinc-600 mb-2">
    <div id="status" class="text-xs text-zinc-500 mb-4 h-4"></div>

    <ul id="results" class="space-y-2"></ul>
  </div>

  <script>
    const { fromEvent, of } = rxjs;
    const { map, debounceTime, distinctUntilChanged, switchMap, catchError, startWith } = rxjs.operators;
    const { ajax } = rxjs.ajax;   // ajax is bundled in the RxJS 7 UMD build

    const input = document.getElementById('search');
    const resultsEl = document.getElementById('results');
    const statusEl = document.getElementById('status');

    function render(view) {
      switch (view.state) {
        case 'idle':
          statusEl.textContent = '';
          resultsEl.innerHTML = `<li class="text-zinc-600 px-1">Type at least 2 characters to search…</li>`;
          return;
        case 'loading':
          statusEl.textContent = `Searching for “${view.query}”…`;
          resultsEl.innerHTML = `<li class="text-zinc-500 px-1 animate-pulse">Loading…</li>`;
          return;
        case 'error':
          statusEl.textContent = '';
          resultsEl.innerHTML = `<li class="text-red-400 px-1">${view.message}</li>`;
          return;
        case 'done':
          statusEl.textContent = `${view.items.length} result${view.items.length === 1 ? '' : 's'} for “${view.query}”`;
          if (view.items.length === 0) {
            resultsEl.innerHTML = `<li class="text-zinc-500 px-1">No users found for “${view.query}”.</li>`;
            return;
          }
          resultsEl.innerHTML = view.items.map(u => `
            <li>
              <a href="${u.html_url}" target="_blank" rel="noopener"
                 class="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-emerald-600
                        rounded-xl px-4 py-2 transition-colors">
                <img src="${u.avatar_url}" alt="" class="w-10 h-10 rounded-full bg-zinc-800">
                <span class="font-medium text-zinc-100">${u.login}</span>
                <span class="ml-auto text-xs text-zinc-500">View profile →</span>
              </a>
            </li>`).join('');
          return;
      }
    }

    // === The entire search feature: ONE pipe with intelligent flattening ===
    fromEvent(input, 'input').pipe(
      map(e => e.target.value.trim()),
      debounceTime(400),               // wait for a pause in typing
      distinctUntilChanged(),          // ignore identical consecutive queries
      switchMap(query => {
        if (query.length < 2) {
          return of({ state: 'idle' });                  // short-circuit, no request
        }
        const url = `https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=8`;
        return ajax.getJSON(url).pipe(
          map(res => ({ state: 'done', items: res.items, query })),
          startWith({ state: 'loading', query }),        // show loading immediately
          catchError(err => of({                          // inner recovery keeps the stream alive
            state: 'error',
            message: err && err.status === 403
              ? 'GitHub rate limit reached — wait a minute and try again.'
              : 'Search request failed. Please try again.'
          }))
        );
      })
    ).subscribe(render);

    // Initial state
    render({ state: 'idle' });

    // NOTE: in a framework, store this subscription and unsubscribe on destroy (Module 02).
  </script>
</body>
</html>
```

### How the States Flow

```text
type "ha" → loading → done (results)
type more quickly → switchMap CANCELS the "ha" request → loading "han" → done
clear box → idle
rate limited → error
```

### Key Lessons from This Project

- **`switchMap` is the correct flattener for search** — each keystroke cancels the stale request, so results always match the latest query.
- **`catchError` belongs inside `switchMap`** — a failed request becomes an error *state*, not a dead stream.
- **`startWith` gives instant feedback** — the loading state appears the moment a request begins.
- **Every UI state is modelled as data** — `{ state: 'idle' | 'loading' | 'done' | 'error' }` keeps `render` a pure function of the latest emission.

### Stretch Goals (Recommended Practice)

1. Add a per-user enrichment step: `mergeMap` (capped at 5) to fetch each user's repo count, then `toArray()` (nested flattening from Lesson 5.4).
2. Add a spinner and disable the input while loading.
3. Cache results per query with a `Map` or `shareReplay` strategy so re-typing an old query is instant (preview of Module 18's sharing/performance patterns).
4. Swap `switchMap` for `mergeMap` and `concatMap` and observe how the results misbehave — then switch back.

### Deliverable

A working GitHub user search that calls the real API, cancels stale requests with `switchMap`, and renders idle/loading/results/empty/error states from a single pipe.

**Key Takeaway:** You built a real type-ahead search where `switchMap` cancels obsolete requests and `catchError` isolates failures — the defining pattern of professional async RxJS.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What is a higher-order Observable?
   - A) An Observable that emits very large numbers
   - B) An Observable whose emitted values are themselves Observables
   - C) An Observable created with `of()`
   - D) An Observable that has been piped more than once

2. Which flattening operator **cancels** the previous inner Observable when a new outer value arrives?
   - A) `switchMap`
   - B) `mergeMap`
   - C) `concatMap`
   - D) `exhaustMap`

3. You must send several writes that each must complete **in order**, with no overlap. Which operator fits?
   - A) `switchMap`
   - B) `mergeMap`
   - C) `concatMap`
   - D) `exhaustMap`

4. Which operator **ignores** new outer emissions while an inner Observable is still active (ideal for preventing double form submissions)?
   - A) `switchMap`
   - B) `mergeMap`
   - C) `concatMap`
   - D) `exhaustMap`

5. In a `switchMap` type-ahead search, where should `catchError` go so a single failed request does not kill the whole search?
   - A) It is not needed; `switchMap` handles errors
   - B) Inside the `switchMap`, on the inner request Observable
   - C) Outside the `switchMap`, on the outer stream
   - D) In the `subscribe` error callback

**Correct Answers:** 1-B, 2-A, 3-C, 4-D, 5-B

**Explanations:**
- Q1: A higher-order Observable emits Observables; a flattening operator subscribes to those inner Observables and flattens the output back to values.
- Q2: `switchMap` unsubscribes from the previous inner Observable and switches to the newest — perfect for cancelling stale requests.
- Q3: `concatMap` queues inner Observables and runs them one at a time, preserving order (it is `mergeMap` with concurrency 1).
- Q4: `exhaustMap` drops new outer values until the active inner Observable completes, guarding against double-submits.
- Q5: Placing `catchError` *inside* the `switchMap` recovers a single failed request; outside, the first error would terminate the entire search stream.

---

## Module Summary & Next Steps

You now command higher-order Observables and the four flatteners:
- What a higher-order Observable is, and why nested `subscribe` is an anti-pattern
- `switchMap` (cancel), `mergeMap` (parallel), `concatMap` (queue), `exhaustMap` (ignore) — and how to choose
- Pitfalls: unbounded `mergeMap` concurrency, `switchMap` on writes, inner errors, outer cleanup
- Real-world patterns including nested flattening, and a real GitHub search with full state handling

**Next Module:** Module 06 – Custom Flattening (priority routing, custom flattening behavior, and backpressure-aware task queues)

**Recommended Practice:** Extend the GitHub search with the nested-flattening stretch goal (enrich each user in parallel with capped `mergeMap`), and try all four flatteners to feel the difference.

---

*Improved Module 05 v2.0 – Part of the RxJS Mastery Professional Course*

# Module 18: Performance

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

Performance optimization is critical for production reactive applications. This module teaches you how to identify and fix memory leaks, use `shareReplay` effectively, optimize high-throughput streams, and build applications that remain fast and responsive even under heavy load. These techniques are essential for building scalable, production-grade reactive systems.

**Estimated Total Time:** 115–135 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Modules 09, 13 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Identify and prevent memory leaks in RxJS
- Use `shareReplay` strategically for multicasting
- Optimize high-throughput data streams
- Reduce bundle size through tree-shaking
- Build high-performance reactive applications

---

## Lesson 18.1: Memory Leak Identification and Prevention

**Estimated Time:** 22 minutes

### The #1 Cause: Forgotten Subscriptions
A subscription to an infinite stream (interval, `fromEvent`, websocket) that is never torn down keeps its closure — and the component, DOM nodes, and data it references — alive forever.

```ts
// ❌ Leak: an infinite subscription with no teardown
ngOnInit() {
  interval(1000).subscribe(t => this.tick = t); // lives past the component
}
```

### The Fixes (recap + ranking)
| Technique | When |
|-----------|------|
| `takeUntil(destroy$)` | many subscriptions in a component (most common) |
| `take(n)` / `first()` | you only need a known number |
| Composite `Subscription` | group + tear down together |
| `async` pipe (Angular) | let the framework subscribe/unsubscribe |
| `takeUntilDestroyed()` | Angular 16+ idiomatic |

```ts
// ✅ Managed
private destroy$ = new Subject<void>();
ngOnInit() { interval(1000).pipe(takeUntil(this.destroy$)).subscribe(/* ... */); }
ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
```

### How to Spot a Leak
- **DevTools → Memory → heap snapshots**: take one, exercise the feature, take another; growing detached DOM / retained closures signals a leak.
- **A live subscription counter** (you'll build one): if "active subscriptions" only ever grows, you're leaking.
- **Listeners**: `getEventListeners()` / a climbing listener count on a node.

### Common Mistake
**"It works, so it's fine."** Leaks don't break functionality — they degrade the app over time (memory growth, slowdowns, eventually crashes). They're invisible until profiled. Make teardown a habit, not an afterthought.

### Quick Exercise
Subscribe to `interval(100)` in a loop 50 times without unsubscribing; watch memory/handle counts climb. Then add `take(1)` and confirm they don't.

**Key Takeaway:** The top leak is an un-torn-down infinite subscription; prevent it with `takeUntil`/`take`/composite `Subscription`/`async` pipe, and detect it with heap snapshots or a live subscription counter.

---

## Lesson 18.2: shareReplay Strategies and Multicasting

**Estimated Time:** 22 minutes

### Cold Streams Re-Execute Per Subscriber
A cold Observable runs its producer **once per subscription**. Three components subscribing to the same HTTP Observable = **three** requests.

```text
http$ (cold): subscriber A ─► request
              subscriber B ─► request   (duplicate!)
              subscriber C ─► request   (duplicate!)
```

### Multicast with shareReplay(1)
`shareReplay(1)` runs the source **once**, caches the last value, and replays it to every subscriber (including late ones):

```ts
const config$ = this.http.get('/config').pipe(shareReplay(1)); // ONE request, shared
```

### The refCount Footgun
By default (`shareReplay({ bufferSize: 1, refCount: false })`), the source stays subscribed **forever** even after all subscribers leave — itself a leak for infinite sources. Use `refCount: true` to tear down when the last subscriber unsubscribes:

```ts
interval(1000).pipe(shareReplay({ bufferSize: 1, refCount: true }));
```

> Rule of thumb: `shareReplay(1)` (no refCount) is fine for **finite** sources (an HTTP response). For **infinite** shared sources, use `refCount: true` so they stop when unused.

### share() vs shareReplay()
- `share()` — multicast, **no replay**; late subscribers miss past values. Good for hot events.
- `shareReplay(n)` — multicast **with replay** of the last `n`. Good for "current value" / config.

### Common Mistake
**`shareReplay(1)` on an infinite stream without `refCount`.** The interval/websocket keeps running after everyone unsubscribes. Add `refCount: true` for infinite sources.

### Quick Exercise
Make a cold `defer(() => { console.log('exec'); return of(Date.now()); })`, subscribe 3×, count the "exec" logs. Add `shareReplay(1)` and recount.

**Key Takeaway:** `shareReplay(1)` multicasts a single execution and replays the latest to all subscribers — perfect for HTTP/config; add `refCount: true` for infinite sources to avoid a lingering subscription.

---

## Lesson 18.3: Optimizing High-Throughput Streams

**Estimated Time:** 20 minutes

### Reduce Work Per Emission
- **Filter early** — drop irrelevant values before expensive operators (`filter` before `map`/`switchMap`).
- **`distinctUntilChanged`** — skip redundant identical values (and downstream work).
- **Conflate** — `auditTime`/`sampleTime` for "latest only" UIs (Module 13).

### Don't Block the Main Thread
- Batch/yield with `observeOn(asyncScheduler)` so the browser can paint (Module 09).
- Animate with `animationFrameScheduler`, not `setInterval` (Module 09).
- For truly heavy compute, offload to a **Web Worker** and bridge results back as a stream.

### Avoid Re-Creating Pipelines
Build a pipeline once and reuse it. Re-creating Observables/operators on every change (e.g. in a render loop) churns allocations and re-subscribes.

### Selectors & Memoization
Derive expensive view data with `map` + `distinctUntilChanged` so it only recomputes when inputs change — not on every unrelated emission (Module 10's selector pattern).

### Common Mistake
**Heavy work in a hot path with no conflation.** Rendering or computing on every value of a 1000/sec feed destroys the frame budget. Conflate for display, compute incrementally, and offload heavy work.

### Quick Exercise
Take a fast `interval(10)`; add `filter` + `distinctUntilChanged` + `sampleTime(250)` and measure how much downstream work you eliminated.

**Key Takeaway:** Optimize throughput by filtering early, skipping duplicates, conflating for display, keeping the main thread free (`observeOn`/workers), and reusing pipelines.

---

## Lesson 18.4: Bundle Size, Tree-Shaking, and Lazy Loading Operators

**Estimated Time:** 18 minutes

### Import Granularly
RxJS 7 is tree-shakeable **if you import correctly**. Import named operators from `rxjs`; bundlers drop what you don't use.

```ts
// ✅ Tree-shakeable — only these operators ship
import { map, filter } from 'rxjs';
import { of } from 'rxjs';

// ❌ Avoid namespace imports — can defeat tree-shaking
import * as rxjs from 'rxjs';
```

> Note: RxJS 7 unified imports — operators come from `'rxjs'` (the older `'rxjs/operators'` path still works). Either way, prefer **named** imports.

### Measure Your Bundle
- Use a bundle analyzer (`source-map-explorer`, `rollup-plugin-visualizer`, webpack-bundle-analyzer) to see exactly how much RxJS you ship.
- The whole point of pipeable operators (Module 03) was tree-shaking — named imports realize it.

### Lazy Loading
Load feature code (and its operators) only when needed via dynamic `import()` / route-level code splitting. The RxJS a feature uses ships in that feature's chunk, not the main bundle.

### Keep Operator Libraries Lean
For your own libraries (Module 16): `sideEffects: false` + per-operator files so consumers tree-shake unused operators.

### Common Mistake
**`import * as Rx from 'rxjs'`.** A namespace import can pull the whole library into the bundle. Use named imports so unused operators are dropped.

### Quick Exercise
Run a bundle analyzer on a small app; switch any namespace RxJS import to named imports and compare the RxJS bytes shipped.

**Key Takeaway:** Use named imports from `rxjs` (never namespace imports), measure with a bundle analyzer, lazy-load feature operators via code splitting, and ship libraries with `sideEffects: false`.

---

## Lesson 18.5: Project Workshop – Full App Performance Optimization & Audit

**Estimated Time:** 30 minutes

### Project Goal

Build a **performance audit panel** that *measures* the two biggest RxJS performance issues, before vs after:

- A **subscription leak** demo: a live "active subscriptions" gauge that grows when leaking and stays bounded when managed with `takeUntil`
- A **multicasting** demo: an "executions" counter showing a cold source running 3× vs `shareReplay(1)` running once
- Live, measurable numbers — the "audit" you'd run on a real app

### Why This Project Matters

Performance is invisible until measured. This panel turns the abstract ("leaks are bad", "shareReplay multicasts") into **numbers you watch change** — exactly how you'd profile and prove an optimization in production.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; two audit panels with live gauges.
2. **Instrument** — a `track()` helper using `tap({subscribe})` + `finalize` to count active subscriptions.
3. **Leak vs managed** — leaky subscriptions (no teardown) vs `takeUntil(destroy$)`; a cleanup button.
4. **Cold vs shareReplay** — a `defer` source counting executions; subscribe 3× each way.
5. **Render** — update gauges on every change.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Audit • RxJS</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-3xl mx-auto p-8 space-y-6">
    <h1 class="text-3xl font-semibold tracking-tight">Performance Audit</h1>

    <!-- Leak panel -->
    <div class="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold">Subscription Leaks</h2>
        <div class="text-right"><div class="text-[10px] uppercase text-zinc-500">Active subscriptions</div>
          <div id="activeSubs" class="text-3xl font-bold tabular-nums text-amber-400">0</div></div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button id="addLeaky" class="bg-red-600/80 hover:bg-red-500 text-white rounded-lg px-3 py-2 text-sm">Add leaky subscriber</button>
        <button id="addManaged" class="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-2 text-sm">Add managed (takeUntil)</button>
        <button id="cleanup" class="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">Cleanup managed</button>
      </div>
      <p class="text-xs text-zinc-500 mt-2">Leaky subs keep climbing forever; managed subs drop to zero on cleanup.</p>
    </div>

    <!-- Multicast panel -->
    <div class="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold">Multicasting</h2>
        <div class="text-right"><div class="text-[10px] uppercase text-zinc-500">Source executions</div>
          <div id="execs" class="text-3xl font-bold tabular-nums text-sky-400">0</div></div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button id="cold" class="bg-red-600/80 hover:bg-red-500 text-white rounded-lg px-3 py-2 text-sm">Subscribe ×3 (cold)</button>
        <button id="shared" class="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-2 text-sm">Subscribe ×3 (shareReplay)</button>
        <button id="resetExec" class="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">Reset</button>
      </div>
      <p class="text-xs text-zinc-500 mt-2">Cold runs the source 3×; shareReplay(1) runs it once and replays to all.</p>
    </div>
  </div>

  <script>
    const { interval, Subject, defer, of, timer } = rxjs;
    const { tap, finalize, takeUntil, map, shareReplay } = rxjs.operators;

    let activeSubs = 0, execs = 0;
    const render = () => {
      document.getElementById('activeSubs').textContent = activeSubs;
      document.getElementById('execs').textContent = execs;
    };

    // Instrument any observable to count active subscriptions
    const track = obs => obs.pipe(
      tap({ subscribe: () => { activeSubs++; render(); } }),
      finalize(() => { activeSubs--; render(); })
    );

    // ===== Leak demo =====
    const destroy$ = new Subject();
    document.getElementById('addLeaky').addEventListener('click', () => {
      track(interval(1000)).subscribe();                 // no teardown, reference lost → leak
    });
    document.getElementById('addManaged').addEventListener('click', () => {
      track(interval(1000)).pipe(takeUntil(destroy$)).subscribe();  // torn down on cleanup
    });
    document.getElementById('cleanup').addEventListener('click', () => {
      destroy$.next();                                   // completes all managed subs → activeSubs drops
    });

    // ===== Multicast demo =====
    const coldSource = () => defer(() => { execs++; render(); return timer(200).pipe(map(() => 'data')); });
    document.getElementById('cold').addEventListener('click', () => {
      const s = coldSource();                            // cold: each subscribe re-executes
      s.subscribe(); s.subscribe(); s.subscribe();       // → execs += 3
    });
    document.getElementById('shared').addEventListener('click', () => {
      const s = coldSource().pipe(shareReplay(1));       // multicast
      s.subscribe(); s.subscribe(); s.subscribe();       // → execs += 1
    });
    document.getElementById('resetExec').addEventListener('click', () => { execs = 0; render(); });

    render();
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **Leaks are measurable** — the active-subscription gauge climbs forever for leaky subs and drops to zero for managed ones on cleanup.
- **`shareReplay(1)` is measurable** — "executions" jumps by 3 for a cold source but by 1 when shared.
- **`track()` instruments any stream** — `tap({subscribe})` + `finalize` is a reusable subscription profiler.
- **Numbers, not vibes** — every optimization in this module produces a metric you can watch move.

### Stretch Goals (Recommended Practice)

1. Add `refCount: true` to the shareReplay demo and a button to unsubscribe; confirm executions stop (Lesson 18.2).
2. Add a throughput panel: a fast feed rendered raw vs `sampleTime` with a renders/sec gauge (Module 13).
3. Add a "leak fix" toggle that converts leaky subscribers to `take(5)` and watch the gauge stabilize.
4. Wire real `performance.memory` (Chrome) into a memory readout.

### Deliverable

A performance audit panel that measures subscription leaks (active-sub gauge: leaky vs managed) and multicasting (executions: cold ×3 vs shareReplay ×1) with live, comparable numbers.

**Key Takeaway:** You built a performance audit that *measures* the two biggest RxJS issues — subscription leaks and duplicate executions — turning optimization into numbers you can prove.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What is the most common cause of memory leaks in RxJS?
   - A) An infinite subscription that is never torn down
   - B) Using `map` too often
   - C) Importing from `rxjs`
   - D) Using `BehaviorSubject`

2. What does `shareReplay(1)` do for a cold HTTP Observable with three subscribers?
   - A) Runs the request three times
   - B) Cancels the request
   - C) Runs the request once and replays the result to all three
   - D) Makes the request synchronous

3. When should you use `shareReplay({ bufferSize: 1, refCount: true })` instead of plain `shareReplay(1)`?
   - A) Never
   - B) For finite HTTP responses
   - C) Only in tests
   - D) For infinite sources, so the subscription tears down when no one is listening

4. Which import style preserves tree-shaking?
   - A) `import * as rxjs from 'rxjs'`
   - B) Named imports: `import { map, filter } from 'rxjs'`
   - C) `require('rxjs')`
   - D) A `<script>` tag

5. In the audit project, how is a subscription leak made visible?
   - A) The console throws an error
   - B) An "active subscriptions" gauge keeps climbing for leaky subs but drops to zero for managed ones
   - C) The page reloads
   - D) `shareReplay` reports it

**Correct Answers:** 1-A, 2-C, 3-D, 4-B, 5-B

**Explanations:**
- Q1: An un-torn-down infinite subscription retains its closure (component, DOM, data) forever — the classic leak.
- Q2: `shareReplay(1)` multicasts a single execution and replays the cached result, so one request serves all subscribers.
- Q3: `refCount: true` tears the source down when the last subscriber leaves — essential for infinite shared sources to avoid a lingering subscription.
- Q4: Named imports let bundlers drop unused operators; namespace imports can pull in the whole library.
- Q5: The live active-subscription gauge climbs for leaks and falls to zero for managed subscriptions on cleanup — a measurable signal.

---

## Module Summary & Next Steps

You can now make reactive apps fast and prove it:
- Preventing leaks with `takeUntil`/`take`/composite `Subscription`/`async` pipe, and detecting them with heap snapshots / a live gauge
- `shareReplay(1)` multicasting (and the `refCount` footgun for infinite sources); `share` vs `shareReplay`
- High-throughput optimization: filter early, dedupe, conflate, keep the main thread free
- Bundle size: named imports, tree-shaking, lazy loading, lean operator libraries

**Next Module:** Module 19 – Testing (marble testing with `TestScheduler`, unit testing operators/effects/state, and integration strategies)

**Recommended Practice:** Add a `refCount` toggle and a throughput gauge to the audit panel, then run a bundle analyzer on one of your apps.

---

*Improved Module 18 v2.0 – Part of the RxJS Mastery Professional Course*

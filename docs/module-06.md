# Module 06: Custom Flattening

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

This advanced module teaches you how to go beyond the basic flattening operators and create **intelligent, backpressure-aware flattening strategies**. This is the level where you start building truly production-grade reactive systems that can handle high-frequency data, complex workflows, and resource constraints elegantly.

**Estimated Total Time:** 120–140 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Module 05 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Design intelligent flattening strategies
- Implement backpressure-aware operators
- Create custom flattening operators
- Build complex task management systems with controlled concurrency
- Optimize performance in high-load scenarios

---

## Lesson 6.1: Intelligent Flattening Strategies

**Estimated Time:** 22 minutes

### Beyond the Basic Four
While `switchMap`, `mergeMap`, `concatMap`, and `exhaustMap` cover most cases, real-world applications often require **hybrid or conditional flattening** logic — choosing behavior per item, or routing by priority.

### Example: Smart Flattening Based on Priority
Note the dependency (`process`) is passed in, never `this` — keeping the logic portable (Module 04):

```ts
import { mergeMap } from 'rxjs/operators';

// Route each item to a different inner Observable, with a global concurrency cap.
const smartFlatten = (process: (item: Task) => Observable<Result>) =>
  mergeMap((item: Task) => process(item), 3);
```

> `mergeMap`'s concurrency argument is a number, not a function. Passing a function in the second position enters the deprecated result-selector overload. For *per-item* routing, branch **inside** the projection instead:

```ts
source$.pipe(
  mergeMap(item =>
    item.priority === 'high'
      ? processHighPriority(item)   // e.g. its own retry/timeout policy
      : processLowPriority(item),
    3                                // global concurrency cap
  )
);
```

### Mental Model
> The basic four are *policies* for "what to do with the previous inner." Intelligent flattening means **picking the policy per item**, or wrapping a flattener with extra rules (priority, dedupe, caching).

### Key Concept
Most "custom" flattening is still built **on top of** `mergeMap`/`concatMap` — you rarely write a raw operator. You compose: branch in the projection, cap concurrency, and add error boundaries (Lesson 6.4).

### Common Mistake
**Reaching for a hand-written operator first.** 9 times out of 10, conditional logic inside the projection plus a concurrency cap expresses what you need. Save raw operators for genuinely novel behavior (Lesson 6.3).

### Quick Exercise
Write a projection that sends `priority: 'high'` files to a stricter processing path and all others to a capped-parallel path. If you split the source with `partition`, note that `merge(high$, low$)` lets both lanes run concurrently; use `concat(highLane$, lowLane$)` only if low-priority work must wait until all high-priority work is finished.

**Key Takeaway:** Intelligent flattening = choosing the right policy per item, usually by branching inside the projection and capping concurrency — not by writing raw operators.

---

## Lesson 6.2: Backpressure-Aware Flattening Techniques

**Estimated Time:** 24 minutes

### What Is Backpressure?
**Backpressure** is what happens when a producer emits faster than a consumer can process. A firehose of events (mouse moves, sensor data, websocket ticks) can overwhelm slow work (rendering, HTTP). You need a strategy to cope.

### Two Families of Strategy

**Lossless** — keep every value, control the *rate of work*:

| Technique | Operator | Effect |
|-----------|----------|--------|
| Bounded concurrency | `mergeMap(fn, n)` | At most `n` inner streams at once; the rest queue |
| Strict ordering | `concatMap` | One at a time, queued (can build a backlog) |

**Lossy** — drop values you cannot keep up with:

| Technique | Operator | Keeps |
|-----------|----------|-------|
| Drop while busy | `exhaustMap` | The in-flight one; ignore new |
| Latest only | `switchMap` / `audit` / `auditTime` | The newest |
| Sample periodically | `sampleTime` / `throttleTime` | One per window |
| Pause-then-latest | `debounceTime` | The value after a quiet gap |

### Visualizing a Lossy Strategy (sampleTime)

```text
source:     -a-b-c-d-e-f-g-h-|
                sampleTime(t)
output:     ----c----e----g--|   (one value per time window; rest dropped)
```

### exhaustMap vs Controlled mergeMap
A key production decision:

- **`exhaustMap`** — drop new triggers while one is processing. Best when duplicates are *meaningless* (a "refresh" button: one refresh in flight is enough).
- **`mergeMap(fn, n)`** — keep everything but cap parallelism. Best when every item *matters* but you must protect the server/CPU (process an upload queue, 3 at a time).

> Rule of thumb: **`exhaustMap` when extra triggers are noise; controlled `mergeMap` when every item is real work you must not lose.**

### Measuring & Optimizing Concurrency
Concurrency is a tuning knob, not a guess:
- Too low → underutilized, slow throughput.
- Too high → server 429s, memory spikes, and transport/browser concurrency limits (the exact per-host limit varies by protocol and browser).
- Measure: time a fixed batch at concurrency 1, 2, 4, 8; plot throughput; pick the knee of the curve. The project in Lesson 6.5 lets you *see* this.

### Common Mistake
**Defaulting to unbounded `mergeMap` under load.** It "works" in dev with 10 items and melts in prod with 10,000. Always cap concurrency for work that scales with data.

### Quick Exercise
A sensor emits 100 readings/second but your chart can repaint ~60 times/second. Which operator keeps the UI smooth without a growing backlog — `concatMap`, `sampleTime`, or `mergeMap`? Why?

**Key Takeaway:** Match the strategy to the data — lossless (bounded `mergeMap`/`concatMap`) when every value matters, lossy (`exhaustMap`/`sampleTime`/`switchMap`) when only some do.

---

## Lesson 6.3: Building Custom Flattening Operators

**Estimated Time:** 22 minutes

### Level 1 — Compose with Existing Operators (Preferred)
A "custom flattener" is usually just a named pipe. Here is `priorityFlatten`: high-priority items are processed in order, while low-priority items run in parallel. Because the two lanes are merged, they may run at the same time.

```ts
import { pipe, partition, merge, Observable } from 'rxjs';
import { mergeMap, concatMap } from 'rxjs/operators';

export function priorityFlatten<T, R>(
  isHigh: (item: T) => boolean,
  project: (item: T) => Observable<R>,
  lowConcurrency = 3
) {
  return (source: Observable<T>): Observable<R> => {
    const [high$, low$] = partition(source, isHigh);
    return merge(
      high$.pipe(concatMap(project)),         // high: strictly ordered, one at a time
      low$.pipe(mergeMap(project, lowConcurrency)) // low: parallel, capped
    );
  };
}
```

### Level 2 — Build from `*All` Operators
`mergeMap(fn)` is literally `map(fn)` + `mergeAll()`. Knowing this lets you assemble flatteners:

```ts
import { map, mergeAll, concatAll } from 'rxjs/operators';

// mergeMap(project) ≡
source$.pipe(map(project), mergeAll());

// concatMap(project) ≡
source$.pipe(map(project), concatAll());

// mergeAll also takes a concurrency limit:
source$.pipe(map(project), mergeAll(4)); // ≡ mergeMap(project, 4)
```

### Level 3 — A Raw Flattening Operator (Rare)
When no composition fits, drop to `new Observable`. You must manage inner subscriptions **and** teardown yourself:

```ts
import { Observable, OperatorFunction, Subscription } from 'rxjs';

// A minimal mergeAll-style flattener (no concurrency cap, for illustration).
export function flattenAll<T>(): OperatorFunction<Observable<T>, T> {
  return (source: Observable<Observable<T>>) =>
    new Observable<T>(subscriber => {
      const inners = new Subscription();
      let outerDone = false;
      let active = 0;

      const outer = source.subscribe({
        next: inner$ => {
          active++;
          inners.add(inner$.subscribe({
            next: v => subscriber.next(v),
            error: e => subscriber.error(e),
            complete: () => {
              active--;
              if (outerDone && active === 0) subscriber.complete();
            }
          }));
        },
        error: e => subscriber.error(e),
        complete: () => {
          outerDone = true;
          if (active === 0) subscriber.complete();
        }
      });

      return () => { outer.unsubscribe(); inners.unsubscribe(); }; // teardown
    });
}
```

> This is essentially a hand-rolled `mergeAll`. In real code, **use the built-in** — but understanding this is what makes the built-ins stop being magic.

### Common Mistake
**Forgetting completion bookkeeping in a raw flattener.** The output must complete only when the outer *and* all inners have completed (the `outerDone && active === 0` check). Miss it and your stream never completes.

### Quick Exercise
Implement `priorityFlatten` from Level 1 and test it: feed a source of high/low tasks and assert that high-priority results preserve order while low-priority work respects the concurrency cap. Then try replacing `merge(...)` with `concat(...)` and observe how that changes the priority guarantee.

**Key Takeaway:** Build custom flatteners by composition first (`partition`/`merge`, `map` + `mergeAll`); reach for a raw `Observable` only rarely, and always handle inner subscriptions, errors, and completion.

---

## Lesson 6.4: Combining Flattening with Error Boundaries

**Estimated Time:** 20 minutes

### Isolate Failures at the Inner Level
As in Module 05: an inner error normally kills the whole stream. For a queue of independent tasks, one failure must not cancel the rest. Wrap each inner with its own boundary:

```ts
tasks$.pipe(
  mergeMap(task =>
    runTask(task).pipe(
      retry({ count: 2, delay: 500 }),       // give each task a couple of tries
      catchError(err => of({ task, failed: true, err }))  // then isolate the failure
    ),
    3
  )
).subscribe(updateUI);
```

Each task gets its own retry-then-fallback boundary, so the queue keeps draining even if some tasks fail.

### Fallback Observables
`catchError` can return a *fallback stream*, not just a value — e.g. serve cached data when the network fails:

```ts
fetchFresh(id).pipe(
  catchError(() => fetchFromCache(id))   // seamless degradation
);
```

### Boundary Placement
```text
outer:  ──task1──task2──task3──►
              │      │      │
        each inner has: retry → catchError   (a per-task error boundary)
        outer stream survives any single task's failure
```

### Common Mistake
**One boundary around the whole pipeline.** A single outer `catchError` turns the first failure into a dead stream. Boundaries belong on the **inner** Observable, one per unit of work.

### Quick Exercise
Add to the snippet above a `timeout(4000)` on each task so a hung task fails (and is then caught) instead of stalling its concurrency slot forever.

**Key Takeaway:** Put retry + `catchError` (and `timeout`) on each *inner* Observable so failures are isolated per task and the overall flow keeps running.

---

## Lesson 6.5: Project Workshop – Task Management App with Advanced Flattening

**Estimated Time:** 30 minutes

### Project Goal

Build a **task runner** that processes a batch of asynchronous tasks with **controlled concurrency**, visualizing the queue in real time:

- Submit a batch of N tasks, each simulating async work of random duration
- Process them with a **concurrency cap** you control with a slider (`mergeMap(fn, n)`)
- Watch each task move **queued → running → done**, live
- See real-time statistics (queued / running / done counts, progress, elapsed time)
- Feel how higher concurrency changes throughput

### Why This Project Matters

This makes backpressure tangible. Set concurrency to 1 and tasks crawl through one at a time; set it to 5 and they swarm. You are *seeing* `mergeMap`'s concurrency argument govern a live queue — the core skill of this module.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; a task grid and a stats bar.
2. **Build the batch** — N task descriptors, all starting as `queued`.
3. **Simulate work** — `runTask` returns `defer(() => timer(duration))` so the "running" state is set only when `mergeMap` actually gives the task a slot.
4. **Control concurrency** — `from(tasks).pipe(mergeMap(runTask, concurrency))`.
5. **Render** — update the grid and stats on every state change.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Runner • RxJS Controlled Concurrency</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
  <style>
    .task { transition: background-color 0.2s ease, border-color 0.2s ease; }
    .running { animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-3xl mx-auto p-8">
    <div class="mb-6">
      <h1 class="text-3xl font-semibold tracking-tight">Task Runner</h1>
      <p class="text-zinc-400 mt-1">Controlled concurrency with <code class="text-emerald-400">mergeMap(fn, n)</code></p>
    </div>

    <!-- Controls -->
    <div class="flex flex-wrap items-center gap-4 mb-6">
      <button id="run"
              class="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 rounded-xl
                     disabled:opacity-50 disabled:cursor-not-allowed">
        Run Batch
      </button>
      <label class="flex items-center gap-2 text-sm text-zinc-400">
        Tasks
        <input id="count" type="number" min="1" max="40" value="12"
               class="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-200">
      </label>
      <label class="flex items-center gap-2 text-sm text-zinc-400">
        Concurrency <span id="concVal" class="text-zinc-200 font-mono">2</span>
        <input id="conc" type="range" min="1" max="6" value="2">
      </label>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-3 mb-6">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Queued</div>
        <div id="sQueued" class="text-2xl font-semibold mt-1 text-zinc-300">0</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Running</div>
        <div id="sRunning" class="text-2xl font-semibold mt-1 text-amber-400">0</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Done</div>
        <div id="sDone" class="text-2xl font-semibold mt-1 text-emerald-400">0</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Elapsed</div>
        <div id="sElapsed" class="text-2xl font-semibold mt-1 text-sky-400 tabular-nums">0.0s</div>
      </div>
    </div>

    <!-- Task grid -->
    <div id="grid" class="grid grid-cols-6 sm:grid-cols-8 gap-2"></div>
  </div>

  <script>
    const { from, timer, defer, interval } = rxjs;
    const { mergeMap, map, tap, finalize, takeUntil } = rxjs.operators;
    const { Subject } = rxjs;

    const runBtn = document.getElementById('run');
    const countInput = document.getElementById('count');
    const concInput = document.getElementById('conc');
    const concVal = document.getElementById('concVal');
    const gridEl = document.getElementById('grid');
    const sQueued = document.getElementById('sQueued');
    const sRunning = document.getElementById('sRunning');
    const sDone = document.getElementById('sDone');
    const sElapsed = document.getElementById('sElapsed');

    concInput.addEventListener('input', () => concVal.textContent = concInput.value);

    let tasks = [];
    let startTime = 0;

    function buildTasks(n) {
      tasks = Array.from({ length: n }, (_, i) => ({
        id: i + 1,
        status: 'queued',
        duration: 600 + Math.round(Math.random() * 2000)
      }));
    }

    function renderGrid() {
      gridEl.innerHTML = tasks.map(t => {
        const style = t.status === 'queued'
          ? 'bg-zinc-900 border-zinc-700 text-zinc-500'
          : t.status === 'running'
            ? 'bg-amber-500/20 border-amber-500 text-amber-300 running'
            : 'bg-emerald-500/20 border-emerald-500 text-emerald-300';
        return `<div class="task ${style} border rounded-lg h-12 flex items-center justify-center
                            text-sm font-medium tabular-nums">${t.id}</div>`;
      }).join('');
    }

    function renderStats() {
      sQueued.textContent  = tasks.filter(t => t.status === 'queued').length;
      sRunning.textContent = tasks.filter(t => t.status === 'running').length;
      sDone.textContent    = tasks.filter(t => t.status === 'done').length;
    }

    function renderAll() { renderGrid(); renderStats(); }

    // defer => the projection runs (and "running" is set) only when mergeMap grants a slot.
    function runTask(task) {
      return defer(() => {
        task.status = 'running';
        renderAll();
        return timer(task.duration).pipe(
          tap(() => { task.status = 'done'; renderAll(); }),
          map(() => task)
        );
      });
    }

    runBtn.addEventListener('click', () => {
      const n = Math.max(1, Math.min(40, Number(countInput.value) || 12));
      const concurrency = Number(concInput.value);
      buildTasks(n);
      renderAll();

      runBtn.disabled = true;
      startTime = Date.now();
      const stop$ = new Subject();

      // Live elapsed-time ticker (stops when the batch finishes).
      interval(100).pipe(takeUntil(stop$)).subscribe(() => {
        sElapsed.textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
      });

      // The core: process the batch with a concurrency cap.
      from(tasks).pipe(
        mergeMap(task => runTask(task), concurrency),
        finalize(() => {
          stop$.next();              // stop the elapsed ticker
          stop$.complete();
          runBtn.disabled = false;
        })
      ).subscribe();
    });

    // Initial render
    buildTasks(Number(countInput.value));
    renderAll();
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **`mergeMap`'s second argument *is* the queue** — it runs `concurrency` inners and buffers the rest until slots free up.
- **`defer` makes "running" honest** — the status flips when work actually starts, not when the task is enqueued.
- **State as data, render at the edge** — task objects hold status; `renderAll` reflects them; the stream stays pure.
- **`finalize` is the reliable teardown hook** — it fires on complete *or* error, perfect for stopping the elapsed ticker and re-enabling the button.

### Stretch Goals (Recommended Practice)

1. Add a "fail rate" slider and give each task a chance to error; wrap `runTask` with `retry` + `catchError` (Lesson 6.4) and show a red "failed" state.
2. Add a throughput readout (tasks/second) and chart it across concurrency 1→6 to find the knee (Lesson 6.2).
3. Swap `mergeMap` for `concatMap` and `exhaustMap` and watch the grid behave differently.
4. Make it a live queue: add an "Add Task" button feeding a `Subject`, and keep a long-lived `mergeMap` subscription.

### Deliverable

A working task runner that processes a batch with adjustable concurrency, visualizes queued/running/done live, and reports stats and elapsed time.

**Key Takeaway:** You built a live, concurrency-controlled task queue — turning `mergeMap(fn, n)` and `defer` into a visible, tunable backpressure strategy.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What is "backpressure" in a reactive system?
   - A) When a producer emits faster than the consumer can process
   - B) A way to compress Observable payloads
   - C) An error thrown when a stream completes
   - D) The pressure to add more operators

2. Which choice is a **lossless** backpressure strategy (keeps every value)?
   - A) `sampleTime`
   - B) `switchMap`
   - C) `mergeMap` with a concurrency limit
   - D) `exhaustMap`

3. When should you prefer `exhaustMap` over a controlled `mergeMap`?
   - A) When every emitted item is real work you must not lose
   - B) When you need results in strict order
   - C) When you want unlimited concurrency
   - D) When extra triggers are noise and one in-flight operation is enough

4. `mergeMap(project)` is equivalent to which composition?
   - A) `map(project)` + `concatAll()`
   - B) `map(project)` + `switchAll()`
   - C) `map(project)` + `mergeAll()`
   - D) `filter(project)` + `mergeAll()`

5. In the Task Runner project, why is each task wrapped in `defer(() => timer(...))` instead of just `timer(...)`?
   - A) `defer` makes the timer run faster
   - B) So the "running" state is set only when `mergeMap` actually grants the task a concurrency slot
   - C) Because `timer` cannot be used inside `mergeMap`
   - D) To avoid importing `timer`

**Correct Answers:** 1-A, 2-C, 3-D, 4-C, 5-B

**Explanations:**
- Q1: Backpressure is the mismatch where production outpaces consumption; you handle it with lossless or lossy strategies.
- Q2: A concurrency-limited `mergeMap` queues excess work without dropping it; `sampleTime`/`switchMap`/`exhaustMap` are all lossy.
- Q3: `exhaustMap` ignores new triggers while busy — ideal when duplicates are noise (e.g. a refresh button), not when every item matters.
- Q4: `mergeMap(project)` is exactly `map(project)` followed by `mergeAll()`; `concatMap` is `map` + `concatAll`.
- Q5: `defer` delays the projection until subscription, so a task is marked "running" only when `mergeMap` opens a slot for it — keeping the queue visualization accurate.

---

## Module Summary & Next Steps

You can now flatten like a systems engineer:
- Intelligent strategies: per-item routing and policy selection on top of the basic flatteners
- Backpressure awareness: lossless (`mergeMap(n)`, `concatMap`) vs lossy (`exhaustMap`, `sampleTime`, `switchMap`), and how to measure concurrency
- Custom flatteners by composition (`partition`/`merge`, `map` + `mergeAll`) and, rarely, raw Observables
- Per-task error boundaries (retry + `catchError` + `timeout`) so one failure never sinks the queue

**Next Module:** Module 07 – Error Handling (error boundaries, recovery patterns with `catchError`/`retry`/`retryWhen`, and designing a global error-handling system)

**Recommended Practice:** Extend the Task Runner with a fail-rate slider and per-task retry/`catchError`, then chart throughput across concurrency levels to find the optimum.

---

*Improved Module 06 v2.0 – Part of the RxJS Mastery Professional Course*

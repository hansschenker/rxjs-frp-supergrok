# Module 14: Window & Buffer

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

This module teaches you two powerful time-based operators: **`buffer`** and **`window`**. These operators allow you to collect emissions over time or based on other Observables, enabling powerful patterns like batching analytics events, implementing rate limiting, and building time-aware data processing pipelines.

**Estimated Total Time:** 105–125 minutes  
**Difficulty:** Intermediate to Advanced  
**Prerequisites:** Modules 05, 13 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Understand the difference between `buffer` and `window`
- Use time-based, count-based, and notifier-based buffering
- Implement analytics batching and rate limiting
- Build time-aware reactive systems
- Choose the right operator for different use cases

---

## Lesson 14.1: Buffer vs Window Philosophy

**Estimated Time:** 20 minutes

### The Core Difference

- **`buffer`**: Collects values into **arrays** — you get `T[]` per boundary.
- **`window`**: Collects values into **Observables** — you get `Observable<T>` per boundary (a higher-order Observable).

### Visual Comparison

```text
source:        --1--2--3--4--5--6--|
                 bufferCount(3)
buffer output: --------[1,2,3]------[4,5,6]|   (arrays)

                 windowCount(3)
window output: w1:(--1--2--3|)  w2:(--4--5--6|)   (each w is its own Observable)
```

### When to Use Which
- **`buffer`** when you want the **whole batch at once** (send these 50 events together, render this chunk).
- **`window`** when you want to **apply operators per group** — e.g. count, sum, or debounce *within* each window, then flatten the results.

```ts
// buffer: process the array
clicks$.pipe(bufferCount(10)).subscribe(tenClicks => send(tenClicks));

// window: reduce within each window, then flatten (Module 05)
import { count, mergeMap } from 'rxjs/operators';

clicks$.pipe(
  windowTime(1000),
  mergeMap(win$ => win$.pipe(count()))   // clicks-per-second
).subscribe(perSecond => console.log(perSecond));
```

### Mental Model
> `buffer*` hands you a **completed array**; `window*` hands you a **live Observable** you can pipe. Anything `buffer` does, `window` can do followed by `toArray()` — but `window` also lets you stream-process each group.

### The Boundary Variants
Both families take the same kinds of boundaries:

| Boundary | buffer | window |
|----------|--------|--------|
| Time | `bufferTime(ms)` | `windowTime(ms)` |
| Count | `bufferCount(n)` | `windowCount(n)` |
| Another Observable | `buffer(notifier$)` | `window(notifier$)` |
| Open/close pairs | `bufferToggle` | `windowToggle` |
| Dynamic close | `bufferWhen(fn)` | `windowWhen(fn)` |

### Common Mistake
**Forgetting `window` is higher-order.** Subscribing to a `windowTime` stream gives you *Observables*, not values — you must flatten (`mergeMap`/`concatMap`) each window. If you just want arrays, use `buffer`.

### Quick Exercise
Use `bufferCount(3)` on `of(1,2,3,4,5,6,7)` and log the arrays. What happens to the leftover `7`? (It emits as a partial `[7]` on complete.)

**Key Takeaway:** `buffer*` collects into arrays; `window*` collects into Observables for per-group stream processing — same boundary options, different output shape.

---

## Lesson 14.2: Temporal Reasoning with Time-Based Windows

**Estimated Time:** 22 minutes

### Fixed Time Windows
`bufferTime(ms)` emits an array every `ms` — perfect for steady batching:

```text
source:  --1-2-3-----4-5------6--|
              bufferTime(t)
output:  ------[1,2,3]----[4,5]----[6]|
```

> Note `bufferTime` emits **even empty arrays** on idle windows — usually filter them: `filter(b => b.length > 0)`.

### Time + Count (whichever first)
`bufferTime` takes an optional `maxBufferSize` — flush on **time OR size**, ideal for "send every 2s, but immediately if 50 pile up":

```ts
events$.pipe(
  bufferTime(2000, null, 50),       // timespan, creationInterval, maxBufferSize
  filter(b => b.length > 0)
).subscribe(send);
```

### Sliding / Overlapping Windows
A second argument (`bufferCreationInterval`) creates **overlapping** windows — useful for moving averages:

```ts
readings$.pipe(bufferTime(5000, 1000)); // a 5s window, started every 1s (overlaps)
```

### Session Windows (Inactivity-Based)
Close a batch after a period of **quiet** — group bursts of activity. Use a debounced notifier as the boundary:

```text
events:  --a-b-c---------d-e-----|
         close 300ms after the last event
batches: ----------[a,b,c]--------[d,e]|
```

```ts
buffer(events$.pipe(debounceTime(300)))   // flush when the source goes quiet for 300ms
```

### Rate Limiting via Windows
`windowTime`/`bufferTime` underpin rate limiting: "at most N operations per second" → window per second, take N per window:

```ts
requests$.pipe(
  windowTime(1000),
  mergeMap(win$ => win$.pipe(take(5)))   // max 5 per second
).subscribe(process);
```

### Common Mistake
**Not handling empty `bufferTime` windows.** On an idle source, `bufferTime` keeps emitting `[]`. Filter them, or you'll "send" empty batches every interval.

### Quick Exercise
Build a session-window batcher: `buffer(source$.pipe(debounceTime(500)))` and confirm a batch only emits after the source is quiet for 500ms.

**Key Takeaway:** Time windows enable batching (`bufferTime`), time-or-count flush (`maxBufferSize`), overlapping moving windows, session windows (debounced notifier), and rate limiting (window + `take`).

---

## Lesson 14.3: Batching Analytics Data Efficiently

**Estimated Time:** 20 minutes

### Why Batch?
Sending one network request per event is wasteful — connection overhead, rate limits, battery. Batching collects many events and sends them in **one** request, cutting network calls dramatically.

```text
50 events  ──bufferTime(2000)──►  ~1 request every 2s  (instead of 50 requests)
```

### A Robust Analytics Batcher
Flush on **time or size**, drop empties, and never lose the tail:

```ts
const flush$ = analyticsEvents$.pipe(
  bufferTime(5000, null, 20),         // every 5s OR when 20 events pile up
  filter(batch => batch.length > 0)
);

flush$.pipe(
  concatMap(batch => http.post('/analytics', batch))  // ordered, one request at a time
).subscribe();
```

### Don't Lose Events on Unload
A pure timer can lose the final partial batch when the user leaves. Flush on `beforeunload` too (often via `navigator.sendBeacon`), and consider `bufferToggle`/manual flush for "send now" moments.

### Idempotency & Retries
Batched sends should be **idempotent** (include a batch id) so a retry (Module 08) doesn't double-count. Pair batching with backoff retry for resilience.

### Performance Considerations
- **Network calls saved** ≈ `eventsBatched / batchesSent` — the whole point; track it.
- **Memory** — a buffer holds events until flush. Cap with `maxBufferSize` so a burst can't grow it unbounded.
- **Latency vs efficiency** — bigger windows = fewer requests but staler data. Tune the timespan to your needs.

### Common Mistake
**Unbounded buffers.** A pure `bufferTime` with no `maxBufferSize` can accumulate a huge array during a burst. Always cap size for high-volume events.

### Quick Exercise
Write an analytics batcher that flushes every 3s or at 10 events, drops empty batches, and posts with `concatMap`. Add a batch id to each payload.

**Key Takeaway:** Batch analytics with `bufferTime(span, null, maxSize)` + non-empty filter + `concatMap` send; make sends idempotent, flush on unload, and cap buffer size.

---

## Lesson 14.4: Combining Window/Buffer with Other Operators

**Estimated Time:** 22 minutes

### Per-Window Aggregation (window + reduce)
The classic `window` use: compute a statistic per time window.

```ts
import { mergeMap, reduce } from 'rxjs/operators';

clicks$.pipe(
  windowTime(1000),
  mergeMap(win$ => win$.pipe(
    reduce((acc, _) => acc + 1, 0)   // count per window
  ))
).subscribe(perSecond => render(perSecond));
```

### Buffer + map/filter
Transform or filter batches before sending:

```ts
events$.pipe(
  bufferTime(2000),
  filter(b => b.length > 0),
  map(b => ({ count: b.length, types: summarize(b), batch: b }))
).subscribe(send);
```

### Dynamic Windows with bufferToggle
Open and close buffers on signals — e.g. record only between "start" and "stop":

```ts
source$.pipe(
  bufferToggle(starts$, () => stops$)   // collect from each start until its stop
).subscribe(recorded);
```

### Combining with Backpressure (Module 13)
Buffering *is* a backpressure tool — it converts a high-frequency stream into a low-frequency stream of batches, which a slow consumer can handle. Combine with `concatMap` (ordered, one batch at a time) so the consumer is never overwhelmed.

### Common Mistake
**Flattening windows with the wrong operator.** Use `mergeMap` for independent windows, `concatMap` when window results must stay ordered. `switchMap` would *cancel* the previous window mid-aggregation — almost never what you want for windowing.

### Quick Exercise
Compute a moving "events per 2 seconds" metric with `windowTime(2000)` + `mergeMap(w => w.pipe(count()))`, and render each value.

**Key Takeaway:** `window` + `reduce`/`count` aggregates per group; `buffer` + `map`/`filter` shapes batches; use `bufferToggle` for signal-driven windows and `concatMap` (not `switchMap`) to flatten in order.

---

## Lesson 14.5: Project Workshop – Analytics Batching Dashboard

**Estimated Time:** 30 minutes

### Project Goal

Build an **analytics batching dashboard** that collects events and flushes them efficiently, with a selectable strategy:

- Generate events (auto-fire + a manual "Track Event" button)
- Batch with a selectable strategy: **time** (`bufferTime`), **count** (`bufferCount`), or **smart** (time *or* count)
- "Send" each batch (logged), with empty batches filtered out
- Live metrics: events tracked, batches sent, avg batch size, and **network calls saved**
- A batch log showing each flush (size + event-type breakdown)

### Why This Project Matters

This is real analytics infrastructure in miniature. You will *see* batching collapse dozens of events into a handful of "requests," and the "calls saved" metric quantifies the win — the reason every analytics SDK batches.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; controls, metrics, and a batch log.
2. **Event source** — `merge` a manual `Subject` with a toggleable auto-feed; `share()` it.
3. **Strategy** — `bufferTime` / `bufferCount` / `bufferTime(span, null, max)`, filtered to non-empty.
4. **Send** — pass each batch through a fake async endpoint with `concatMap`; update metrics when it completes.
5. **Switch** — `switchMap` over the strategy selector to swap batchers live.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Batching • RxJS buffer</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-2xl mx-auto p-8">
    <h1 class="text-3xl font-semibold tracking-tight mb-1">Analytics Batching</h1>
    <p class="text-zinc-400 mb-6">Collect events, flush in batches with <code class="text-emerald-400">buffer</code></p>

    <!-- Controls -->
    <div class="flex flex-wrap items-center gap-4 mb-6">
      <button id="track" class="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-5 rounded-xl">Track Event</button>
      <label class="flex items-center gap-2 text-sm text-zinc-400"><input id="auto" type="checkbox"> Auto-fire</label>
      <label class="flex items-center gap-2 text-sm text-zinc-400 ml-auto">
        Strategy
        <select id="strategy" class="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200">
          <option value="time">bufferTime(3000)</option>
          <option value="count">bufferCount(5)</option>
          <option value="smart" selected>smart: 3s or 5 events</option>
        </select>
      </label>
    </div>

    <!-- Metrics -->
    <div class="grid grid-cols-4 gap-3 mb-6 text-center">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><div class="text-[10px] uppercase text-zinc-500">Events</div><div id="mEvents" class="text-2xl font-semibold">0</div></div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><div class="text-[10px] uppercase text-zinc-500">Batches</div><div id="mBatches" class="text-2xl font-semibold text-sky-400">0</div></div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><div class="text-[10px] uppercase text-zinc-500">Avg size</div><div id="mAvg" class="text-2xl font-semibold text-amber-400">0</div></div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><div class="text-[10px] uppercase text-zinc-500">Calls saved</div><div id="mSaved" class="text-2xl font-semibold text-emerald-400">0</div></div>
    </div>

    <div class="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Sent Batches</div>
    <div id="log" class="h-56 overflow-auto space-y-2 font-mono text-xs"></div>
  </div>

  <script>
    const { interval, merge, Subject, EMPTY, of } = rxjs;
    const { map, bufferTime, bufferCount, filter, share, switchMap, startWith, concatMap, delay, tap } = rxjs.operators;

    const TYPES = ['click', 'view', 'scroll', 'hover', 'purchase'];
    const randomEvent = () => ({ type: TYPES[Math.floor(Math.random() * TYPES.length)], ts: Date.now() });

    let eventsTracked = 0, batchesSent = 0, totalBatched = 0;

    // --- Event source: manual + toggleable auto, shared ---
    const manual$ = new Subject();
    const autoToggle$ = new Subject();
    const auto$ = autoToggle$.pipe(
      startWith(false),
      switchMap(on => on ? interval(600) : EMPTY)
    );
    const events$ = merge(manual$, auto$).pipe(map(() => randomEvent()), share());

    // Count every event (separate cheap subscriber)
    events$.subscribe(() => { eventsTracked++; renderMetrics(); });

    // --- Batching strategy ---
    function applyStrategy(strat) {
      switch (strat) {
        case 'time':  return events$.pipe(bufferTime(3000));
        case 'count': return events$.pipe(bufferCount(5));
        case 'smart': return events$.pipe(bufferTime(3000, null, 5)); // time OR 5 events
      }
    }

    const strategy$ = new Subject();
    const postBatch = batch => of(batch).pipe(delay(250));

    strategy$.pipe(
      startWith('smart'),
      switchMap(strat => applyStrategy(strat).pipe(filter(b => b.length > 0))),
      concatMap(batch => postBatch(batch).pipe(tap(sendBatch)))
    ).subscribe();

    // --- "Send" a batch (logged) ---
    const logEl = document.getElementById('log');
    function sendBatch(batch) {
      batchesSent++;
      totalBatched += batch.length;
      const counts = batch.reduce((m, e) => (m[e.type] = (m[e.type] || 0) + 1, m), {});
      const summary = Object.entries(counts).map(([t, n]) => `${t}×${n}`).join('  ');
      const row = document.createElement('div');
      row.className = 'bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2';
      row.innerHTML = `<span class="text-sky-400">POST /analytics</span>
                       <span class="text-zinc-500">(${batch.length} events)</span>
                       <div class="text-zinc-400 mt-0.5">${summary}</div>`;
      logEl.prepend(row);
      renderMetrics();
    }

    function renderMetrics() {
      document.getElementById('mEvents').textContent = eventsTracked;
      document.getElementById('mBatches').textContent = batchesSent;
      document.getElementById('mAvg').textContent = batchesSent ? (totalBatched / batchesSent).toFixed(1) : '0';
      document.getElementById('mSaved').textContent = Math.max(0, totalBatched - batchesSent);
    }

    // --- Wiring ---
    document.getElementById('track').addEventListener('click', () => manual$.next());
    document.getElementById('auto').addEventListener('change', e => autoToggle$.next(e.target.checked));
    document.getElementById('strategy').addEventListener('change', e => strategy$.next(e.target.value));
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **`buffer*` turns N events into one batch** — the "calls saved" metric (`totalBatched − batchesSent`) is the payoff.
- **Smart flush = time OR count** — `bufferTime(span, null, maxSize)` flushes whichever comes first, balancing latency and efficiency.
- **Always drop empty batches** — `bufferTime` emits `[]` on idle windows; `filter(b => b.length > 0)` keeps you from "sending nothing."
- **`concatMap` sends batches in order** — a new batch waits until the previous fake request completes.
- **`switchMap` swaps strategies live** — the shared `events$` keeps counting while the batcher re-subscribes.

### Stretch Goals (Recommended Practice)

1. Add a **session window** strategy: `buffer(events$.pipe(debounceTime(800)))` — flush after the user goes idle.
2. Send batches with `concatMap` to a fake async endpoint (with `delay`) and show in-flight state.
3. Add a `beforeunload` flush so the final partial batch isn't lost.
4. Add a **window**-based "events per 2s" live chart (`windowTime` + `count`).

### Deliverable

An analytics batcher that collects events, flushes via a selectable strategy (time / count / smart), drops empties, and reports events, batches, average size, and network calls saved.

**Key Takeaway:** You built an analytics batcher that collapses many events into few requests with `buffer` — quantifying the savings and balancing latency against efficiency, the core of every analytics SDK.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What is the fundamental difference between `buffer` and `window`?
   - A) `buffer` emits arrays of values; `window` emits Observables of values
   - B) `buffer` is faster than `window`
   - C) `window` only works with time; `buffer` only with count
   - D) There is no difference

2. `bufferTime(2000, null, 50)` flushes the buffer when…
   - A) exactly 2000 events arrive
   - B) only after 2000ms, ignoring size
   - C) 2000ms elapse OR 50 events accumulate, whichever comes first
   - D) the source completes

3. Why must you usually `filter(b => b.length > 0)` after `bufferTime`?
   - A) To sort the batch
   - B) `bufferTime` errors on empty windows
   - C) To remove duplicate events
   - D) Because `bufferTime` emits empty arrays on idle windows

4. To compute "clicks per second", which combination is idiomatic?
   - A) `bufferCount(1)`
   - B) `debounceTime(1000)`
   - C) `windowTime(1000)` + `mergeMap(w => w.pipe(count()))`
   - D) `switchMap` over each click

5. In the batching dashboard, what does "calls saved" (`totalBatched − batchesSent`) represent?
   - A) Memory freed
   - B) The number of network requests avoided by batching
   - C) The number of dropped events
   - D) The latency in milliseconds

**Correct Answers:** 1-A, 2-C, 3-D, 4-C, 5-B

**Explanations:**
- Q1: `buffer*` collects values into arrays; `window*` collects them into Observables you can pipe per-group.
- Q2: The third argument is `maxBufferSize`, so the buffer flushes on the timespan **or** when it reaches that size — whichever happens first.
- Q3: `bufferTime` emits an array every interval even when empty; filter those out so you don't process/send empty batches.
- Q4: Per-window aggregation: `windowTime(1000)` then flatten each window with `count()` via `mergeMap`.
- Q5: Each batch is one request for many events, so `totalBatched − batchesSent` is the number of requests batching avoided.

---

## Module Summary & Next Steps

You can now reason about time-grouped streams:
- `buffer*` (arrays) vs `window*` (Observables), and all the boundary variants (time, count, notifier, toggle, when)
- Temporal windows: fixed, time-or-count, overlapping/sliding, session (inactivity), and rate limiting
- Efficient analytics batching with non-empty filtering, `maxBufferSize` caps, idempotent ordered sends, and unload flushing
- Combining `window` with `reduce`/`count` for per-window aggregation, and `bufferToggle` for signal-driven windows

**Next Module:** Module 15 – Time Windowing (tumbling vs sliding windows, moving averages and real-time aggregations, and windowing for rate limiting)

**Recommended Practice:** Add a session-window strategy and a `windowTime` "events per 2s" live metric to the batching dashboard.

---

*Improved Module 14 v2.0 – Part of the RxJS Mastery Professional Course*

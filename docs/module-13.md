# Module 13: Backpressure Strategies

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

Backpressure is one of the most important concepts in reactive programming when dealing with high-frequency data streams. This module teaches you how to handle situations where a fast producer overwhelms a slow consumer, implement controlled concurrency, and build systems that gracefully handle high-throughput scenarios like live stock tickers, sensor data, and real-time analytics.

> Module 06 introduced backpressure-aware flattening; here we focus on **high-frequency feeds** — sampling, buffering, conflation, and monitoring.

**Estimated Total Time:** 115–135 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Modules 05–06 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Understand the concept of backpressure
- Implement controlled concurrency strategies
- Handle high-frequency data streams efficiently
- Build a live data ticker with intelligent backpressure
- Optimize performance in data-intensive applications

---

## Lesson 13.1: Understanding Backpressure

**Estimated Time:** 20 minutes

### What is Backpressure?
Backpressure occurs when a **producer** emits data faster than the **consumer** can process it. Without proper handling, this can lead to:
- Memory exhaustion (a growing buffer of unprocessed values)
- Dropped frames / unresponsive UI
- Application crashes

### The Problem

```ts
import { interval } from 'rxjs';

const fast$ = interval(10);          // emits every 10ms (100/sec)

fast$.subscribe(value => {
  heavyProcessing(value);            // takes ~100ms → falls 10x behind, forever
});
```

The consumer can never catch up — work queues without bound.

### Push vs Pull
RxJS is **push-based**: the producer decides when to emit, and the consumer cannot say "slow down." (The Reactive Streams spec adds *pull* backpressure via `request(n)` — Lesson 13.4.) Because RxJS is push, you manage backpressure with **operators** that either control the rate of work or drop excess data.

### The Two Families (recap from Module 06)
- **Lossless** — keep every value, bound the *work*: `mergeMap(fn, n)`, `concatMap`, buffering.
- **Lossy** — drop values you can't keep up with: `sampleTime`, `throttleTime`, `auditTime`, `debounceTime`, `exhaustMap`, `switchMap`.

### Separate Ingestion from Rendering
A crucial production insight: updating *data* in memory is cheap; *rendering* is expensive. Often you ingest **every** value losslessly, but **render** at a controlled rate (lossy). You'll build exactly this in the project.

### Common Mistake
**Assuming RxJS will "handle" backpressure for you.** It won't — push streams happily flood a slow consumer. You must choose a strategy explicitly.

### Quick Exercise
Subscribe to `interval(10)` and do `await`-style heavy work in the handler (simulate with a busy loop). Watch the lag grow. Then add `sampleTime(200)` and watch it stabilize.

**Key Takeaway:** Backpressure is producer-outpaces-consumer; RxJS is push-based, so you handle it explicitly with lossless (bound work) or lossy (drop) operators.

---

## Lesson 13.2: Controlled Concurrency with exhaustMap & buffer

**Estimated Time:** 24 minutes

### Rate-Limiting Operators at a Glance

| Operator | Keeps | Emits | Use for |
|----------|-------|-------|---------|
| `throttleTime(t)` | first in window | leading value, then ignores for `t` | rate-limit a button/scroll |
| `auditTime(t)` | last in window | value at *end* of window | smooth "latest" without leading spike |
| `sampleTime(t)` | last at each tick | newest value every `t` | periodic snapshots (tickers) |
| `debounceTime(t)` | last after quiet | value after a `t` gap | search input |
| `bufferTime(t)` | **all** in window | array per window | batching (Module 14) |

### Conflation with `audit`/`sample`
For a live feed where only the **latest** value matters (a price, a cursor position), `auditTime`/`sampleTime` *conflate* the burst into one value per window — lossless of meaning, lossy of intermediate ticks.

```ts
priceFeed$.pipe(sampleTime(250)).subscribe(renderPrice); // 4 renders/sec, always the latest
```

### Drop-While-Busy with `exhaustMap`
When each unit of work must finish before another starts (and extra triggers are noise), `exhaustMap` ignores new emissions while busy — a natural backpressure valve:

```ts
saveClicks$.pipe(exhaustMap(() => save())).subscribe(); // ignores clicks during a save
```

### Bounded Buffering
When you must process everything but in chunks, buffer then process with capped concurrency:

```ts
sensor$.pipe(
  bufferTime(1000),                       // 1s batches
  filter(batch => batch.length > 0),
  concatMap(batch => uploadBatch(batch))  // one upload at a time
).subscribe();
```

### Combining with a Circuit Breaker
Under *sustained* overload, even rate-limiting isn't enough — shed load. Pair backpressure with the circuit breaker from Module 08: if the consumer (or downstream API) keeps failing, **open the circuit** and drop/queue until it recovers, rather than buffering to exhaustion.

### Common Mistake
**Unbounded `bufferTime` on a firehose with a slow consumer.** If batches arrive faster than they upload, `concatMap`'s queue grows without bound. Cap it (drop oldest, or switch to sampling) under sustained pressure.

### Quick Exercise
Take `interval(20)` and compare `throttleTime(200)` vs `auditTime(200)` vs `sampleTime(200)` — note which gives the leading value vs the trailing/latest.

**Key Takeaway:** Choose the rate-limiter by intent — `throttle` (leading), `audit`/`sample` (latest), `debounce` (after quiet), `buffer` (batch) — and combine with `exhaustMap`/circuit breaker to shed load under sustained overload.

---

## Lesson 13.3: Handling Live Data Feeds (Stock Tickers, Sensors)

**Estimated Time:** 22 minutes

### The Shape of a Live Feed
Tickers, sensors, and websockets share a profile: **high frequency, latest-value-matters, UI-bound**. The winning pattern is almost always:

```text
feed (fast) ──► ingest every value (cheap, in-memory) ──► state
                                                            │
                            render trigger (sampleTime/auditTime) ──► paint (expensive)
```

### Per-Key Conflation with groupBy
For multi-symbol feeds, conflate **per symbol** so a busy symbol doesn't starve others:

```ts
import { groupBy, mergeMap, auditTime } from 'rxjs/operators';

ticks$.pipe(
  groupBy(tick => tick.symbol),
  mergeMap(group$ => group$.pipe(auditTime(200)))  // latest per symbol, every 200ms
).subscribe(renderSymbol);
```

### WebSocket Feeds
`webSocket()` (from `rxjs/webSocket`) gives you a `Subject` over a socket. Apply the same rate-limiting downstream; and for reconnection, layer the retry/backoff from Module 08:

```ts
import { webSocket } from 'rxjs/webSocket';
const prices$ = webSocket('wss://example/prices').pipe(
  retry({ count: Infinity, delay: (_, n) => timer(Math.min(1000 * 2 ** n, 30000)) })
);
```

### Monitoring Backpressure in Production
You can't fix what you can't see. Track and alert on:
- **Ingest rate** (values/sec in) vs **render/process rate** (out)
- **Buffer depth / lag** (growing = losing the race)
- **Drop count** (how much you're shedding)

A simple gauge: `ratio = processed / received`. A persistently falling ratio means the consumer is drowning.

### Common Mistake
**Rendering on every websocket message.** A 1000 msg/sec feed will destroy your frame budget. Ingest all, render conflated (`sampleTime`/`auditTime`), per key with `groupBy`.

### Quick Exercise
Given a multi-symbol `ticks$`, write the `groupBy` + `auditTime(250)` pipeline so each symbol renders at most 4 times/second with its latest price.

**Key Takeaway:** For live feeds, ingest every value cheaply and render conflated (`sampleTime`/`auditTime`, per-key via `groupBy`); monitor ingest-vs-process rate and buffer depth in production.

---

## Lesson 13.4: Reactive Streams Specification Concepts

**Estimated Time:** 18 minutes

### Pull-Based Backpressure
The **Reactive Streams** specification (the basis of Java's Flow, Project Reactor, Akka Streams) defines *pull* backpressure: the consumer signals demand with `request(n)`, and the producer emits **at most** `n` items. The consumer is in control — the producer literally cannot overflow it.

```text
Publisher  ──onSubscribe(subscription)──►  Subscriber
Subscriber ──subscription.request(n)────►  Publisher
Publisher  ──onNext × up to n───────────►  Subscriber
```

### RxJS Is Push, Not Pull
RxJS does **not** implement `request(n)` backpressure. An RxJS Observable pushes whenever it wants. So in RxJS you achieve the *effect* of backpressure with the lossy/lossless operators from this module — controlling rate or dropping — rather than negotiating demand.

| | Reactive Streams (pull) | RxJS (push) |
|---|---|---|
| Who controls rate | Consumer (`request(n)`) | Producer (you shape it with operators) |
| Overflow protection | Built-in | Operator-based (buffer/sample/drop) |
| Examples | Project Reactor, Akka, Java Flow | RxJS |

### Interoperability
When bridging RxJS with a Reactive-Streams system (e.g. a backend using Reactor), adapters convert between the models. The key mental shift: a `request(n)` consumer expects to *pull*; an RxJS source *pushes*, so the adapter must buffer or apply demand on RxJS's behalf.

### Common Mistake
**Expecting `request(n)` semantics in RxJS.** There's no built-in demand signaling. If you truly need pull-based backpressure (e.g. reading a huge file in exact-demand chunks), model it explicitly (e.g. a generator + `expand`, or a pull loop) rather than assuming the operator does it.

### Quick Exercise
Explain, in one sentence each, how a pull system and RxJS each prevent a slow consumer from being overwhelmed.

**Key Takeaway:** Reactive Streams uses consumer-driven `request(n)` pull backpressure; RxJS is push-based and achieves the same goals with rate-control/drop operators — know the difference when interoperating.

---

## Lesson 13.5: Project Workshop – Live Stock Ticker with Intelligent Backpressure

**Estimated Time:** 30 minutes

### Project Goal

Build a **live stock ticker** fed by a high-frequency price stream, and *see* backpressure strategies side by side:

- A fast feed (~40 ticks/sec) that would overwhelm naive rendering
- **Ingest every tick** into in-memory state (cheap, lossless)
- **Render** via a selectable strategy: **raw**, **sampleTime**, **auditTime**, or **bufferTime**
- Live **monitoring**: ticks received, renders performed, and the backpressure **ratio**
- A visual ticker (price, up/down, % change) per symbol

### Why This Project Matters

Flip from "raw" to "sample" and watch the render count collapse while the prices stay current — the essence of backpressure. The ingest/render split and the metrics are exactly how you'd run a real feed.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; symbol cards + a metrics bar + strategy selector.
2. **Feed** — `interval(25)` → random tick `{ symbol, price }`, `share()`d (one hot feed).
3. **Ingest** — subscribe the feed; update prices on *every* tick (lossless, cheap).
4. **Render** — `strategy$ → switchMap(applyStrategy(feed$)) → paint` at the controlled rate.
5. **Monitor** — count ticks vs renders; show the ratio.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Stock Ticker • RxJS Backpressure</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-3xl mx-auto p-8">
    <h1 class="text-3xl font-semibold tracking-tight mb-1">Live Stock Ticker</h1>
    <p class="text-zinc-400 mb-6">Ingest every tick · render with a backpressure strategy</p>

    <!-- Controls + metrics -->
    <div class="flex flex-wrap items-center gap-4 mb-6">
      <label class="flex items-center gap-2 text-sm text-zinc-400">
        Strategy
        <select id="strategy" class="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200">
          <option value="raw">raw (every tick)</option>
          <option value="sample" selected>sampleTime(250)</option>
          <option value="audit">auditTime(250)</option>
          <option value="buffer">bufferTime(250)</option>
        </select>
      </label>
      <div class="ml-auto flex gap-4 text-sm">
        <div>ticks: <span id="mTicks" class="font-mono text-sky-400">0</span></div>
        <div>renders: <span id="mRenders" class="font-mono text-emerald-400">0</span></div>
        <div>ratio: <span id="mRatio" class="font-mono text-amber-400">–</span></div>
      </div>
    </div>

    <div id="cards" class="grid grid-cols-2 sm:grid-cols-4 gap-3"></div>
    <p id="note" class="text-xs text-zinc-600 mt-4"></p>
  </div>

  <script>
    const { interval, Subject } = rxjs;
    const { map, share, sampleTime, auditTime, bufferTime, switchMap, startWith } = rxjs.operators;

    const SYMBOLS = ['AAPL', 'GOOG', 'TSLA', 'AMZN'];
    const FEED_MS = 25;   // ~40 ticks/sec

    // State: latest price + previous (for up/down) per symbol
    const prices = {};
    SYMBOLS.forEach(s => prices[s] = { price: 100 + Math.random() * 200, prev: 0, base: 0 });
    Object.values(prices).forEach(p => { p.prev = p.price; p.base = p.price; });

    let ticks = 0, renders = 0;

    // --- The fast feed (hot, shared) ---
    const feed$ = interval(FEED_MS).pipe(
      map(() => {
        const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const drift = (Math.random() - 0.5) * 2;          // -1..+1
        return { symbol, delta: drift };
      }),
      share()
    );

    // --- Ingest EVERY tick (cheap, lossless) ---
    feed$.subscribe(({ symbol, delta }) => {
      ticks++;
      const p = prices[symbol];
      p.prev = p.price;
      p.price = Math.max(1, p.price + delta);
    });

    // --- Render at a controlled rate (the backpressure choice) ---
    function applyStrategy(strat) {
      switch (strat) {
        case 'raw':    return feed$;
        case 'sample': return feed$.pipe(sampleTime(250));
        case 'audit':  return feed$.pipe(auditTime(250));
        case 'buffer': return feed$.pipe(bufferTime(250));
      }
    }

    const cardsEl = document.getElementById('cards');
    const noteEl = document.getElementById('note');
    function paint(payload) {
      renders++;
      cardsEl.innerHTML = SYMBOLS.map(s => {
        const p = prices[s];
        const up = p.price >= p.base;
        const pct = ((p.price - p.base) / p.base * 100).toFixed(2);
        const colour = up ? 'emerald' : 'red';
        return `
          <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div class="text-xs text-zinc-500">${s}</div>
            <div class="text-xl font-semibold tabular-nums text-${colour}-400">$${p.price.toFixed(2)}</div>
            <div class="text-xs text-${colour}-500">${up ? '▲' : '▼'} ${pct}%</div>
          </div>`;
      }).join('');
      noteEl.textContent = Array.isArray(payload)
        ? `bufferTime → batched ${payload.length} ticks into one render`
        : '';
    }

    // --- Strategy switching cancels the previous render stream (switchMap) ---
    const strategy$ = new Subject();
    strategy$.pipe(
      startWith('sample'),
      switchMap(strat => applyStrategy(strat))
    ).subscribe(paint);

    document.getElementById('strategy').addEventListener('change', e => strategy$.next(e.target.value));

    // --- Monitoring (ratio = renders / ticks; lower = more backpressure savings) ---
    interval(500).subscribe(() => {
      document.getElementById('mTicks').textContent = ticks;
      document.getElementById('mRenders').textContent = renders;
      document.getElementById('mRatio').textContent = ticks ? (renders / ticks).toFixed(3) : '–';
    });
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **Ingest cheap, render controlled** — every tick updates state, but rendering happens at the strategy's rate. This split is the heart of feed backpressure.
- **`sampleTime`/`auditTime` conflate** — the UI always shows the latest price while rendering only ~4×/sec.
- **`bufferTime` batches** — one render per window over an array of ticks (a bridge to Module 14).
- **`switchMap` swaps strategies cleanly** — changing the selector cancels the old render stream; the shared feed keeps flowing.
- **The ratio is your gauge** — `renders / ticks` quantifies how much work you saved; "raw" sits near 1.0, sampling far below.

### Stretch Goals (Recommended Practice)

1. Add per-symbol conflation with `groupBy` + `auditTime` so each symbol renders independently (Lesson 13.3).
2. Add a tiny sparkline per symbol from a `scan`-accumulated price history (Module 10).
3. Add a "drop count" metric for buffer overflow under a faster feed.
4. Wire a real websocket feed with `webSocket()` + reconnect backoff (Module 08).

### Deliverable

A live ticker that ingests a 40/sec feed losslessly, renders via a selectable backpressure strategy, and reports ticks/renders/ratio so you can compare strategies in real time.

**Key Takeaway:** You built an intelligent live ticker that separates cheap ingestion from rate-controlled rendering — the production pattern for taming high-frequency feeds, with live backpressure monitoring.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What is backpressure?
   - A) When a producer emits faster than the consumer can process
   - B) Compressing data before sending it
   - C) An error raised on stream completion
   - D) A way to retry failed requests

2. RxJS handles backpressure differently from the Reactive Streams spec because RxJS is…
   - A) pull-based with `request(n)` demand
   - B) single-threaded only
   - C) push-based, so you control rate or drop with operators
   - D) unable to handle high-frequency data

3. For a live ticker where only the latest price matters, which operator conflates a burst into the newest value per window?
   - A) `concatMap`
   - B) `sampleTime` / `auditTime`
   - C) `debounceTime`
   - D) `mergeMap`

4. In the project, why is ingestion kept separate from rendering?
   - A) Because RxJS requires it
   - B) To make the code longer
   - C) So ticks can be ignored entirely
   - D) Updating in-memory state is cheap and lossless; rendering is expensive, so it's rate-controlled

5. What does the `renders / ticks` ratio tell you?
   - A) The network latency
   - B) How much rendering work was saved by the backpressure strategy
   - C) The number of symbols
   - D) The memory usage

**Correct Answers:** 1-A, 2-C, 3-B, 4-D, 5-B

**Explanations:**
- Q1: Backpressure is producer-outpaces-consumer; unmanaged, it exhausts memory or drops frames.
- Q2: RxJS is push-based (no `request(n)`), so backpressure is achieved with rate-control/drop operators rather than demand signaling.
- Q3: `sampleTime`/`auditTime` emit the latest value per time window — ideal conflation for a ticker.
- Q4: Ingest is cheap and lossless (update state every tick); rendering is expensive, so it runs at a controlled rate.
- Q5: A lower `renders / ticks` ratio means the strategy avoided more rendering work — your backpressure gauge.

---

## Module Summary & Next Steps

You can now tame high-frequency streams:
- Backpressure as producer-vs-consumer, and why push-based RxJS needs explicit strategies
- Rate-limiters by intent: `throttle` (leading), `audit`/`sample` (latest), `debounce` (after quiet), `buffer` (batch)
- Live-feed patterns: ingest-cheap/render-controlled, per-key `groupBy` conflation, websockets with reconnect, and production monitoring
- How RxJS's push model differs from Reactive Streams' pull (`request(n)`) backpressure

**Next Module:** Module 14 – Window & Buffer (buffering and windowing operators for batching, temporal reasoning, and analytics)

**Recommended Practice:** Extend the ticker with per-symbol `groupBy` conflation and a drop-count metric, then compare strategy ratios under a faster feed.

---

*Improved Module 13 v2.0 – Part of the RxJS Mastery Professional Course*

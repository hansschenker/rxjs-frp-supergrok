# Module 15: Time Windowing

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

This module dives deep into **time-based windowing** techniques, including tumbling windows, sliding windows, and moving averages. These patterns are essential for building real-time analytics dashboards, rate limiters, and time-series data processing systems. You will learn how to reason about time in reactive streams and implement sophisticated temporal aggregations.

**Estimated Total Time:** 110–130 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Module 14 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Understand tumbling vs sliding windows
- Implement moving averages and other temporal aggregations
- Build real-time analytics dashboards
- Apply time windowing for rate limiting and throttling
- Choose the right windowing strategy for different use cases

---

## Lesson 15.1: Tumbling vs Sliding Windows

**Estimated Time:** 20 minutes

### Tumbling Windows
**Non-overlapping** windows — each value belongs to exactly one window. Great for "per-minute totals" style metrics.

```ts
// 5-second tumbling windows → average per window
source$.pipe(
  windowTime(5000),
  mergeMap(window$ => window$.pipe(toArray()))   // or reduce/average
);
```

```text
values:  --1-2-3-----4-5-----6-7-8--|
tumbling:[1,2,3]    [4,5]    [6,7,8]      (each value in ONE window)
```

### Sliding (Overlapping) Windows
Windows that **overlap** — a value can appear in several. Created by giving a *creation interval* smaller than the window span. Great for moving averages.

```ts
// 5s window, a new one started every 1s → overlapping
source$.pipe(windowTime(5000, 1000), mergeMap(w => w.pipe(toArray())));
```

```text
window A: [t0 .. t5]
window B:      [t1 .. t6]      (overlaps A)
window C:           [t2 .. t7] (overlaps B)
```

### Count-Based Variants
The same idea by **count**: `bufferCount(size, startEvery)`. A `startEvery` smaller than `size` slides:

```ts
source$.pipe(bufferCount(3, 1)); // window of 3, sliding by 1 → moving window of last 3
```

### Choosing
- **Tumbling** → discrete reporting periods (hourly sales, per-minute error counts).
- **Sliding** → smoothed/continuous metrics (moving average, "last 5 minutes" rate).

### Common Mistake
**Using tumbling when you meant sliding (or vice versa).** Tumbling resets each period (spiky); sliding overlaps (smooth). A moving average needs *sliding*; a billing period needs *tumbling*.

### Quick Exercise
With `bufferCount(4, 2)` on `1..8`, write out the windows. (You'll get `[1,2,3,4]`, `[3,4,5,6]`, `[5,6,7,8]` — overlap of 2.)

**Key Takeaway:** Tumbling windows partition values without overlap (discrete periods); sliding windows overlap (smoothed/continuous metrics) — set the slide via the creation interval / `startEvery`.

---

## Lesson 15.2: Moving Averages and Real-Time Aggregations

**Estimated Time:** 24 minutes

### Simple Moving Average (SMA)
The average of the last N values — smooths noise. Keep a sliding window of N with `scan`, then average:

```ts
const N = 10;
source$.pipe(
  scan((window: number[], v) => [...window, v].slice(-N), []),
  map(window => window.reduce((a, b) => a + b, 0) / window.length)
);
```

### Exponential Moving Average (EMA)
Weights recent values more heavily; no buffer needed, just the previous EMA:

```ts
const alpha = 0.2; // smoothing factor (higher = more reactive)
source$.pipe(
  scan((ema, v) => ema === null ? v : alpha * v + (1 - alpha) * ema, null as number | null)
);
```

| | SMA | EMA |
|---|-----|-----|
| Memory | last N values | one number |
| Reactivity | uniform | recent-weighted |
| Use | clear "last N" semantics | fast-reacting trend |

### Other Aggregations
Per-window `min`/`max`/`sum`/`count`/standard deviation all follow the same shape — accumulate the window, then compute:

```ts
source$.pipe(
  bufferTime(1000),
  filter(b => b.length > 0),
  map(b => ({ count: b.length, max: Math.max(...b), avg: b.reduce((a, c) => a + c, 0) / b.length }))
);
```

### Anomaly Detection
A common real-time use: flag values that deviate from the moving average by more than a few standard deviations:

```ts
function isAnomaly(value: number, window: number[], k = 2.5) {
  const baseline = window.slice(0, -1);     // compare current value to prior history
  if (baseline.length < 2) return false;
  const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const sd = Math.sqrt(baseline.reduce((a, b) => a + (b - mean) ** 2, 0) / baseline.length);
  return sd > 0 && Math.abs(value - mean) > k * sd;   // outside k std-devs
}
```

### Common Mistake
**Recomputing SMA over an unbounded buffer.** If you never `slice(-N)`, the window grows forever and the "moving" average stops moving. Always bound the window.

### Quick Exercise
Compute a 5-point SMA and an EMA (α = 0.3) for the same source and log both — notice the EMA reacts to a spike faster.

**Key Takeaway:** SMA (bounded `scan` window) is uniform and explicit; EMA (one accumulator) reacts faster to recent change; both, plus min/max/σ, power real-time aggregations and anomaly detection.

---

## Lesson 15.3: Windowing for Rate Limiting and Throttling

**Estimated Time:** 20 minutes

### Rate Limiting = "N per Window"
"At most N operations per time window" is a window + `take`:

```ts
requests$.pipe(
  windowTime(1000),                       // one window per second
  mergeMap(win$ => win$.pipe(take(5)))    // at most 5 pass per second
).subscribe(process);
```

This is a fixed-window limiter. It can still allow boundary bursts (for example, five requests at the end of one second and five more at the start of the next). Use a token bucket or sliding-window strategy when you need smoother enforcement.

### Throttle vs Window-Based Limiting
- `throttleTime(t)` — at most one per `t` (leading). Simple, single-rate.
- Window + `take(n)` — up to **n** per window. Use when a burst of n is acceptable but a sustained flood is not.

### Token-Bucket Style
For smoother limiting, combine a refill timer with the request stream (a token bucket). Conceptually: a window grants `n` tokens; requests consume them; extras wait or drop.

### Sampling for Display
For a high-rate metric you only need to *show* periodically — `sampleTime`/`auditTime` (Module 13) give "latest per window" for the UI while the full stream is aggregated in the background.

### Common Mistake
**Confusing display rate with processing rate.** You can aggregate every value (for correctness) while only *rendering* a windowed sample (for performance). Don't throttle the data you need for the metric — only the rendering.

### Quick Exercise
Limit a click stream to 3 actions per 2 seconds using `windowTime(2000)` + `take(3)`. If you also need to log ignored clicks, count each full window and compare its total with the three emitted values; `take(3)` by itself only forwards allowed clicks.

**Key Takeaway:** Window + `take(n)` enforces fixed-window "n per window" rate limits; use token/sliding-window approaches for smoother limits, `throttleTime` as the single-rate shortcut, and aggregate at full rate while rendering sampled views.

---

## Lesson 15.4: Advanced Temporal Patterns

**Estimated Time:** 22 minutes

### Sliding Window with a Custom Step
A moving window of the last N, advancing by `step`:

```ts
source$.pipe(bufferCount(N, step));   // window N, emit every `step` values
// time-based equivalent:
source$.pipe(bufferTime(spanMs, stepMs));
```

A `step` smaller than `N` overlaps (smoothing); `step === N` is tumbling; `step > N` *skips* values (sampling).

### Session Windows (recap)
Group bursts separated by inactivity — close a window after a quiet gap (Module 14):

```ts
buffer(source$.pipe(debounceTime(gapMs)));
```

### Time-Weighted Aggregation
When samples are irregular, a plain average over-weights bursts. Time-weight by each value's *duration* until the next sample (timestamp deltas) for an accurate average.

### Comparing Windows (this vs previous)
Detect trends by comparing consecutive window aggregates with `pairwise`:

```ts
windowedAverages$.pipe(
  pairwise(),
  map(([prev, cur]) => ({ delta: cur - prev, rising: cur > prev }))
);
```

### Real-Time Domains
These patterns power: **IoT/sensors** (rolling averages, anomaly alerts), **trading** (moving averages, volatility = rolling σ), and **monitoring** (per-minute error rates, p95 latency windows).

### Common Mistake
**Plain averaging irregular time series.** If samples don't arrive at a fixed rate, an unweighted mean is biased toward bursty periods. Time-weight, or resample to a fixed grid first.

### Quick Exercise
Use `pairwise` on a stream of per-second averages to print "▲ rising" / "▼ falling" each second.

**Key Takeaway:** Control overlap with the window step (`bufferCount(N, step)`), use session windows for bursts, time-weight irregular series, and compare consecutive windows with `pairwise` to detect trends.

---

## Lesson 15.5: Project Workshop – Real-Time Analytics Dashboard with Time Windows

**Estimated Time:** 30 minutes

### Project Goal

Build an **interactive real-time analytics dashboard** over a live metric feed:

- A simulated metric stream (with occasional spikes)
- A **sliding window** SMA + an **EMA** trend line, with a live sparkline
- **Tumbling-window** averages shown as a bar history
- **Anomaly detection** (values beyond *k* standard deviations from the SMA), flagged live
- Interactive controls: window size, anomaly sensitivity

### Why This Project Matters

This is the shape of every monitoring/trading/IoT dashboard: ingest a fast metric, smooth it (SMA/EMA), aggregate it per period (tumbling bars), and alert on anomalies. You will tune the window live and watch the smoothing and detection respond.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; readouts, a sparkline, a tumbling-bar row, and an anomaly log.
2. **Feed** — `interval(250)` → a noisy metric with occasional spikes, `share()`d.
3. **Sliding** — `scan` keeps the last N; compute SMA, σ, and EMA each tick.
4. **Tumbling** — `bufferTime(2000)` → average → append a bar.
5. **Anomaly** — flag values beyond *k*·σ of the SMA; controls adjust N and *k* live.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Real-Time Analytics • RxJS Time Windows</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-3xl mx-auto p-8">
    <h1 class="text-3xl font-semibold tracking-tight mb-1">Real-Time Analytics</h1>
    <p class="text-zinc-400 mb-6">Sliding SMA/EMA · tumbling bars · anomaly detection</p>

    <!-- Readouts -->
    <div class="grid grid-cols-4 gap-3 mb-6 text-center">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><div class="text-[10px] uppercase text-zinc-500">Current</div><div id="rCur" class="text-2xl font-semibold tabular-nums">–</div></div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><div class="text-[10px] uppercase text-zinc-500">SMA</div><div id="rSma" class="text-2xl font-semibold tabular-nums text-sky-400">–</div></div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><div class="text-[10px] uppercase text-zinc-500">EMA</div><div id="rEma" class="text-2xl font-semibold tabular-nums text-emerald-400">–</div></div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><div class="text-[10px] uppercase text-zinc-500">Anomalies</div><div id="rAnom" class="text-2xl font-semibold tabular-nums text-red-400">0</div></div>
    </div>

    <!-- Sliding window sparkline -->
    <div class="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Sliding window (last N)</div>
    <div id="spark" class="flex items-end gap-0.5 h-24 bg-zinc-900/50 border border-zinc-800 rounded-xl p-2 mb-6"></div>

    <!-- Tumbling bars -->
    <div class="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Tumbling 2s averages</div>
    <div id="bars" class="flex items-end gap-1 h-24 bg-zinc-900/50 border border-zinc-800 rounded-xl p-2 mb-6"></div>

    <!-- Controls -->
    <div class="flex flex-wrap gap-6 mb-6 text-sm text-zinc-400">
      <label class="flex items-center gap-2">Window N <span id="nVal" class="font-mono text-zinc-200">20</span>
        <input id="n" type="range" min="5" max="50" value="20"></label>
      <label class="flex items-center gap-2">Sensitivity k <span id="kVal" class="font-mono text-zinc-200">2.5</span>
        <input id="k" type="range" min="1" max="4" value="2.5" step="0.5"></label>
    </div>

    <div class="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Anomaly Log</div>
    <div id="log" class="h-24 overflow-auto font-mono text-xs space-y-1"></div>
  </div>

  <script>
    const { interval, Subject } = rxjs;
    const { map, share, scan, bufferTime, filter } = rxjs.operators;

    let N = 20, K = 2.5, anomalies = 0, base = 50;

    const nEl = document.getElementById('n'), kEl = document.getElementById('k');
    nEl.addEventListener('input', () => { N = +nEl.value; document.getElementById('nVal').textContent = N; });
    kEl.addEventListener('input', () => { K = +kEl.value; document.getElementById('kVal').textContent = K.toFixed(1); });

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    function nextValue() {
      base = clamp(base + (Math.random() - 0.5) * 4, 10, 90);
      let v = base + (Math.random() - 0.5) * 6;
      if (Math.random() < 0.04) v += (Math.random() < 0.5 ? -1 : 1) * 30; // spike
      return Math.round(clamp(v, 0, 120));
    }
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const stddev = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

    const feed$ = interval(250).pipe(map(nextValue), share());

    // Sliding state: keep last N and carry EMA in the stream state.
    feed$.pipe(scan((state, v) => {
      const win = [...state.win, v].slice(-N);
      const ema = state.ema === null ? v : 0.2 * v + 0.8 * state.ema;
      return { win, ema };
    }, { win: [], ema: null })).subscribe(({ win, ema }) => {
      const v = win[win.length - 1];
      const sma = mean(win);
      const baseline = win.slice(0, -1);
      const bMean = baseline.length ? mean(baseline) : sma;
      const bSd = baseline.length ? stddev(baseline) : 0;

      document.getElementById('rCur').textContent = v;
      document.getElementById('rSma').textContent = sma.toFixed(1);
      document.getElementById('rEma').textContent = ema.toFixed(1);

      // sparkline
      const max = Math.max(...win, 1);
      document.getElementById('spark').innerHTML = win.map(x =>
        `<div class="flex-1 bg-sky-500/70 rounded-sm" style="height:${(x / max) * 100}%"></div>`).join('');

      // anomaly: compare current value to the previous-window baseline
      if (baseline.length >= 8 && bSd > 0 && Math.abs(v - bMean) > K * bSd) {
        anomalies++;
        document.getElementById('rAnom').textContent = anomalies;
        const row = document.createElement('div');
        row.className = 'text-red-400';
        row.textContent = `${new Date().toLocaleTimeString()}  ⚠ value ${v} vs baseline ${bMean.toFixed(1)} (±${(K*bSd).toFixed(1)})`;
        document.getElementById('log').prepend(row);
      }
    });

    // Tumbling 2s window averages → bars
    let bars = [];
    feed$.pipe(bufferTime(2000), filter(b => b.length > 0), map(mean)).subscribe(avg => {
      bars = [...bars, avg].slice(-15);
      const max = Math.max(...bars, 1);
      document.getElementById('bars').innerHTML = bars.map(x =>
        `<div class="flex-1 bg-emerald-500/70 rounded-t" style="height:${(x / max) * 100}%" title="${x.toFixed(1)}"></div>`).join('');
    });
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **Sliding `scan` window = SMA + σ** — keep the last N with `slice(-N)`; read N live so the slider tunes smoothing on the fly.
- **EMA needs no buffer** — one accumulator reacts faster than the SMA to spikes.
- **Tumbling `bufferTime` = discrete bars** — each 2s period becomes one averaged bar.
- **Anomaly = deviation in σ units** — flagging `|v − SMA| > k·σ` adapts to the data's own volatility, not a fixed threshold.

### Stretch Goals (Recommended Practice)

1. Add a sliding window with a custom **step** (`bufferCount(N, step)`) and visualize the overlap.
2. Overlay the SMA and EMA as two lines on an SVG chart.
3. Add a "trend" indicator using `pairwise` on the tumbling averages (▲/▼).
4. Swap the simulated feed for a real one (e.g. `webSocket`) and keep the same windowing.

### Deliverable

An interactive analytics dashboard: a live feed, sliding SMA + EMA with a sparkline, tumbling 2s bars, and σ-based anomaly detection with adjustable window and sensitivity.

**Key Takeaway:** You built a real-time analytics dashboard combining sliding (SMA/EMA) and tumbling windows with σ-based anomaly detection — the core of monitoring, trading, and IoT dashboards.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What distinguishes a tumbling window from a sliding window?
   - A) Tumbling windows don't overlap (each value in one window); sliding windows overlap
   - B) Tumbling windows overlap; sliding windows don't
   - C) They are identical
   - D) Sliding windows only work with counts

2. Which moving average needs only a single accumulator value (no buffer of recent values)?
   - A) Simple Moving Average (SMA)
   - B) Median
   - C) Exponential Moving Average (EMA)
   - D) Cumulative sum

3. How do you create an overlapping (sliding) time window in RxJS?
   - A) `bufferTime(span)` with no other args
   - B) `debounceTime(span)`
   - C) `take(span)`
   - D) `bufferTime(span, creationInterval)` where the interval is smaller than the span

4. How is "at most 5 operations per second" idiomatically expressed?
   - A) `throttleTime(5)`
   - B) `bufferCount(5)`
   - C) `windowTime(1000)` + `mergeMap(w => w.pipe(take(5)))`
   - D) `delay(1000)`

5. In the dashboard, why flag anomalies using `k · σ` rather than a fixed threshold?
   - A) Because σ is faster to compute
   - B) It adapts to the data's own volatility, so detection scales with the noise level
   - C) Fixed thresholds are not allowed in RxJS
   - D) To reduce memory usage

**Correct Answers:** 1-A, 2-C, 3-D, 4-C, 5-B

**Explanations:**
- Q1: Tumbling windows partition values with no overlap; sliding windows overlap so a value can appear in multiple windows.
- Q2: EMA keeps only the previous average (`alpha*v + (1-alpha)*ema`); SMA needs the last N values.
- Q3: A `creationInterval` smaller than the window span starts a new (overlapping) window before the previous one closes.
- Q4: Per-window `take(n)`: one window per second, at most five values pass through each.
- Q5: A `k·σ` band scales with the data's volatility, so the same rule works for calm and noisy periods alike.

---

## Module Summary & Next Steps

You can now reason about time-windowed analytics:
- Tumbling (discrete) vs sliding (overlapping) windows, by time or count, with custom step
- Moving averages (SMA with a bounded `scan` window, EMA with one accumulator) and σ-based anomaly detection
- Window-based rate limiting (`windowTime` + `take(n)`) vs `throttleTime`
- Advanced patterns: session windows, time-weighting irregular series, and `pairwise` trend comparison

**Next Module:** Module 16 – Custom Operators Mastery (building stateful, type-safe, tested, and publishable custom operators)

**Recommended Practice:** Add a custom-step sliding window and an SVG SMA/EMA overlay to the dashboard, then point it at a real websocket feed.

---

*Improved Module 15 v2.0 – Part of the RxJS Mastery Professional Course*

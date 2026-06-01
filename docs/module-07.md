# Module 07: Error Handling

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

Error handling is one of the most critical yet often neglected areas in reactive programming. This module teaches you how to build **robust, resilient, and user-friendly error handling systems** using RxJS. You will learn to create global error boundaries, implement intelligent recovery strategies, and design production-grade error management.

**Estimated Total Time:** 110–130 minutes  
**Difficulty:** Intermediate to Advanced  
**Prerequisites:** Modules 01–06 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Design proper error boundaries in reactive streams
- Implement multiple recovery patterns (`catchError`, `retry`, `retryWhen`)
- Build a global error handling system
- Create user-friendly error experiences
- Design resilient applications that recover gracefully from failures

---

## Lesson 7.1: Error Boundaries in Reactive Streams

**Estimated Time:** 20 minutes

### Why Error Boundaries Matter
In RxJS, an unhandled error **terminates the entire stream**. Without proper boundaries, one error can bring down large parts of your application.

### The Problem

```ts
source$.pipe(
  map(value => value.nonExistentProperty.foo), // throws
  map(value => value.toUpperCase())
).subscribe({
  next: v => console.log(v),
  error: err => console.error('Stream is now DEAD:', err)
}); // no further values will ever arrive
```

Once `error` fires, the stream is finished — `complete` will never come, and no later value can be emitted.

### Where a Boundary Goes
`catchError` is the boundary. **Its position decides what it protects.** Anything *upstream* of the `catchError` is inside the boundary; anything downstream is not.

```ts
source$.pipe(
  riskyOperator(),
  catchError(err => of(FALLBACK)),  // protects riskyOperator above it
  map(x => x + 1)                   // NOT protected — errors here still escape
).subscribe();
```

### Mental Model
> A `catchError` is a try/catch wrapped around **everything above it in the pipe**. Place it where you want the "try" to end.

### Inner vs Outer Boundaries
You met this in Modules 05–06: in a flattened stream, a `catchError` on the **inner** Observable isolates a single failure, while one on the **outer** stream kills everything after the first error. Choose deliberately.

### Common Mistake
**A single `catchError` at the very end of a long pipe.** It "handles errors," but it also means the *whole* pipeline dies on the first failure and restarts from nothing. Often you want a narrower boundary closer to the risky step.

### Quick Exercise
Add a `catchError` to the broken pipeline above so the stream emits `'FALLBACK'` instead of dying. Then move it *below* the second `map` and observe that a throw there is no longer caught.

**Key Takeaway:** An error ends a stream; `catchError` is a boundary protecting everything upstream of it — its placement is the design decision.

---

## Lesson 7.2: Recovery Patterns – catchError, retry, retryWhen

**Estimated Time:** 24 minutes

### catchError — Replace, Rethrow, or Fall Back
`catchError` receives the error and the source, and must return a **new Observable**. You have three moves:

```ts
// 1) Replace with a default value
stream$.pipe(catchError(() => of([])));

// 2) Fall back to another stream (e.g. cache)
fetchFresh$.pipe(catchError(() => fetchFromCache$));

// 3) Rethrow (transform, then let it propagate)
stream$.pipe(catchError(err => throwError(() => new AppError(err))));
```

### catchError (marble)

```text
source: --1--2--X
            catchError(() => of(9))
output: --1--2--(9|)   (error replaced by a value, then completes)
```

### retry — Resubscribe to the Whole Source
`retry(n)` re-subscribes to the source up to `n` times when it errors. Useful for transient failures (flaky network):

```text
source:  --1--X
             retry(1)
output:  --1----1--X   (re-runs once, then gives up and errors)
```

> **Caution:** `retry` re-runs the **entire** source. If the source has side effects (a `POST`), retrying repeats them.

### retry with Delay & Backoff (Modern RxJS 7)
The config form replaces most uses of `retryWhen`:

```ts
import { retry, timer } from 'rxjs';

stream$.pipe(
  retry({
    count: 3,
    delay: (error, retryCount) => timer(retryCount * 1000) // 1s, 2s, 3s backoff
  })
);
```

### retryWhen (Legacy) and onErrorResumeNext
`retryWhen` is **deprecated** in RxJS 7.8+; prefer `retry({ count, delay })` above. For reference, the legacy pattern drove retries from a notifier Observable. Separately, `onErrorResumeNext` swallows errors and moves to the next source — handy for "try these in order, ignore failures":

```ts
import { onErrorResumeNext, of } from 'rxjs';

// Subscribes to each in turn; an error just advances to the next.
onErrorResumeNext(primary$, secondary$, of('default')).subscribe(render);
```

### Circuit Breaker (Preview)
For repeated failures, retrying forever is harmful. A **circuit breaker** stops trying for a cool-down after N failures — we build a full one in Module 08. Error handling and resilience are two halves of the same coin.

### Common Mistake
**Retrying non-idempotent writes.** `retry` on a `POST`/`PUT` can double-charge a customer. Retry reads freely; for writes, ensure idempotency (or do not retry).

### Quick Exercise
Give a flaky `ajax.getJSON(...)` three retries with exponential backoff (1s, 2s, 4s) using `retry({ count, delay })`, then a final `catchError` returning `of({ items: [] })`.

**Key Takeaway:** `catchError` recovers (replace/fallback/rethrow), `retry({ count, delay })` re-attempts transient failures with backoff, and `onErrorResumeNext` skips failures — never retry non-idempotent writes.

---

## Lesson 7.3: Global Error Handling System Design

**Estimated Time:** 22 minutes

### Why Centralize?
Scattering `catchError` everywhere leads to inconsistent UX and duplicated logic. A **global error system** gives you one place to classify errors, decide retry policy, log, and notify the user.

### The Error Bus
A shared `Subject` is the backbone — any stream can report to it, and one subscriber decides what to do:

```ts
import { Subject } from 'rxjs';

export interface AppError {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'fatal';
  context?: unknown;
}

export const errorBus$ = new Subject<AppError>();

// Report from anywhere:
stream$.pipe(
  catchError(err => {
    errorBus$.next({ code: 'LOAD_FAIL', message: 'Could not load data', severity: 'warning' });
    return of(FALLBACK);
  })
).subscribe();
```

### A Reusable Boundary Operator
Wrap the reporting logic into a domain operator (Module 04) so every feature handles errors the same way:

```ts
import { pipe } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const reportAndFallback = <T>(fallback: T, code: string) =>
  pipe(
    catchError((err: unknown) => {
      errorBus$.next({ code, message: humanize(err), severity: 'warning', context: err });
      return of(fallback);
    })
  );

// Usage stays clean and consistent:
data$.pipe(reportAndFallback([], 'DATA_LOAD')).subscribe(render);
```

### Classify, Then Decide
Route by error type so policy lives in one place:

| Error class | Example | Policy |
|-------------|---------|--------|
| Transient   | network blip, 503 | retry with backoff |
| Auth        | 401 / 403 | redirect to login / show message |
| Validation  | 400 | show inline field errors |
| Fatal       | 500 / unknown | toast + log + degrade |

### Common Mistake
**Letting the error bus subscriber throw.** If the central handler itself errors, it completes and stops handling future errors. Keep it defensive, and never let it die.

### Quick Exercise
Write a `classify(err)` function returning one of `'transient' | 'auth' | 'validation' | 'fatal'`, and a switch in the `errorBus$` subscriber that picks the UX for each.

**Key Takeaway:** Centralize error handling through an error-bus `Subject` and a reusable boundary operator, then classify errors to drive consistent policy and UX.

---

## Lesson 7.4: Logging, Telemetry, and User-Friendly Error UX

**Estimated Time:** 20 minutes

### Two Audiences for Every Error
An error has two readers: the **developer** (needs detail, stack, context for telemetry) and the **user** (needs a calm, actionable message). Serve both.

### Logging / Telemetry
Tap the error bus for observability without touching feature code:

```ts
errorBus$.subscribe(err => {
  console.error(`[${err.code}]`, err.context);     // dev console
  telemetry.capture(err.code, { severity: err.severity }); // Sentry/Datadog/etc.
});
```

### User-Friendly Error UX Patterns
Match the UI to severity — never dump a stack trace on a user:

| Pattern | When to use |
|---------|-------------|
| **Toast / snackbar** | Transient, non-blocking ("Couldn't refresh — retrying") |
| **Inline error** | Field/section-specific (form validation, a failed widget) |
| **Modal / full-page** | Fatal, blocking ("Something went wrong — reload") |
| **Silent + degrade** | Recoverable with fallback (serve cached data, log only) |

### Friendly Messages
Translate codes to humane copy; keep the technical detail for logs:

```ts
const MESSAGES: Record<string, string> = {
  LOAD_FAIL: 'We couldn’t load this right now. Please try again.',
  OFFLINE:   'You appear to be offline. We’ll retry automatically.',
};
const humanize = (code: string) => MESSAGES[code] ?? 'Something went wrong.';
```

### Common Mistake
**Showing raw errors to users** (`[object Object]`, stack traces, `undefined is not a function`). It erodes trust and leaks internals. Always map to friendly copy.

### Quick Exercise
Pick the right UI pattern for each: (a) a background auto-refresh failed, (b) the entire app failed to boot, (c) an email field is invalid, (d) the avatar image service is down but you have a default avatar.

**Key Takeaway:** Serve developers rich telemetry and users calm, severity-appropriate UI (toast / inline / modal / silent-degrade) — never show raw errors.

---

## Lesson 7.5: Project Workshop – Global Error System for Enterprise Apps

**Estimated Time:** 30 minutes

### Project Goal

Build a small app demonstrating a **production-style global error system**:

- A flaky simulated API you can make fail at will
- A reusable boundary that **retries with backoff**, then **falls back** to cached data
- A central **error bus** that drives **toast** notifications and logs telemetry
- **Inline** degraded state when data is served from fallback
- `exhaustMap` so rapid clicks don't stack requests

### Why This Project Matters

This is the full loop: a stream fails, retries with backoff, degrades gracefully, reports to a central bus, and the bus turns it into calm user-facing UX. It is exactly the architecture real apps use.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; a load button, a fail-rate slider, a data panel, a toast stack, and a log.
2. **Error bus** — a `Subject`; one subscriber renders toasts + appends to the log.
3. **Flaky request** — `defer` + `timer`, throwing based on the fail rate.
4. **Recovery** — `retry({ count, delay: backoff })`, then `catchError` reports to the bus and returns cached data.
5. **Render** — success vs degraded (inline) state; `exhaustMap` guards the button.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Global Error System • RxJS</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
  <style>
    .toast { animation: slidein 0.25s ease; }
    @keyframes slidein { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-2xl mx-auto p-8">
    <h1 class="text-3xl font-semibold tracking-tight mb-1">Global Error System</h1>
    <p class="text-zinc-400 mb-6">Retry → fallback → central error bus → toast UX</p>

    <div class="flex flex-wrap items-center gap-4 mb-6">
      <button id="load"
              class="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 rounded-xl
                     disabled:opacity-50 disabled:cursor-not-allowed">
        Load Data
      </button>
      <label class="flex items-center gap-2 text-sm text-zinc-400">
        Fail rate <span id="rateVal" class="font-mono text-zinc-200">60%</span>
        <input id="rate" type="range" min="0" max="100" value="60" step="10">
      </label>
    </div>

    <!-- Data panel -->
    <div id="panel" class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 min-h-[96px]">
      <span class="text-zinc-600">Click “Load Data”.</span>
    </div>

    <!-- Log -->
    <div class="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Telemetry Log</div>
    <div id="log" class="bg-black/40 border border-zinc-800 rounded-xl p-3 h-32 overflow-auto font-mono text-xs text-zinc-400 space-y-1"></div>
  </div>

  <!-- Toast stack -->
  <div id="toasts" class="fixed top-4 right-4 space-y-2 w-72"></div>

  <script>
    const { fromEvent, of, timer, defer, throwError, Subject } = rxjs;
    const { exhaustMap, retry, catchError, tap, finalize } = rxjs.operators;

    const loadBtn = document.getElementById('load');
    const rate = document.getElementById('rate');
    const rateVal = document.getElementById('rateVal');
    const panel = document.getElementById('panel');
    const logEl = document.getElementById('log');
    const toastsEl = document.getElementById('toasts');

    rate.addEventListener('input', () => rateVal.textContent = rate.value + '%');

    // --- Friendly messages ---
    const MESSAGES = {
      LOAD_FAIL: 'We couldn’t load fresh data. Showing the last known version.',
    };
    const humanize = code => MESSAGES[code] || 'Something went wrong.';

    // === Global error bus ===
    const errorBus$ = new Subject();
    errorBus$.subscribe(err => {            // ONE place: toast + telemetry log
      showToast(err);
      log(`[${err.severity}] ${err.code}: ${err.context || ''}`);
    });

    function showToast(err) {
      const colour = err.severity === 'fatal' ? 'red' : 'amber';
      const el = document.createElement('div');
      el.className = `toast bg-${colour}-500/15 border border-${colour}-500 text-${colour}-200 rounded-xl px-4 py-3 text-sm shadow-lg`;
      el.textContent = humanize(err.code);
      toastsEl.appendChild(el);
      timer(3500).subscribe(() => el.remove());   // auto-dismiss (RxJS timer)
    }

    function log(msg) {
      const line = document.createElement('div');
      line.textContent = `${new Date().toLocaleTimeString()}  ${msg}`;
      logEl.prepend(line);
    }

    // --- A cache for graceful degradation ---
    let cache = { value: 'Seed data (cached)', fresh: false };

    // --- Flaky simulated request ---
    function flakyRequest() {
      return defer(() => {
        const failRate = Number(rate.value) / 100;
        log('request → /api/data');
        return timer(500).pipe(
          tap(() => {
            if (Math.random() < failRate) throw { status: 503, message: 'Service Unavailable' };
          })
        );
      });
    }

    // === Load pipeline ===
    fromEvent(loadBtn, 'click').pipe(
      exhaustMap(() => {                       // guard: ignore clicks while in-flight
        loadBtn.disabled = true;
        panel.innerHTML = `<span class="text-zinc-500 animate-pulse">Loading…</span>`;
        return flakyRequest().pipe(
          retry({ count: 2, delay: (err, n) => { log(`retry #${n} after ${n * 600}ms`); return timer(n * 600); } }),
          tap(() => { cache = { value: 'Fresh data from server ✓', fresh: true }; }), // success → fresh
          catchError(err => {                  // exhausted retries → degrade
            errorBus$.next({ code: 'LOAD_FAIL', severity: 'warning', context: err.status });
            return of('fallback');
          }),
          finalize(() => { loadBtn.disabled = false; })
        );
      })
    ).subscribe(() => render());

    function render() {
      if (cache.fresh) {
        panel.innerHTML = `<div class="text-emerald-400 text-lg font-medium">${cache.value}</div>
                           <div class="text-xs text-zinc-500 mt-1">Loaded successfully.</div>`;
      } else {
        // Inline degraded state (served from cache after failure)
        panel.innerHTML = `<div class="text-amber-300 text-lg font-medium">${cache.value}</div>
                           <div class="text-xs text-amber-500/80 mt-1">⚠ Degraded — showing cached data after a failed load.</div>`;
      }
      cache.fresh = false; // reset freshness flag for the next attempt
    }

    log('system ready');
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **One boundary, reused** — every load goes through `retry → catchError`, so behavior is consistent.
- **Failures become UX, not crashes** — `catchError` reports to the bus and returns cached data; the app degrades instead of dying.
- **The error bus decouples reporting from handling** — features just call `errorBus$.next(...)`; the single subscriber owns toasts + telemetry.
- **`exhaustMap` + `finalize`** — rapid clicks are ignored while loading, and the button always re-enables (success or failure).

### Stretch Goals (Recommended Practice)

1. Add a `severity: 'fatal'` path that opens a modal instead of a toast (e.g. on HTTP 500).
2. Classify errors (`transient`/`auth`/`validation`/`fatal`) and pick the retry policy + UI per class (Lesson 7.3).
3. Add an offline detector (`fromEvent(window, 'offline'/'online')`) that pauses requests and toasts the status.
4. Pipe `errorBus$` to a real telemetry endpoint with `bufferTime` batching.

### Deliverable

A working app that retries flaky requests with backoff, degrades to cached data on failure, and routes every error through a central bus into toasts and a telemetry log.

**Key Takeaway:** You built a global error system — boundary operator, error bus, backoff retry, graceful degradation, and severity-appropriate UX — the backbone of resilient enterprise apps.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What happens to an Observable when an unhandled error occurs?
   - A) It skips the bad value and continues
   - B) The entire stream terminates and emits no further values
   - C) It automatically retries
   - D) It completes successfully

2. A `catchError` placed in the middle of a pipe protects which part?
   - A) Everything downstream of it
   - B) Only the `subscribe` callback
   - C) Everything upstream of it
   - D) The entire pipe regardless of position

3. Which is the modern, recommended way to retry with a growing delay in RxJS 7?
   - A) `retry({ count, delay })`
   - B) A `for` loop around `subscribe`
   - C) `retryWhen` with a custom notifier
   - D) `catchError` calling itself recursively

4. Why must you be careful using `retry` on a `POST` request?
   - A) `retry` doesn't work with HTTP
   - B) `POST` requests cannot error
   - C) `retry` only works on `GET`
   - D) Retrying re-runs the source, which can repeat a non-idempotent side effect (e.g. double-charge)

5. In the Global Error System project, what is the role of the `errorBus$` Subject?
   - A) It caches successful responses
   - B) It decouples error *reporting* from error *handling* — features report to it; one subscriber owns toasts + telemetry
   - C) It retries failed requests automatically
   - D) It replaces the need for `catchError`

**Correct Answers:** 1-B, 2-C, 3-A, 4-D, 5-B

**Explanations:**
- Q1: An error is terminal — the stream ends and will never emit `next` or `complete` afterward.
- Q2: `catchError` behaves like a try/catch around everything *above* it; downstream errors escape it.
- Q3: `retry({ count, delay })` is the modern config form; `retryWhen` is deprecated in RxJS 7.8+.
- Q4: `retry` re-subscribes to the whole source, repeating side effects — dangerous for non-idempotent writes.
- Q5: The error-bus `Subject` centralizes handling: any stream reports to it, and a single subscriber decides the UX and telemetry.

---

## Module Summary & Next Steps

You can now handle failure like a production engineer:
- Error boundaries and how `catchError` placement defines what it protects
- Recovery patterns: `catchError` (replace/fallback/rethrow), `retry({ count, delay })` with backoff, `onErrorResumeNext`, and why `retryWhen` is legacy
- A global error system: an error-bus `Subject`, a reusable boundary operator, and error classification
- Telemetry for developers and calm, severity-appropriate UX (toast / inline / modal / degrade) for users

**Next Module:** Module 08 – Retry & Resilience (exponential backoff, the circuit breaker pattern, fallback Observables, and building a resilient API client)

**Recommended Practice:** Extend the project with error classification and a fatal-error modal, and batch telemetry to a mock endpoint with `bufferTime`.

---

*Improved Module 07 v2.0 – Part of the RxJS Mastery Professional Course*

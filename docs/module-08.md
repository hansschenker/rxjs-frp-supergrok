# Module 08: Retry & Resilience

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

Building resilient applications that can survive network failures, API rate limits, and temporary outages is a critical skill. This module teaches you how to implement **exponential backoff**, **circuit breaker patterns**, and other resilience strategies using RxJS. These techniques are essential for production-grade applications.

**Estimated Total Time:** 115–135 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Modules 01–07 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Implement exponential backoff retry strategies
- Build circuit breaker patterns for fault tolerance
- Create resilient API clients
- Handle transient failures gracefully
- Design systems that degrade gracefully under load

---

## Lesson 8.1: Exponential Backoff Strategies

**Estimated Time:** 22 minutes

### Why Exponential Backoff?
When an API fails, immediately retrying can make the problem worse (especially during outages or rate limiting). **Exponential backoff** waits progressively longer between attempts — 1s, 2s, 4s, 8s — giving the system time to recover and avoiding a retry storm.

### Modern RxJS 7 — Use `retry({ count, delay })`
The old `retryWhen` approach is **deprecated** in RxJS 7.8+. The config form expresses backoff directly:

```ts
import { retry, timer } from 'rxjs';

source$.pipe(
  retry({
    count: 5,
    delay: (error, retryCount) => {
      const backoff = Math.pow(2, retryCount - 1) * 1000; // 1s, 2s, 4s, 8s, 16s
      return timer(backoff);
    }
  })
);
```

> `retryCount` is **1-based** (first retry = 1). `delay` returns an Observable; when it emits, the retry fires.

### Add Jitter (Avoid the Thundering Herd)
If 10,000 clients all back off on the same schedule, they retry in synchronized waves and hammer the server simultaneously. **Jitter** randomizes the delay to spread the load:

```ts
delay: (error, retryCount) => {
  const base = Math.pow(2, retryCount - 1) * 1000;
  const jitter = Math.random() * 300;          // 0–300ms of randomness
  return timer(base + jitter);
}
```

### Retry Only What's Retryable
Not every error deserves a retry. A `404` or `400` will fail again identically; only retry **transient** failures (network, `5xx`, timeout):

```ts
delay: (error, retryCount) => {
  if (retryCount > 4 || !isTransient(error)) {
    throw error;                  // stop retrying — propagate the error
  }
  return timer(Math.pow(2, retryCount - 1) * 1000);
}
```

### Common Mistake
**Retrying everything, forever.** Unbounded retries on a permanent failure (bad auth, 404) waste resources and hide bugs. Cap the count and gate on whether the error is transient.

### Quick Exercise
Write a `backoff(maxRetries, baseMs)` helper returning a `retry` config with exponential delay + jitter that stops early on non-transient errors. (You will reuse it in the project.)

**Key Takeaway:** Use `retry({ count, delay })` with exponential backoff **plus jitter**, and only retry transient errors — never retry forever or retry permanent failures.

---

## Lesson 8.2: The Circuit Breaker Pattern in RxJS

**Estimated Time:** 26 minutes

### The Problem Backoff Doesn't Solve
Backoff helps a *single* call survive a blip. But if a dependency is genuinely **down**, every call still tries (and waits, and fails). A **circuit breaker** stops calling a failing service entirely for a cool-down period, so you fail *fast* instead of piling up doomed requests.

### The Three States

```text
        failures >= threshold
 CLOSED ─────────────────────────► OPEN
   ▲                                 │  cooldown elapsed
   │ success                         ▼
   └─────────── HALF-OPEN ◄──────────┘
        one trial request:
          success → CLOSED
          failure → OPEN (restart cooldown)
```

- **CLOSED** — normal. Calls pass through; consecutive failures are counted.
- **OPEN** — tripped. Calls fail immediately (no network hit) until the cooldown elapses.
- **HALF-OPEN** — probing. One trial call is allowed; success closes the circuit, failure re-opens it.

### A Reusable Circuit Breaker
It wraps a request factory and returns an Observable, tracking state and metrics:

```ts
import { defer, throwError, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export function createCircuitBreaker(opts: { threshold: number; cooldownMs: number }) {
  let state: BreakerState = 'CLOSED';
  let failures = 0;
  let openedAt = 0;
  const metrics = { success: 0, failure: 0, rejected: 0 };

  function exec<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => {
      if (state === 'OPEN') {
        if (Date.now() - openedAt >= opts.cooldownMs) {
          state = 'HALF_OPEN';                  // time to probe
        } else {
          metrics.rejected++;
          return throwError(() => ({ code: 'CIRCUIT_OPEN' })); // fail fast
        }
      }
      return request().pipe(
        tap(() => { failures = 0; state = 'CLOSED'; metrics.success++; }), // recovered
        catchError(err => {
          failures++;
          metrics.failure++;
          if (state === 'HALF_OPEN' || failures >= opts.threshold) {
            state = 'OPEN';
            openedAt = Date.now();
            failures = 0;
          }
          return throwError(() => err);
        })
      );
    });
  }

  return { exec, getState: () => state, getMetrics: () => ({ ...metrics }) };
}
```

### Metrics & Monitoring
A breaker is only useful if you can *see* it. Expose `state` and counts (success / failure / rejected) so you can alert when a circuit opens — a tripped breaker in production is a signal that a dependency is failing.

### Common Mistake
**Counting failures forever in CLOSED state.** Use *consecutive* failures (reset to zero on any success), or a rolling time window — otherwise occasional, unrelated failures slowly trip the breaker for no good reason.

### Quick Exercise
Trace the state for `threshold: 2`: a request fails, fails again, then two calls happen during cooldown, then cooldown elapses and a call succeeds. Write down the state after each step.

**Key Takeaway:** A circuit breaker (CLOSED → OPEN → HALF-OPEN) fails fast when a dependency is down, then probes for recovery — pair it with backoff and expose its state as a monitoring signal.

---

## Lesson 8.3: Combining Retry with Fallback Observables

**Estimated Time:** 20 minutes

### The Resilience Ladder
Production resilience layers strategies, from cheapest to last-resort:

1. **Backoff retry** — survive a transient blip.
2. **Circuit breaker** — stop hammering a down dependency.
3. **Fallback** — serve cached/default/stale data so the user still sees *something*.
4. **Graceful message** — if all else fails, a calm error (Module 07).

```ts
breaker.exec(() => fetchFresh(id)).pipe(
  retry({ count: 2, delay: (e, n) => timer(2 ** (n - 1) * 500) }), // 1: backoff
  catchError(() => fetchFromCache(id)),                            // 3: fallback stream
  catchError(() => of(DEFAULT))                                    // 4: last resort
);
```

### Fallback to a Stream, Not Just a Value
`catchError` can return any Observable — a cache lookup, a secondary endpoint, or a static default. Chaining `catchError`s creates a fallback *cascade*.

### Combining with Domain Operators
Resilience composes with the domain operators from Module 04 — wrap a domain stream in a resilient boundary:

```ts
// payment.operators.ts — resilient by construction
export const submitPayment = (api: PaymentApi) => (order$: Observable<Order>) =>
  order$.pipe(
    concatMap(order =>                       // ordered: never overlap payments
      api.charge(order).pipe(
        retry({ count: 2, delay: (e, n) => timer(2 ** n * 1000) }),
        catchError(err => of({ order, status: 'needs_review', err }))
      )
    )
  );
```

> Note `concatMap` (not `switchMap`) for payments: writes must never be cancelled or run out of order. Resilience and correctness go together.

### Real-World: Inventory & Payments
- **Inventory check** (read): backoff retry → fallback to last-known stock → show "approx".
- **Payment** (write): `concatMap` + bounded retry → on failure, queue for review (never silently drop or double-charge).

### Common Mistake
**Falling back to stale data silently for writes.** Fallbacks are great for *reads*. For writes, a "fallback" usually means *queue and flag for reconciliation*, not pretend-success.

### Quick Exercise
Build a `resilientGet(url)` that applies backoff retry, then falls back to a `localStorage` cache, then to a default — three layers via chained `catchError`.

**Key Takeaway:** Layer resilience — backoff, then circuit breaker, then fallback streams — but treat reads (serve stale) and writes (queue for review) differently.

---

## Lesson 8.4: Resilience Testing and Chaos Engineering

**Estimated Time:** 18 minutes

### You Can't Trust Untested Resilience
Resilience code runs exactly when things are going wrong — the worst time to discover it has a bug. So you must **deliberately inject failures** and assert the system copes.

### A Chaos Wrapper
Wrap any request with injectable failure and latency for local testing:

```ts
import { defer, throwError, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

const chaos = <T>(req: () => Observable<T>, failRate = 0.5, latencyMs = 0) =>
  defer(() =>
    timer(latencyMs).pipe(
      mergeMap(() => (Math.random() < failRate
        ? throwError(() => ({ status: 503 }))
        : req()))
    )
  );
```

### Deterministic Time with TestScheduler
Backoff delays would make unit tests slow and flaky. The `TestScheduler` runs virtual time instantly, so you can assert retry timing precisely:

```ts
import { TestScheduler } from 'rxjs/testing';

const scheduler = new TestScheduler((a, e) => expect(a).toEqual(e));

scheduler.run(({ cold, expectObservable }) => {
  const source = cold('--#');                 // errors immediately
  const result = source.pipe(retry({ count: 1 }));
  // assert it re-subscribes and the timing matches your expectation
  expectObservable(result).toBe('----#');     // (illustrative)
});
```

### Chaos Engineering (Beyond Unit Tests)
In staging/production, controlled chaos (random latency, injected 500s, killed instances) validates that breakers trip, backoffs space out, and fallbacks serve — *before* a real outage does it for you.

### Common Mistake
**Real timers in resilience tests.** A test that actually waits 1s + 2s + 4s for backoff is slow and flaky. Use `TestScheduler` (or inject a scheduler) so time is virtual.

### Quick Exercise
Use the `chaos` wrapper with `failRate: 1` (always fails) and confirm your circuit breaker opens after `threshold` calls and then rejects with `CIRCUIT_OPEN`.

**Key Takeaway:** Test resilience by injecting failures (chaos wrapper) and using `TestScheduler` for instant, deterministic backoff timing — untested resilience is a liability.

---

## Lesson 8.5: Project Workshop – Resilient API Client with Full Retry Logic

**Estimated Time:** 30 minutes

### Project Goal

Build a **resilient API client** wrapping a flaky endpoint, combining everything in this module:

- **Exponential backoff** retry on each call
- A **circuit breaker** (CLOSED → OPEN → HALF-OPEN) that fails fast when the endpoint is down
- **Fallback** to cached data when a call ultimately fails
- Live **circuit state**, **metrics** (success / failure / rejected), and a **request/response log**
- A fail-rate slider and an auto-fire mode to watch the breaker trip and recover

### Why This Project Matters

This is a miniature of how production clients work. Crank the fail rate up and watch the breaker trip to OPEN and start failing fast; lower it and watch HALF-OPEN probe and recover to CLOSED. You are seeing resilience as a living state machine.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; controls, a state badge, metrics, and a log.
2. **Circuit breaker** — the state machine from Lesson 8.2, with metrics.
3. **Flaky request** — `defer` + `timer`, throwing based on the fail rate.
4. **Pipeline** — `concatMap` over a fire stream → `breaker.exec` (with internal backoff retry) → `catchError` fallback.
5. **Render** — update the state badge, metrics, and log on every result; tick a cooldown countdown.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resilient API Client • RxJS</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-2xl mx-auto p-8">
    <h1 class="text-3xl font-semibold tracking-tight mb-1">Resilient API Client</h1>
    <p class="text-zinc-400 mb-6">Backoff retry + circuit breaker + fallback</p>

    <!-- Controls -->
    <div class="flex flex-wrap items-center gap-4 mb-6">
      <button id="send"
              class="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 rounded-xl">
        Send Request
      </button>
      <label class="flex items-center gap-2 text-sm text-zinc-400">
        <input id="auto" type="checkbox"> Auto-fire
      </label>
      <label class="flex items-center gap-2 text-sm text-zinc-400 ml-auto">
        Fail rate <span id="rateVal" class="font-mono text-zinc-200">70%</span>
        <input id="rate" type="range" min="0" max="100" value="70" step="10">
      </label>
    </div>

    <!-- State + metrics -->
    <div class="grid grid-cols-4 gap-3 mb-6">
      <div id="stateCard" class="col-span-1 rounded-xl p-3 text-center border bg-zinc-900 border-zinc-800">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Circuit</div>
        <div id="stateVal" class="text-lg font-bold mt-1">CLOSED</div>
        <div id="cooldown" class="text-xs text-zinc-500 mt-0.5">&nbsp;</div>
      </div>
      <div class="rounded-xl p-3 text-center bg-zinc-900 border border-zinc-800">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Success</div>
        <div id="mSuccess" class="text-2xl font-semibold mt-1 text-emerald-400">0</div>
      </div>
      <div class="rounded-xl p-3 text-center bg-zinc-900 border border-zinc-800">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Failure</div>
        <div id="mFailure" class="text-2xl font-semibold mt-1 text-red-400">0</div>
      </div>
      <div class="rounded-xl p-3 text-center bg-zinc-900 border border-zinc-800">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Rejected</div>
        <div id="mRejected" class="text-2xl font-semibold mt-1 text-amber-400">0</div>
      </div>
    </div>

    <div class="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Request / Response Log</div>
    <div id="log" class="bg-black/40 border border-zinc-800 rounded-xl p-3 h-44 overflow-auto font-mono text-xs space-y-1"></div>
  </div>

  <script>
    const { defer, throwError, timer, of, interval, Subject } = rxjs;
    const { concatMap, retry, tap, catchError, map } = rxjs.operators;

    const sendBtn = document.getElementById('send');
    const autoBox = document.getElementById('auto');
    const rate = document.getElementById('rate');
    const rateVal = document.getElementById('rateVal');
    const stateVal = document.getElementById('stateVal');
    const stateCard = document.getElementById('stateCard');
    const cooldownEl = document.getElementById('cooldown');
    const mSuccess = document.getElementById('mSuccess');
    const mFailure = document.getElementById('mFailure');
    const mRejected = document.getElementById('mRejected');
    const logEl = document.getElementById('log');
    const textClass = {
      zinc: 'text-zinc-400',
      emerald: 'text-emerald-400',
      amber: 'text-amber-400',
      red: 'text-red-400'
    };
    const stateTheme = {
      CLOSED: {
        card: 'col-span-1 rounded-xl p-3 text-center border bg-emerald-500/10 border-emerald-500',
        value: 'text-lg font-bold mt-1 text-emerald-300'
      },
      HALF_OPEN: {
        card: 'col-span-1 rounded-xl p-3 text-center border bg-amber-500/10 border-amber-500',
        value: 'text-lg font-bold mt-1 text-amber-300'
      },
      OPEN: {
        card: 'col-span-1 rounded-xl p-3 text-center border bg-red-500/10 border-red-500',
        value: 'text-lg font-bold mt-1 text-red-300'
      }
    };

    rate.addEventListener('input', () => rateVal.textContent = rate.value + '%');

    function log(msg, colour = 'zinc') {
      const line = document.createElement('div');
      line.className = textClass[colour] || textClass.zinc;
      line.textContent = `${new Date().toLocaleTimeString()}  ${msg}`;
      logEl.prepend(line);
    }

    // === Circuit Breaker (Lesson 8.2) ===
    function createCircuitBreaker({ threshold, cooldownMs }) {
      let state = 'CLOSED', failures = 0, openedAt = 0;
      const metrics = { success: 0, failure: 0, rejected: 0 };
      function exec(request) {
        return defer(() => {
          if (state === 'OPEN') {
            if (Date.now() - openedAt >= cooldownMs) { state = 'HALF_OPEN'; log('circuit → HALF_OPEN (probing)', 'amber'); }
            else { metrics.rejected++; return throwError(() => ({ code: 'CIRCUIT_OPEN' })); }
          }
          return request().pipe(
            tap(() => {
              if (state !== 'CLOSED') log('circuit → CLOSED (recovered)', 'emerald');
              failures = 0; state = 'CLOSED'; metrics.success++;
            }),
            catchError(err => {
              failures++; metrics.failure++;
              if (state === 'HALF_OPEN' || failures >= threshold) {
                state = 'OPEN'; openedAt = Date.now(); failures = 0;
                log(`circuit → OPEN (cooldown ${cooldownMs}ms)`, 'red');
              }
              return throwError(() => err);
            })
          );
        });
      }
      return { exec, getState: () => state, getMetrics: () => metrics, openedAt: () => openedAt, cooldownMs };
    }

    const breaker = createCircuitBreaker({ threshold: 3, cooldownMs: 5000 });

    // === Flaky request ===
    function flakyRequest() {
      return defer(() => {
        const failRate = Number(rate.value) / 100;
        return timer(350).pipe(
          map(() => {
            if (Math.random() < failRate) throw { status: 503, message: 'Service Unavailable' };
            return { ok: true, data: 'payload-' + Math.floor(Math.random() * 1000) };
          })
        );
      });
    }

    let cache = { data: 'cached-seed' };

    // === Fire stream: button + auto-fire both push here; concatMap serializes ===
    const fire$ = new Subject();
    sendBtn.addEventListener('click', () => fire$.next());

    let autoSub = null;
    autoBox.addEventListener('change', () => {
      if (autoBox.checked) { autoSub = interval(900).subscribe(() => fire$.next()); }
      else if (autoSub) { autoSub.unsubscribe(); autoSub = null; }
    });

    fire$.pipe(
      concatMap(() => {
        log('→ request');
        return breaker.exec(() => flakyRequest()).pipe(
          retry({ count: 1, delay: (e, n) => {
            if (e && e.code === 'CIRCUIT_OPEN') throw e;  // don't retry a fast-fail
            log(`  retry #${n} (backoff)`, 'zinc');
            return timer(2 ** (n - 1) * 400);
          } }),
          tap(res => { cache = { data: res.data }; }),
          map(res => ({ outcome: 'success', data: res.data })),
          catchError(err =>
            of({ outcome: err.code === 'CIRCUIT_OPEN' ? 'rejected' : 'fallback', data: cache.data })
          )
        );
      })
    ).subscribe(result => {
      if (result.outcome === 'success')      log(`✓ success: ${result.data}`, 'emerald');
      else if (result.outcome === 'rejected') log('⛔ rejected (circuit OPEN, failed fast)', 'amber');
      else                                    log(`⚠ fallback → cache: ${result.data}`, 'amber');
      renderMetrics();
    });

    function renderMetrics() {
      const m = breaker.getMetrics();
      mSuccess.textContent = m.success;
      mFailure.textContent = m.failure;
      mRejected.textContent = m.rejected;
    }

    // Live state badge + cooldown countdown
    interval(250).subscribe(() => {
      const s = breaker.getState();
      stateVal.textContent = s;
      const theme = stateTheme[s] || stateTheme.CLOSED;
      stateCard.className = theme.card;
      stateVal.className = theme.value;
      if (s === 'OPEN') {
        const remaining = Math.max(0, breaker.cooldownMs - (Date.now() - breaker.openedAt()));
        cooldownEl.textContent = `retry in ${(remaining / 1000).toFixed(1)}s`;
      } else {
        cooldownEl.innerHTML = '&nbsp;';
      }
    });

    log('client ready', 'zinc');
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **Backoff and the breaker are complementary** — backoff handles a blip; the breaker handles a sustained outage by failing fast.
- **The breaker is a state machine** — CLOSED counts failures, OPEN rejects during cooldown, HALF-OPEN probes once and decides.
- **`concatMap` serializes calls** — so the breaker's state transitions are clean and observable (no overlapping requests racing the state).
- **Metrics make resilience visible** — success / failure / rejected counts plus live state are exactly what you'd alert on in production.

### Stretch Goals (Recommended Practice)

1. Add jitter to the backoff and a "transient only" guard so non-`5xx` errors skip retry (Lesson 8.1).
2. Add a rolling-window failure count (last N calls) instead of consecutive failures (Lesson 8.2).
3. Persist the cache to `localStorage` so fallback survives a reload.
4. Add a latency readout per request and chart success rate over time.

### Deliverable

A working resilient client that retries with backoff, trips a circuit breaker under sustained failure, serves cached fallback, and shows live state, metrics, and a request/response log.

**Key Takeaway:** You built a resilient API client combining backoff, a circuit-breaker state machine, and fallback — the production pattern for surviving unreliable dependencies.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What is the main benefit of *exponential* backoff over retrying immediately?
   - A) It gives a struggling service progressively more time to recover and avoids retry storms
   - B) It guarantees the request will eventually succeed
   - C) It makes requests faster
   - D) It removes the need for error handling

2. Why add **jitter** to a backoff delay?
   - A) To make delays longer
   - B) To encrypt the request
   - C) To desynchronize many clients so they don't retry in synchronized waves
   - D) To retry non-transient errors

3. In the circuit breaker pattern, what does the **OPEN** state do?
   - A) Lets all requests through normally
   - B) Fails requests immediately (fast) without calling the dependency, until a cooldown elapses
   - C) Retries the request infinitely
   - D) Permanently disables the feature

4. After the cooldown elapses, which state lets a single trial request through to test recovery?
   - A) CLOSED
   - B) OPEN
   - C) BROKEN
   - D) HALF-OPEN

5. For a **payment** (write) call, which flattening operator and failure handling are appropriate?
   - A) `switchMap` and silent fallback to cached "success"
   - B) `concatMap` with bounded retry, queueing for review on failure
   - C) `switchMap` with infinite retry
   - D) `mergeMap` with no retry and no ordering

**Correct Answers:** 1-A, 2-C, 3-B, 4-D, 5-B

**Explanations:**
- Q1: Exponential backoff spaces attempts out so a struggling service can recover and clients don't pile on — it does not guarantee success.
- Q2: Jitter randomizes delays so thousands of clients don't retry in lockstep (the "thundering herd").
- Q3: OPEN fails fast without hitting the dependency until the cooldown passes — protecting both client and server.
- Q4: HALF-OPEN allows one probe; success returns to CLOSED, failure re-opens the circuit.
- Q5: Payments must not be cancelled or reordered (`concatMap`), must not double-charge (bounded retry), and on failure should queue for review — never fake success.

---

## Module Summary & Next Steps

You can now build systems that survive failure:
- Exponential backoff with jitter via `retry({ count, delay })`, retrying only transient errors
- The circuit breaker state machine (CLOSED → OPEN → HALF-OPEN) with metrics
- The resilience ladder: backoff → breaker → fallback streams → graceful message, with reads vs writes handled differently
- Resilience testing with a chaos wrapper and the `TestScheduler`

**Next Module:** Module 09 – Schedulers Deep Dive (`asyncScheduler`, `animationFrameScheduler`, virtual time, and animation timing)

**Recommended Practice:** Extend the Resilient API Client with jitter, a transient-only retry guard, and a rolling-window failure count, then drive it with the chaos wrapper.

---

*Improved Module 08 v2.0 – Part of the RxJS Mastery Professional Course*

# Module 12: DevTools & Debugging

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

Debugging complex reactive applications can be challenging. This module teaches you how to integrate **Redux DevTools** with RxJS state management, implement action sanitization, and build powerful debugging systems. These tools dramatically improve developer experience and are essential for maintaining large-scale reactive applications.

**Estimated Total Time:** 110–130 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Modules 10–11 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Integrate Redux DevTools with RxJS state
- Implement action and state sanitization
- Build custom DevTools enhancers
- Create a complete state debugging system
- Use time travel debugging effectively

---

## Lesson 12.1: Redux DevTools Integration

**Estimated Time:** 20 minutes

### Why Redux DevTools?
Even if you're not using Redux, the Redux DevTools browser extension is an incredibly powerful debugging tool that works great with custom RxJS state management — an action log, state inspector, and time travel, for free.

### Basic Integration
Connect to the extension (if present), `init` with the initial state, and `send` **the new state after each action**:

```ts
import { Subject } from 'rxjs';
import { scan, startWith, shareReplay, tap } from 'rxjs/operators';

declare const window: any;

const devTools =
  (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__)
    ? window.__REDUX_DEVTOOLS_EXTENSION__.connect({ name: 'RxJS App' })
    : null;

const action$ = new Subject<any>();

export const state$ = action$.pipe(
  scan(todoReducer, initialState),         // compute the NEXT state first
  startWith(initialState),
  tap(state => {
    if (devTools && lastAction) devTools.send(lastAction, state); // skip the initial startWith value
  }),
  shareReplay(1)
);

devTools && devTools.init(initialState);
```

> **Order matters:** compute the next state, *then* send it. The original temptation — sending inside the reducer before it runs — logs the *previous* state against the current action, which is misleading.

### Capturing the Action
`scan` only sees `(state, action)`, so stash the current action (e.g. in a small wrapper) so `tap` can send the matching `(action, state)` pair:

```ts
let lastAction: any;
const dispatch = (a: any) => { lastAction = a; action$.next(a); };
```

### Mental Model
> DevTools can be a subscriber to your state stream for logging/inspection. Full extension-driven time travel also requires subscribing to DevTools messages (`JUMP_TO_STATE`, `RESET`, etc.) and mapping them back to your viewed state.

### Common Mistake
**Assuming DevTools is always there.** The extension may not be installed (or you're in production). Guard every call (`devTools && …`) so the app runs identically with or without it.

### Quick Exercise
Connect a simple counter store to the extension, dispatch a few actions, and watch them appear in the DevTools "Inspector" tab.

**Key Takeaway:** Redux DevTools is a free, drop-in subscriber for any RxJS store — connect, `init`, and `send` the *new* state after each action, always guarded.

---

## Lesson 12.2: Action Sanitization and Lightweight Logging

**Estimated Time:** 22 minutes

### Sanitize Before You Send
Actions and state often carry secrets (tokens, passwords, PII) or huge blobs (file contents, big lists). Never ship those to DevTools or logs — **sanitize** first:

```ts
function sanitizeAction(action: any) {
  if (action.type === 'LOGIN') return { ...action, password: '***' };
  return action;
}
function sanitizeState(state: any) {
  return { ...state, authToken: state.authToken ? '***' : null };
}

// connect with sanitizers
window.__REDUX_DEVTOOLS_EXTENSION__.connect({
  actionSanitizer: sanitizeAction,
  stateSanitizer: sanitizeState,
});
```

### A Lightweight `debug` Operator
For everyday debugging, a tiny reusable operator beats scattering `console.log`s:

```ts
import { tap } from 'rxjs/operators';

const debug = <T>(label: string) => tap<T>({
  subscribe: () => console.log(`[${label}] subscribed`),
  next:      v => console.log(`[${label}] →`, v),
  error:     e => console.log(`[${label}] ✖`, e),
  complete:  () => console.log(`[${label}] ✓ complete`),
  unsubscribe: () => console.log(`[${label}] unsubscribed`),
});

source$.pipe(debug('source'), map(x => x * 2), debug('after map')).subscribe();
```

Because it taps the full observer, you see the **whole lifecycle** — subscribe, each value, error, complete, and unsubscribe — at any point in the pipe.

### Debugging Common RxJS Issues
A field guide to the bugs you will actually hit:

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "Nothing happens" | Never subscribed | A pipe does nothing until `subscribe()` |
| Duplicate HTTP calls | Multiple subscribers to a cold stream | `shareReplay(1)` to multicast |
| Memory leak / growing listeners | Forgotten unsubscribe | `takeUntil` / `take` / composite `Subscription` (Module 02) |
| Stale/out-of-order results | Wrong flattener | `switchMap` for latest-only (Module 05) |
| "Works once, then dead" | An error terminated the stream | `catchError` boundary (Module 07) |
| Values arrive late/missing | Hot vs cold confusion | Inspect with `debug()`; multicast if needed |

### Common Mistake
**Logging raw state/actions in production.** It leaks secrets and floods the console. Gate logging behind an env flag and always sanitize.

### Quick Exercise
Write the `debug(label)` operator and drop it before and after a `filter` to watch which values get dropped.

**Key Takeaway:** Sanitize secrets/PII before sending to DevTools or logs, and use a reusable `debug` tap operator to inspect a stream's full lifecycle.

---

## Lesson 12.3: Custom DevTools Enhancer with Performance Metrics

**Estimated Time:** 22 minutes

### Why a Custom Enhancer?
The extension is great, but you often want **in-app** insight: how long each reducer takes, how many actions fire, and the ability to filter noisy actions. You build this by *wrapping the reducer*.

### Timing the Reducer
```ts
interface Metrics { count: number; totalMs: number; lastMs: number; }
const metrics: Metrics = { count: 0, totalMs: 0, lastMs: 0 };

function withMetrics<S>(reducer: (s: S, a: any) => S) {
  return (state: S, action: any): S => {
    const t0 = performance.now();
    const next = reducer(state, action);
    const dt = performance.now() - t0;
    metrics.count++; metrics.totalMs += dt; metrics.lastMs = dt;
    return next;
  };
}

const state$ = action$.pipe(scan(withMetrics(reducer), initial), startWith(initial), shareReplay(1));
// avg = metrics.totalMs / metrics.count
```

### Action Filtering
Noisy actions (mouse-move, ticks) drown the log. Filter what you record:

```ts
const NOISY = new Set(['MOUSE_MOVE', 'TICK']);
function shouldRecord(action: any) { return !NOISY.has(action.type); }
```

### A Slow-Reducer Warning
Catch performance regressions early:

```ts
if (dt > 4) console.warn(`[perf] ${action.type} reducer took ${dt.toFixed(2)}ms`);
```

> A reducer should be microseconds. If one creeps into milliseconds, you're probably doing expensive work (deep clone, sort, computed data) that belongs in a **selector**, not the reducer.

### Common Mistake
**Doing heavy computation in the reducer.** Reducers run on every action. Derive expensive values lazily in selectors (`map` + `distinctUntilChanged`) so they only recompute when their inputs change.

### Quick Exercise
Add `withMetrics` to a store and log the average reducer time after 100 dispatches. Then add an artificial `for` loop in one case and watch the slow-reducer warning fire.

**Key Takeaway:** Wrap the reducer to capture per-action timing and counts, filter noisy actions, and warn on slow reducers — keep heavy work in selectors, not reducers.

---

## Lesson 12.4: Time Travel Debugging and State Inspection

**Estimated Time:** 20 minutes

### Time Travel as a View Overlay
Time travel (Module 11) and debugging are the same idea: keep every `(action, state)` entry, and let the inspector **view** any past state without changing the live store.

```ts
const entries: { action: any; state: any; ts: number }[] = [];
// record each (action, newState) as it happens
// viewIndex === null → show live state; a number → show entries[i].state
```

The live store keeps running; the inspector just *renders a different index*. Selecting an entry is a `JUMP` over the recorded timeline.

### State Inspection
A good inspector shows: the **current (or selected) state** as formatted JSON, the **diff** from the previous state, and the **action** that caused it. Even a simple JSON dump (`JSON.stringify(state, null, 2)`) is a huge debugging aid.

### Importing / Exporting Sessions
Because state and actions are plain serializable objects, you can **export** a session (the action list) to a file and **replay** it later — invaluable for reproducing a bug a user reported.

```ts
const exportSession = () => JSON.stringify(entries.map(e => e.action));
const replaySession = (json: string) =>
  JSON.parse(json).forEach((action: any) => dispatch(action)); // re-run to rebuild state
```

### Common Mistake
**Mutating recorded states for inspection.** The entries are your history; if the inspector mutates them (e.g. sorting in place for display), you corrupt time travel. Treat recorded state as read-only.

### Quick Exercise
Record `(action, state)` entries for a counter, then add a button that logs `entries[2].state` — the state as it was after the third action.

**Key Takeaway:** Time-travel debugging records every `(action, state)` entry and lets the inspector view any index as a read-only overlay; serializable history enables export/replay of bug sessions.

---

## Lesson 12.5: Project Workshop – Full State Debugging System with DevTools

**Estimated Time:** 30 minutes

### Project Goal

Build a **self-contained DevTools panel** for an RxJS store — no extension required (though it also connects to the real one if installed):

- A small counter store wired through a metrics-capturing enhancer
- An **action log** with **filtering**, **performance metrics** (count / avg / last ms)
- A **state inspector** (formatted JSON)
- **Time travel** — click any logged action to view that state; a "Live" button to return
- Optional bridge to the real Redux DevTools extension

### Why This Project Matters

You will build the *mechanism* behind Redux DevTools in ~90 lines: record `(action, state)`, time the reducer, filter noise, and time-travel by viewing a recorded index. After this, DevTools is no longer magic.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; an app pane and a DevTools pane.
2. **Store** — `action$ → scan(withMetrics(reducer)) → live$`; record each `(action, state)` entry.
3. **Render app** — from the *viewed* state (live, or a time-traveled index).
4. **Render DevTools** — metrics, filtered action log, JSON inspector.
5. **Time travel** — clicking a log entry sets the view index; dispatching returns to live.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RxJS DevTools • State Debugging</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-4xl mx-auto p-8 grid md:grid-cols-2 gap-6">

    <!-- App pane -->
    <div>
      <h1 class="text-2xl font-semibold tracking-tight mb-1">Counter App</h1>
      <p class="text-zinc-400 text-sm mb-4">Dispatch actions; inspect them on the right.</p>
      <div id="display" class="text-6xl font-bold tabular-nums text-center py-8 bg-zinc-900 border border-zinc-800 rounded-2xl mb-4">0</div>
      <div class="grid grid-cols-4 gap-2">
        <button data-act="DEC"   class="bg-zinc-800 border border-zinc-700 rounded-lg py-2">−1</button>
        <button data-act="INC"   class="bg-zinc-800 border border-zinc-700 rounded-lg py-2">+1</button>
        <button data-act="ADD5"  class="bg-zinc-800 border border-zinc-700 rounded-lg py-2">+5</button>
        <button data-act="RESET" class="bg-zinc-800 border border-zinc-700 rounded-lg py-2">Reset</button>
      </div>
      <div id="travelBanner" class="hidden mt-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500 rounded-lg px-3 py-2">
        ⏳ Time-travelling — <button id="live" class="underline">return to live</button>
      </div>
    </div>

    <!-- DevTools pane -->
    <div class="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold uppercase tracking-widest text-zinc-400">DevTools</h2>
        <span id="rdt" class="text-[10px] text-zinc-600"></span>
      </div>

      <!-- Metrics -->
      <div class="grid grid-cols-3 gap-2 mb-3 text-center">
        <div class="bg-zinc-900 rounded-lg p-2"><div class="text-[10px] text-zinc-500 uppercase">Actions</div><div id="mCount" class="text-lg font-semibold">0</div></div>
        <div class="bg-zinc-900 rounded-lg p-2"><div class="text-[10px] text-zinc-500 uppercase">Avg ms</div><div id="mAvg" class="text-lg font-semibold text-sky-400">0.00</div></div>
        <div class="bg-zinc-900 rounded-lg p-2"><div class="text-[10px] text-zinc-500 uppercase">Last ms</div><div id="mLast" class="text-lg font-semibold text-emerald-400">0.00</div></div>
      </div>

      <input id="filter" placeholder="Filter actions…" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm mb-2 placeholder-zinc-600">

      <!-- Action log -->
      <div class="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Action Log (click to time-travel)</div>
      <div id="log" class="h-40 overflow-auto space-y-1 mb-3 font-mono text-xs"></div>

      <!-- Inspector -->
      <div class="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">State Inspector</div>
      <pre id="inspector" class="bg-black/40 border border-zinc-800 rounded-lg p-2 text-xs text-emerald-300 overflow-auto max-h-28"></pre>
    </div>
  </div>

  <script>
    const { Subject, BehaviorSubject, combineLatest } = rxjs;
    const { scan, startWith, shareReplay } = rxjs.operators;

    // --- Reducer ---
    const initial = { count: 0 };
    function reducer(s, a) {
      switch (a.type) {
        case 'INC':   return { count: s.count + 1 };
        case 'DEC':   return { count: s.count - 1 };
        case 'ADD5':  return { count: s.count + 5 };
        case 'RESET': return { count: 0 };
        default:      return s;
      }
    }

    // --- DevTools recording + metrics enhancer ---
    const entries = [{ action: { type: '@@INIT' }, state: initial, ts: Date.now(), ms: 0 }];
    const metrics = { count: 0, totalMs: 0, lastMs: 0 };

    // Optional: bridge to the real Redux DevTools extension if installed
    const rdt = window.__REDUX_DEVTOOLS_EXTENSION__
      ? window.__REDUX_DEVTOOLS_EXTENSION__.connect({ name: 'RxJS Counter' }) : null;
    if (rdt) { rdt.init(initial); document.getElementById('rdt').textContent = '● connected to Redux DevTools'; }

    function withMetrics(reducer) {
      return (state, action) => {
        const t0 = performance.now();
        const next = reducer(state, action);
        const ms = performance.now() - t0;
        metrics.count++; metrics.totalMs += ms; metrics.lastMs = ms;
        entries.push({ action, state: next, ts: Date.now(), ms });
        if (rdt) rdt.send(action, next);
        if (ms > 4) console.warn(`[perf] ${action.type} took ${ms.toFixed(2)}ms`);
        return next;
      };
    }

    // --- Store ---
    const action$ = new Subject();
    const viewIndex$ = new BehaviorSubject(null);  // null = live
    const live$ = action$.pipe(scan(withMetrics(reducer), initial), startWith(initial), shareReplay(1));

    const dispatch = a => { viewIndex$.next(null); action$.next(a); }; // dispatching returns to live

    // Minimal real-extension time-travel bridge: jump messages update the viewed entry.
    if (rdt && rdt.subscribe) {
      rdt.subscribe(message => {
        if (message.type !== 'DISPATCH') return;
        if (message.payload?.type === 'RESET') viewIndex$.next(null);
        if (message.payload?.type === 'JUMP_TO_ACTION') {
          const i = Number(message.payload.actionId);
          if (Number.isInteger(i) && entries[i]) viewIndex$.next(i);
        }
        if (message.payload?.type === 'JUMP_TO_STATE' && message.state) {
          const i = entries.findIndex(e => JSON.stringify(e.state) === message.state);
          if (i >= 0) viewIndex$.next(i);
        }
      });
    }

    // --- Render: viewed state = live OR a time-traveled entry ---
    const display = document.getElementById('display');
    const banner = document.getElementById('travelBanner');
    const inspector = document.getElementById('inspector');

    combineLatest([live$, viewIndex$]).subscribe(([live, vi]) => {
      const viewed = vi === null ? live : entries[vi].state;
      display.textContent = viewed.count;
      display.classList.toggle('text-amber-300', vi !== null);
      banner.classList.toggle('hidden', vi === null);
      inspector.textContent = JSON.stringify(viewed, null, 2);
      renderLog();
      renderMetrics();
    });

    // --- DevTools rendering ---
    const logEl = document.getElementById('log');
    const filterEl = document.getElementById('filter');
    function renderMetrics() {
      document.getElementById('mCount').textContent = metrics.count;
      document.getElementById('mAvg').textContent = (metrics.count ? metrics.totalMs / metrics.count : 0).toFixed(2);
      document.getElementById('mLast').textContent = metrics.lastMs.toFixed(2);
    }
    function renderLog() {
      const f = filterEl.value.toLowerCase();
      const vi = viewIndex$.value;
      logEl.innerHTML = entries
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.action.type.toLowerCase().includes(f))
        .map(({ e, i }) => `
          <div data-i="${i}" class="cursor-pointer px-2 py-1 rounded ${i === vi ? 'bg-amber-500/20 text-amber-200' : 'hover:bg-zinc-800'}">
            <span class="text-zinc-500">${i}.</span> ${e.action.type}
            <span class="text-zinc-600">(${e.ms.toFixed(2)}ms)</span>
          </div>`).reverse().join('');
    }

    // --- Wiring ---
    document.querySelectorAll('[data-act]').forEach(btn =>
      btn.addEventListener('click', () => dispatch({ type: btn.dataset.act })));
    document.getElementById('live').addEventListener('click', () => viewIndex$.next(null));
    filterEl.addEventListener('input', renderLog);
    logEl.addEventListener('click', e => {
      const row = e.target.closest('[data-i]');
      if (row) viewIndex$.next(Number(row.dataset.i));   // time travel (view only)
    });
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **DevTools is a recorder of `(action, state)`** — capture each pair and everything else (log, inspector, time travel) is just rendering it.
- **The enhancer wraps the reducer** — timing, metrics, and the real-extension bridge live in one `withMetrics` wrapper, leaving the reducer pure.
- **Time travel is a read-only view overlay** — `viewIndex$` selects which recorded state to render; the live store keeps running.
- **Dispatch returns to live** — making a change while time-traveled jumps back to the present, like real DevTools.

### Stretch Goals (Recommended Practice)

1. Add a **diff** view showing what changed between the selected entry and the previous one.
2. Add **export/import**: serialize `entries.map(e => e.action)` to a textarea and replay it.
3. Add action **sanitization** (Lesson 12.2) for a fake `LOGIN` action with a password.
4. Add a "skip action" toggle that recomputes state with selected actions disabled.

### Deliverable

A working DevTools panel: live counter, action log with filtering, reducer performance metrics, a JSON state inspector, and click-to-time-travel — plus an automatic bridge to the real extension when present.

**Key Takeaway:** You built the core of a state DevTools system — recording `(action, state)`, timing reducers, filtering, and time travel — proving that "DevTools magic" is just disciplined recording of a reactive store.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. When integrating Redux DevTools with an RxJS store, when should you `send` the state?
   - A) After computing the new state, paired with the action that caused it
   - B) Before the reducer runs, with the previous state
   - C) Only on errors
   - D) Once, at startup

2. Why must you sanitize actions/state before sending them to DevTools or logs?
   - A) To make them render faster
   - B) DevTools rejects unsanitized data
   - C) They may contain secrets or PII (tokens, passwords) that must not be exposed
   - D) Sanitizing is required by RxJS

3. Where should a custom enhancer's per-action timing live?
   - A) Inside each UI event handler
   - B) In the `subscribe` callback only
   - C) In the HTML template
   - D) In a wrapper around the reducer (e.g. `withMetrics(reducer)`)

4. In time-travel debugging, what does selecting a past entry do?
   - A) Permanently rewrites the live store to that state
   - B) Deletes all later actions
   - C) Renders that recorded state as a read-only view overlay while the live store keeps running
   - D) Re-runs every side effect

5. A cold stream triggers duplicate HTTP calls because it has multiple subscribers. What's the fix?
   - A) Add more `map` operators
   - B) `shareReplay(1)` to multicast a single execution
   - C) Wrap it in a `Promise`
   - D) Remove the subscribers

**Correct Answers:** 1-A, 2-C, 3-D, 4-C, 5-B

**Explanations:**
- Q1: Compute the next state, then `send(action, newState)` so the action lines up with the state it produced.
- Q2: Actions/state can carry secrets and PII; sanitize (mask passwords/tokens) before exposing them anywhere.
- Q3: Wrapping the reducer (`withMetrics`) captures timing/counts for every action while keeping the reducer pure.
- Q4: Time travel is a read-only overlay — it renders a recorded state by index without altering the running store.
- Q5: Multiple subscribers to a cold HTTP stream each trigger the request; `shareReplay(1)` multicasts one execution to all.

---

## Module Summary & Next Steps

You can now debug reactive apps like a pro:
- Integrating Redux DevTools as a guarded subscriber (`connect` / `init` / `send` the new state)
- Sanitizing secrets and a reusable `debug` tap operator, plus a field guide to common RxJS bugs
- A custom enhancer with reducer timing, action filtering, and slow-reducer warnings
- Time-travel debugging and state inspection via recorded `(action, state)` entries

**Next Module:** Module 13 – Backpressure Strategies (handling high-frequency streams, controlled concurrency, and live data feeds)

**Recommended Practice:** Add a diff view and export/replay to the DevTools panel so you can capture and reproduce a bug session.

---

*Improved Module 12 v2.0 – Part of the RxJS Mastery Professional Course*

# Module 01: Foundations of RxJS

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.1 (Further Improved)  
> **Last Updated:** June 2026

---

## Module Overview

Welcome to the very beginning of your journey to **RxJS Mastery**. This foundational module will rewire how you think about asynchronous code forever.

You will move from thinking in "callbacks and promises" to **thinking in streams** — a powerful mental model used by top frontend and full-stack engineers.

**Estimated Total Time:** 100–120 minutes (video + exercises)
**Difficulty:** Beginner to Intermediate
**Prerequisites:** Solid JavaScript/TypeScript fundamentals + basic understanding of async/await and Promises

---

## Learning Objectives

By the end of this module you will be able to:

- Clearly articulate the difference between imperative, promise-based, and reactive programming
- Explain and implement the Observable contract (`next`, `error`, `complete`)
- Confidently choose between **cold** and **hot** observables
- Master the six most important creation operators
- Build a fully functional reactive application from scratch

---

## Lesson 1.1: The Philosophy of Functional Reactive Programming & RxJS Origins

**Estimated Time:** 15 minutes

### Why This Matters
Most developers treat asynchronous code as an afterthought. RxJS forces you to treat **time** as a first-class citizen. This single shift dramatically reduces bugs in complex UIs, real-time features, and state management.

### The Historical Lineage
- **1997** – Functional Reactive Programming (FRP) born in Haskell
- **2011** – Erik Meijer creates Rx.NET at Microsoft
- **2012+** – RxJS is born and later modernized by Ben Lesh
- **Today** – Core part of Angular and widely used in React/Vue ecosystems

### Mental Model
> "An Observable is a collection that arrives over time."

Instead of pulling data when you want it (arrays, promises), data is **pushed** to you when it becomes available.

### Key Concept
RxJS = **Observer Pattern + Iterator Pattern + Functional Programming**

### Quick Exercise
1. Open the browser console
2. Type the code from the example below
3. Observe the output

```ts
import { of } from 'rxjs';

of(1, 2, 3, 4).subscribe({
  next: v => console.log('Received:', v),
  complete: () => console.log('Stream completed!')
});
```

**Takeaway:** You just executed your first reactive stream.

---

## Lesson 1.2: The Observable Contract – next, error, complete

**Estimated Time:** 18 minutes

### The Three Notifications
Every Observable can emit three types of notifications:

| Notification | Purpose | Can it happen multiple times? |
|--------------|---------|-------------------------------|
| `next`       | Delivers a value | Yes |
| `error`      | Terminates with error | No (stream ends) |
| `complete`   | Gracefully ends the stream | No (stream ends) |

### Deep Dive
The contract is **extremely simple** but incredibly powerful. It gives you deterministic control over asynchronous flows that are otherwise chaotic.

### Common Mistake
**Forgetting to handle `error`** — many developers only listen to `next` and are surprised when their app crashes on network failures.

### Recommended Pattern
```ts
observable$.subscribe({
  next: value => { /* handle value */ },
  error: err => { /* handle error gracefully */ },
  complete: () => { /* cleanup */ }
});
```

### Visual (Marble Diagram)

In video production, show (or draw live) the following marble diagram:

```
--1---2---3---|-->
```

- Circles = `next` emissions
- Vertical bar `|` = `complete`
- `X` would represent `error`

This is the standard RxJS marble notation you will see throughout the course.

### Quick Exercise
Create an Observable that emits 3 values, then errors. Observe both paths.

**Key Takeaway:** Always handle all three notifications in production code.

### Managing Subscriptions (Critical for Production)

Every time you call `.subscribe()`, you create a **Subscription**. If you do not clean it up, you can leak memory and cause unexpected behavior.

```ts
const sub = interval(1000).subscribe(console.log);

// Later, when you no longer need the stream:
sub.unsubscribe();
```

In real applications you will usually:
- Use `takeUntil(...)` or `take(1)` inside the pipe
- Store subscriptions and unsubscribe in `ngOnDestroy` (Angular) or `useEffect` cleanup (React)
- Or use libraries like `takeUntilDestroyed`

We will go much deeper in Module 2, but you should start thinking about cleanup from day one.

**Key Takeaway:** `subscribe()` returns a `Subscription` — always have a strategy to stop it.

---

## Lesson 1.3: Cold vs Hot Observables

**Estimated Time:** 20 minutes

### The Critical Distinction
- **Cold Observable**: Each new subscriber gets its **own independent execution**. (Default behavior)
- **Hot Observable**: All subscribers share the **same execution** (uses Subjects or multicasting).

### Real-World Analogy
- **Cold** = Netflix — every viewer starts the movie from the beginning
- **Hot** = Live sports — everyone watches the same moment in real time

### Why It Matters
Using the wrong type can cause:
- Memory leaks (too many cold subscriptions)
- Missed values (subscribing too late to a hot stream)
- Unexpected duplicate API calls

### Code Comparison
```ts
import { interval, Subject } from 'rxjs';

// Cold - each subscriber gets independent timer
const cold$ = interval(1000);

// Hot - shared execution
const hot$ = new Subject<number>();
setInterval(() => hot$.next(Date.now()), 1000);
```

### Best Practice
**Start cold.** Convert to hot only when you need to share expensive operations (HTTP calls, WebSocket connections).

### Common Mistakes
- Subscribing multiple times to a cold observable that performs expensive work (e.g. HTTP call) → causes duplicate requests.
- Subscribing late to a hot observable (e.g. WebSocket or user events) → missing values that were emitted before subscription.
- Forgetting to unsubscribe from long-lived cold observables → memory leaks.

### Quick Exercise
Subscribe to `interval(1000)` twice. Do both timers start at the same time?

**Key Takeaway:** Cold = independent execution. Hot = shared execution.

---

## Lesson 1.4: Creation Operators Masterclass

**Estimated Time:** 22 minutes

### The Six Essential Creation Operators

| Operator     | Use Case                              | Example Use |
|--------------|---------------------------------------|-------------|
| `of()`       | Emit static values                    | Constants, test data |
| `from()`     | Convert arrays, promises, iterables   | API responses, arrays |
| `interval()` | Emit sequential numbers over time     | Polling, timers |
| `timer()`    | Emit after a delay                    | Delayed actions |
| `fromEvent()`| DOM / Node.js events                  | Click, input, WebSocket |
| `ajax()`     | HTTP requests (with cancellation)     | REST API calls |

### Pro Tips
- Prefer `from()` over `of()` when working with arrays
- Always use `ajax()` instead of `fetch()` when you want automatic cancellation
- Combine `timer(0, 1000)` for "immediate + repeating"

### Common Mistake
Using `new Observable()` when a creation operator exists — hurts readability and tree-shaking.

### Quick Exercise
Create an Observable from a Promise that resolves after 2 seconds.

**Key Takeaway:** Creation operators are your entry point into the reactive world.

---

## Lesson 1.5: Project Workshop – Live Number Stream Dashboard

**Estimated Time:** 25–30 minutes

### Project Goal

Build a clean, robust, and visually appealing reactive dashboard that demonstrates proper foundational RxJS patterns:

- Start and stop a live number stream on demand
- Display the current emitted value in real time
- Maintain a rolling history of the last 10 numbers
- Calculate live statistics (count, min, max, average) derived from the stream
- Properly manage subscriptions to avoid memory leaks
- Handle user actions (start, stop, clear) declaratively
- Includes keyboard shortcuts (S = Start, X = Stop, C = Clear) for better UX

This project reinforces the core concepts from Lessons 1.1–1.4 while establishing good habits that will scale to the advanced patterns taught later in the course.

### Why This Project Matters

Most beginners write reactive code that *appears* to work but leaks subscriptions or mixes business logic with DOM updates. In this workshop you will learn the correct foundational pattern for controlling streams from user actions.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Create the HTML structure with clear semantic sections.
2. **Create the number stream** — Use `interval` + `map` when the user clicks Start.
3. **Control the stream properly** — Hold a subscription reference and unsubscribe on Stop (the correct pattern for independent streams).
4. **Add derived state** — Use `scan` to maintain a rolling history window (preview of state management).
5. **Derive multiple UI views** — Current value, history list, and live statistics from the same stream.
6. **Polish & harden** — Prevent double-starts, add Clear, improve UX.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Number Stream Dashboard • RxJS</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
  <style>
    .number-pill { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
    .stat-value { font-variant-numeric: tabular-nums; }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-3xl mx-auto p-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight">Live Number Stream</h1>
        <p class="text-zinc-400 mt-1">A foundational RxJS reactive dashboard</p>
      </div>
      <div id="status" 
           class="px-4 py-1.5 rounded-full text-sm font-medium bg-zinc-900 border border-zinc-800">
        Idle
      </div>
    </div>

    <!-- Current Value -->
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6 text-center">
      <div class="text-sm uppercase tracking-[2px] text-zinc-500 mb-2">CURRENT VALUE</div>
      <div id="current" 
           class="text-7xl font-semibold tabular-nums text-white min-h-[88px] flex items-center justify-center">
        —
      </div>
    </div>

    <!-- Controls -->
    <div class="flex gap-3 mb-6">
      <button id="start" 
              class="flex-1 bg-emerald-600 hover:bg-emerald-500 transition-colors text-white font-medium py-3 px-6 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed">
        Start Stream
      </button>
      <button id="stop" 
              class="flex-1 bg-zinc-800 hover:bg-zinc-700 transition-colors font-medium py-3 px-6 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700">
        Stop Stream
      </button>
      <button id="clear" 
              class="bg-zinc-900 hover:bg-zinc-800 transition-colors font-medium py-3 px-6 rounded-xl border border-zinc-700">
        Clear History
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Emissions</div>
        <div id="count" class="stat-value text-3xl font-semibold mt-1">0</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Minimum</div>
        <div id="min" class="stat-value text-3xl font-semibold mt-1 text-emerald-400">—</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Maximum</div>
        <div id="max" class="stat-value text-3xl font-semibold mt-1 text-red-400">—</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div class="text-xs uppercase tracking-widest text-zinc-500">Average</div>
        <div id="avg" class="stat-value text-3xl font-semibold mt-1 text-amber-400">—</div>
      </div>
    </div>

    <!-- History -->
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="text-sm uppercase tracking-[2px] text-zinc-500">Last 10 Values</div>
        <div class="text-xs text-zinc-500">Rolling window</div>
      </div>
      <div id="history" 
           class="flex flex-wrap gap-2 min-h-[52px] items-center text-lg">
        <span class="text-zinc-600 text-sm">No data yet. Click Start Stream.</span>
      </div>
    </div>

    <div class="mt-8 text-xs text-zinc-500 text-center">
      Built with RxJS • Demonstrates creation operators, subscription control, and basic stream composition
    </div>
  </div>

  <script>
    const { interval, fromEvent } = rxjs;
    const { map, scan, startWith, tap } = rxjs.operators;

    // DOM references
    const startBtn = document.getElementById('start');
    const stopBtn = document.getElementById('stop');
    const clearBtn = document.getElementById('clear');
    const currentEl = document.getElementById('current');
    const historyEl = document.getElementById('history');
    const countEl = document.getElementById('count');
    const minEl = document.getElementById('min');
    const maxEl = document.getElementById('max');
    const avgEl = document.getElementById('avg');
    const statusEl = document.getElementById('status');

    // We keep a reference to the active subscription so we can stop it cleanly
    let activeSubscription = null;

    // Helper to update UI status
    function setStatus(text, color = 'zinc') {
      statusEl.textContent = text;
      statusEl.className = `px-4 py-1.5 rounded-full text-sm font-medium bg-zinc-900 border border-${color}-700 text-${color}-400`;
    }

    function updateCurrent(value) {
      currentEl.textContent = value;
      currentEl.classList.add('text-emerald-400');
      setTimeout(() => currentEl.classList.remove('text-emerald-400'), 400);
    }

    function renderHistory(numbers) {
      if (numbers.length === 0) {
        historyEl.innerHTML = `<span class="text-zinc-600 text-sm">No data yet. Click Start Stream.</span>`;
        return;
      }
      historyEl.innerHTML = numbers
        .map(n => `<span class="number-pill px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-sm tabular-nums">${n}</span>`)
        .join('');
    }

    function renderStats(numbers) {
      const count = numbers.length;
      countEl.textContent = count;

      if (count === 0) {
        minEl.textContent = '—';
        maxEl.textContent = '—';
        avgEl.textContent = '—';
        return;
      }

      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      const avg = (numbers.reduce((a, b) => a + b, 0) / count).toFixed(1);

      minEl.textContent = min;
      maxEl.textContent = max;
      avgEl.textContent = avg;
    }

    function resetUI() {
      currentEl.textContent = '—';
      historyEl.innerHTML = `<span class="text-zinc-600 text-sm">No data yet. Click Start Stream.</span>`;
      countEl.textContent = '0';
      minEl.textContent = '—';
      maxEl.textContent = '—';
      avgEl.textContent = '—';
    }

    // === Main Stream Logic ===
    fromEvent(startBtn, 'click').subscribe(() => {
      // Prevent starting multiple streams (important!)
      if (activeSubscription) return;

      setStatus('Streaming', 'emerald');
      startBtn.disabled = true;
      stopBtn.disabled = false;

      // Create a fresh cold observable every time we start
      const numbers$ = interval(850).pipe(
        map(() => Math.floor(Math.random() * 100) + 1),
        // Small, intentional use of scan to maintain rolling history.
        // This is a preview — we will explore proper state management in Module 10.
        scan((acc, num) => {
          const next = [...acc, num];
          return next.length > 10 ? next.slice(1) : next;
        }, []),
        startWith([]),
        tap({
          subscribe: () => console.log('%c[RxJS] Stream started', 'color:#10b981'),
          complete: () => console.log('%c[RxJS] Stream completed', 'color:#64748b')
        })
      );

      activeSubscription = numbers$.subscribe({
        next: (history) => {
          const latest = history[history.length - 1];
          if (latest !== undefined) {
            updateCurrent(latest);
          }
          renderHistory(history);
          renderStats(history);
        },
        complete: () => {
          setStatus('Completed', 'zinc');
          activeSubscription = null;
          startBtn.disabled = false;
          stopBtn.disabled = true;
        }
      });
    });

    // Stop the stream cleanly
    fromEvent(stopBtn, 'click').subscribe(() => {
      if (activeSubscription) {
        activeSubscription.unsubscribe();
        activeSubscription = null;
      }
      setStatus('Stopped', 'amber');
      startBtn.disabled = false;
      stopBtn.disabled = true;
    });

    // Clear history while keeping the stream running (if active)
    fromEvent(clearBtn, 'click').subscribe(() => {
      // We can't easily "reset" a running scan from outside without more advanced patterns.
      // For now, stopping + restarting gives a fresh stream (demonstrates cold observable behavior).
      if (activeSubscription) {
        activeSubscription.unsubscribe();
        activeSubscription = null;
      }
      resetUI();
      setStatus('Cleared — Ready', 'zinc');
      startBtn.disabled = false;
      stopBtn.disabled = true;
    });

    // Initial state
    stopBtn.disabled = true;
    setStatus('Idle', 'zinc');

    // Keyboard support (nice UX touch)
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 's' && !startBtn.disabled) startBtn.click();
      if (e.key.toLowerCase() === 'x' && !stopBtn.disabled) stopBtn.click();
      if (e.key.toLowerCase() === 'c') clearBtn.click();
    });
  </script>
</body>
</html>
```

### Important Note on the Development Setup

The single-file HTML approach (with CDN) is excellent for learning and quick demos.  
**For any real application**, use a modern setup:

```bash
npm create vite@latest my-rxjs-project -- --template vanilla-ts
npm install rxjs
```

This gives you full TypeScript support, tree-shaking, and a much better development experience.

### Key Lessons from This Project

- **Cold observables create fresh execution** — Every time you click Start, you get a brand new `interval` stream.
- **Subscription control is your responsibility** — Holding a reference to the `Subscription` and calling `unsubscribe()` is the correct foundational pattern for stopping streams started by user action.
- **Derived state belongs in the stream** — `scan` gives us a clean rolling window. We will evolve this pattern dramatically in Modules 10–12.
- **UI updates are a side effect at the edge** — The subscription is the boundary where we update the DOM. The stream itself stays pure.
- **Preventing multiple subscriptions** is a common and important real-world concern.

### Stretch Goals (Recommended Practice)

1. Add a "Speed" slider that changes the `interval` time (requires rebuilding the stream on change).
2. Persist the history to `localStorage` when the stream stops.
3. Add a simple error simulation toggle (use `throwError` inside a `tap` or `map`).
4. Replace the history array rendering with a tiny SVG sparkline using the same data stream.

### Deliverable

A working, clean reactive dashboard that:
- Starts and stops reliably
- Never leaks subscriptions
- Shows current value + rolling history + live stats
- Handles user actions gracefully

**Key Takeaway:** You have now built a real reactive UI using proper subscription control — the same mental model used in production Angular, React, and vanilla TypeScript applications.

---

## End-of-Module Quiz

**5 Multiple Choice Questions** (Improved)

1. What happens if you subscribe to a cold Observable multiple times?
   - A) All subscribers share the same execution
   - B) Each subscriber gets its own independent execution
   - C) Only the first subscriber receives values
   - D) The stream throws an error

2. Which notification **always** ends an Observable stream?
   - A) `next`
   - B) `error` and `complete`
   - C) Only `complete`
   - D) Only `error`

3. You should convert a cold Observable to hot when...
   - A) You want to avoid duplicate expensive operations
   - B) You want every subscriber to start from the beginning
   - C) You are working with static values
   - D) You want better TypeScript support

4. What is the main advantage of `ajax()` over the native `fetch()`?
   - A) Faster requests
   - B) Automatic cancellation on unsubscription
   - C) Better error messages
   - D) Built-in caching

5. In the Live Number Stream Dashboard project, which operator combination keeps a rolling window of the last 10 numbers?
   - A) `map` + `filter`
   - B) `scan` + `slice`
   - C) `mergeMap` + `take`
   - D) `debounceTime` + `distinctUntilChanged`

**Correct Answers:** 1-B, 2-B, 3-A, 4-B, 5-B

**Explanations:**
- Q1: Cold observables are independent per subscriber.
- Q2: Both `error` and `complete` terminate the stream.
- Q3: Hot observables share expensive work (e.g. one HTTP call for many components).
- Q4: `ajax()` returns an Observable that can be cancelled via `unsubscribe()`.
- Q5: `scan` accumulates the history array; the logic keeps a maximum of the last 10 values using array slicing inside the accumulator.

---

## Module Summary & Next Steps

You now understand the **foundational building blocks** of RxJS:
- The Observable contract + proper subscription management
- Cold vs Hot behavior
- Creation operators
- How to build clean, leak-free reactive UIs using proper stream control

**Next Module:** Module 02 – Core Concepts (Observer vs Iterator, Marble Diagrams, Schedulers Deep Dive)

**Recommended Practice:** Rebuild the Live Number Stream Dashboard from memory without looking at the code. Pay special attention to how the subscription is managed.

---

*Improved Module 01 v2.1 – Part of the RxJS Mastery Professional Course*

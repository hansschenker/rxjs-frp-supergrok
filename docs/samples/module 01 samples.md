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

---------------

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

```text
--1---2---3---|-->
```
---------------
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
-----------------

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

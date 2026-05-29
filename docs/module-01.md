# Module 01: Foundations of RxJS

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0 (Improved)  
> **Last Updated:** May 29, 2026

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
Draw this: A horizontal line with circles (values), then a vertical bar (complete).

### Quick Exercise
Create an Observable that emits 3 values, then errors. Observe both paths.

**Key Takeaway:** Always handle all three notifications in production code.

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

## Lesson 1.5: Project Workshop – Reactive Number Generator

**Estimated Time:** 25 minutes

### Project Goal
Build a beautiful, fully reactive number generator dashboard that:
- Generates random numbers every second
- Shows the last 10 numbers in real time
- Calculates live min, max, and average
- Allows starting/stopping the stream

### Complete Working Code (HTML + TypeScript)

```html
<!DOCTYPE html>
<html>
<head>
  <title>RxJS Number Generator</title>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body>
  <h1>Reactive Number Generator</h1>
  <button id="start">Start</button>
  <button id="stop">Stop</button>
  <div id="stats"></div>
  <ul id="numbers"></ul>

  <script>
    const { interval, Subject, fromEvent } = rxjs;
    const { scan, map, takeUntil, startWith } = rxjs.operators;

    const startBtn = document.getElementById('start');
    const stopBtn = document.getElementById('stop');
    const numbersList = document.getElementById('numbers');
    const statsDiv = document.getElementById('stats');

    const stop$ = new Subject();

    fromEvent(startBtn, 'click').subscribe(() => {
      const numbers$ = interval(1000).pipe(
        map(() => Math.floor(Math.random() * 100) + 1),
        takeUntil(stop$)
      );

      numbers$.pipe(
        scan((acc, num) => [...acc.slice(-9), num], []),
        startWith([])
      ).subscribe(list => {
        numbersList.innerHTML = list.map(n => `<li>${n}</li>`).join('');

        if (list.length > 0) {
          const min = Math.min(...list);
          const max = Math.max(...list);
          const avg = (list.reduce((a, b) => a + b, 0) / list.length).toFixed(1);
          statsDiv.innerHTML = `Min: ${min} | Max: ${max} | Avg: ${avg}`;
        }
      });
    });

    fromEvent(stopBtn, 'click').subscribe(() => stop$.next());
  </script>
</body>
</html>
```

### Stretch Goals
1. Add a "Clear" button
2. Persist the last 50 numbers in localStorage
3. Show a simple line chart using Chart.js + RxJS

### Deliverable
A working, beautiful reactive dashboard.

**Key Takeaway:** You now have a complete reactive application built only with RxJS.

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

5. In the Number Generator project, which operator combination keeps a rolling window of the last 10 numbers?
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
- Q5: `scan` accumulates values while `slice(-9)` keeps only the last 10.

---

## Module Summary & Next Steps

You now understand the **foundational building blocks** of RxJS:
- The Observable contract
- Cold vs Hot behavior
- Creation operators
- How to build real reactive UIs

**Next Module:** Module 02 – Core Concepts (Observer vs Iterator, Marble Diagrams, Schedulers Deep Dive)

**Recommended Practice:** Rebuild the Number Generator project from memory without looking at the code.

---

*Improved Module 01 v2.0 – Part of the RxJS Mastery Professional Course*
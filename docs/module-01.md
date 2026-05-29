# Module 01: Foundations of RxJS

**RxJS Mastery: Professional Course – Thinking in Streams**

## Module Overview

This foundational module introduces you to the core philosophy and building blocks of RxJS. You will understand why reactive programming matters, master the Observable contract, distinguish between cold and hot observables, and learn the most important creation operators through hands-on practice.

**Duration:** ~90 minutes of video content + exercises
**Prerequisites:** Basic JavaScript/TypeScript and asynchronous programming knowledge

---

## Learning Objectives

By the end of this module, you will be able to:

- Explain the difference between imperative, promise-based, and reactive programming
- Describe the Observable contract (`next`, `error`, `complete`)
- Differentiate cold vs hot observables and choose the right one
- Use the core creation operators: `of()`, `from()`, `interval()`, `timer()`, `fromEvent()`, `ajax()`
- Build a simple reactive number generator application

---

## Lesson 1.1: The Philosophy of Functional Reactive Programming & RxJS Origins

### Topics Covered
- History: Haskell List Comprehensions → LINQ → Rx.NET → RxJS
- Erik Meijer and the creation of Reactive Extensions
- Why "Thinking in Streams" changes everything
- The shift from pull-based (arrays/promises) to push-based (Observables)

### Key Concepts
RxJS brings the power of functional programming and the Observer pattern together to handle asynchronous data streams declaratively.

### Code Example
```ts
import { of } from 'rxjs';

of(1, 2, 3).subscribe({
  next: value => console.log(value),
  complete: () => console.log('Done!')
});
```

### Takeaway
RxJS is not just another library — it is a **paradigm shift** in how you model time-varying data.

---

## Lesson 1.2: The Observable Contract – next, error, complete

### Topics Covered
- The three methods every Observable must support
- How Observables differ from Promises and Event Emitters
- Subscription lifecycle and unsubscription

### Visual
Use marble diagram showing a stream that emits values, then completes.

### Code Example
```ts
import { Observable } from 'rxjs';

const number$ = new Observable<number>(subscriber => {
  subscriber.next(1);
  subscriber.next(2);
  subscriber.complete();
  // subscriber.error(new Error('Boom!'));
});

number$.subscribe({
  next: v => console.log('Value:', v),
  error: e => console.error(e),
  complete: () => console.log('Stream finished')
});
```

### Key Insight
The contract is **simple but powerful** — it gives you complete control over the lifecycle of asynchronous data.

---

## Lesson 1.3: Cold vs Hot Observables

### Topics Covered
- Cold Observables: each subscriber gets its own execution
- Hot Observables: shared execution (Subjects, multicasting)
- When to use each pattern
- `shareReplay` and multicasting operators

### Real-World Analogy
- Cold = Netflix (each viewer starts from beginning)
- Hot = Live TV (everyone sees the same moment)

### Code Comparison
```ts
// Cold
const cold$ = interval(1000);

// Hot (using Subject)
const hot$ = new Subject<number>();
setInterval(() => hot$.next(Date.now()), 1000);
```

### Best Practice
Start with cold observables. Convert to hot only when you need shared state or performance.

---

## Lesson 1.4: Creation Operators Masterclass

### Topics Covered
- `of()` – emit static values
- `from()` – convert arrays, promises, iterables
- `interval()` & `timer()` – time-based streams
- `fromEvent()` – DOM and Node.js events
- `ajax()` – HTTP requests with cancellation

### Code Examples
```ts
import { of, from, interval, timer, fromEvent, ajax } from 'rxjs';

// Static values
of('Hello', 'RxJS', 'World').subscribe(console.log);

// From array or promise
const users$ = from(fetch('/api/users').then(r => r.json()));

// Time-based
const tick$ = interval(1000);
const delay$ = timer(3000);

// DOM events
const clicks$ = fromEvent(document, 'click');

// HTTP
const api$ = ajax.getJSON('https://api.github.com/users/hansschenker');
```

### Pro Tip
Always prefer creation operators over `new Observable()` for better readability and tree-shaking.

---

## Lesson 1.5: Project Workshop – Reactive Number Generator

### Project Goal
Build a small web app that generates random numbers every second and displays statistics (min, max, average) using only RxJS.

### Requirements
1. Use `interval()` to emit every 1000ms
2. Generate random numbers between 1–100
3. Display live list of last 10 numbers
4. Show real-time min/max/average using `scan` and `map`
5. Add start/stop controls

### Starter Code
```ts
import { interval, Subject } from 'rxjs';
import { scan, map, takeUntil } from 'rxjs/operators';

const stop$ = new Subject<void>();

const numbers$ = interval(1000).pipe(
  map(() => Math.floor(Math.random() * 100) + 1),
  takeUntil(stop$)
);

numbers$.pipe(
  scan((acc, num) => [...acc.slice(-9), num], [])
).subscribe(list => {
  // update UI
});
```

### Deliverable
A working reactive number generator with live statistics.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What does the `complete` notification in an Observable mean?
   - A) An error occurred
   - B) No more values will be emitted
   - C) The stream is paused
   - D) The subscriber was unsubscribed

2. Which creation operator is best for converting an array into an Observable?
   - A) `of()`
   - B) `from()`
   - C) `interval()`
   - D) `timer()`

3. A cold Observable...
   - A) Shares execution between subscribers
   - B) Executes once for every new subscriber
   - C) Only works with HTTP requests
   - D) Cannot complete

4. What is the main advantage of using `fromEvent()` over `addEventListener`?
   - A) Better performance
   - B) Built-in cancellation via unsubscribe
   - C) Automatic error handling
   - D) Both B and C

5. In the Number Generator project, which operator is used to keep a rolling window of the last 10 numbers?
   - A) `map`
   - B) `filter`
   - C) `scan`
   - D) `mergeMap`

**Answers:** 1-B, 2-B, 3-B, 4-D, 5-C

---

## Resources & Further Reading
- Official RxJS Documentation: [rxjs.dev](https://rxjs.dev)
- Marble Diagrams: [rxmarbles.com](https://rxmarbles.com)
- "Reactive Programming with RxJS" book

**Next Module:** Module 02 – Core Concepts (Observer vs Iterator, Marble Diagrams, Schedulers)

---

*Module created as part of the RxJS Mastery Professional Course – May 2026*
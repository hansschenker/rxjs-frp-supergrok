# Module 12: DevTools & Debugging

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

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
Even if you're not using Redux, the Redux DevTools browser extension is an incredibly powerful debugging tool that works great with custom RxJS state management.

### Basic Integration

```ts
import { Subject } from 'rxjs';
import { scan, startWith, shareReplay } from 'rxjs/operators';

declare const window: any;

let devTools: any = null;

if (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__) {
  devTools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({
    name: 'RxJS App',
    features: {
      pause: true,
      lock: true,
      persist: true,
      export: true,
      import: true,
      jump: true,
      skip: true,
      reorder: true,
      dispatch: true,
      test: true,
    }
  });
}

const action$ = new Subject<any>();

export const state$ = action$.pipe(
  scan((state, action) => {
    // Send to DevTools
    if (devTools) {
      devTools.send(action, state);
    }
    return todoReducer(state, action);
  }, initialState),
  startWith(initialState),
  shareReplay(1)
);

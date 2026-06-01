# Module 19: Testing

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

---

## Module Overview

Testing is essential for building reliable reactive applications. This module provides a comprehensive guide to testing RxJS code, with a deep focus on **marble diagram testing** using `TestScheduler`. You will learn how to write fast, reliable, and maintainable tests for operators, effects, and complete state management systems. Proper testing is what separates professional reactive code from fragile implementations.

**Estimated Total Time:** 120–140 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Modules 09, 16 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Write marble diagram tests using `TestScheduler`
- Test custom operators thoroughly
- Test effects and side effects
- Test complete state management systems
- Build a comprehensive testing suite for an operator library

---

## Lesson 19.1: Marble Diagram Testing Fundamentals

**Estimated Time:** 22 minutes

### Why Marble Testing?
Marble testing allows you to:
- Test time-based behavior synchronously
- Visualize expected behavior clearly
- Write fast, deterministic tests
- Test complex operator combinations

### Basic Marble Test Structure

```ts
import { TestScheduler } from 'rxjs/testing';

describe('My Operator', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  it('should transform values correctly', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const source$ = cold('  -a-b-c-|', { a: 1, b: 2, c: 3 });
      const expected =       '--x-y-z-|', { x: 2, y: 4, z: 6 };

      expectObservable(
        source$.pipe(map(x => x * 2))
      ).toBe(expected);
    });
  });
});

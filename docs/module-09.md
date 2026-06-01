# Module 09: Schedulers Deep Dive

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

---

## Module Overview

Schedulers control **when** and **where** code executes in RxJS. This module takes a deep dive into schedulers, helping you understand execution contexts, virtual time testing, and how to build smooth, high-performance animations and UIs. Mastering schedulers is essential for building responsive and efficient reactive applications.

**Estimated Total Time:** 105–125 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Modules 01–08 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Understand the difference between `subscribeOn` and `observeOn`
- Master all major schedulers (`async`, `asap`, `queue`, `animationFrame`)
- Use `TestScheduler` for virtual time testing
- Build smooth animations with precise timing control
- Optimize performance using the right scheduler

---

## Lesson 9.1: subscribeOn vs observeOn

**Estimated Time:** 20 minutes

### The Key Difference

- **`subscribeOn`**: Controls on which scheduler the **subscription** happens (where the Observable starts executing)
- **`observeOn`**: Controls on which scheduler the **notifications** (`next`, `error`, `complete`) are delivered

### Example

```ts
source$.pipe(
  subscribeOn(asyncScheduler),  // Subscription happens asynchronously
  observeOn(animationFrameScheduler) // Notifications delivered on animation frame
)

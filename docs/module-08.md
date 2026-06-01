# Module 08: Retry & Resilience

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

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
When an API fails, immediately retrying can make the problem worse (especially during outages or rate limiting). Exponential backoff gives the system time to recover.

### Basic Exponential Backoff

```ts
source$.pipe(
  retryWhen(errors =>
    errors.pipe(
      mergeMap((error, index) => {
        const delayTime = Math.pow(2, index) * 1000; // 1s, 2s, 4s, 8s...
        return timer(delayTime);
      }),
      take(5) // max 5 retries
    )
  )
)

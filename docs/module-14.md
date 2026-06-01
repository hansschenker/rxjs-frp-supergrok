# Module 14: Window & Buffer

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

---

## Module Overview

This module teaches you two powerful time-based operators: **`buffer`** and **`window`**. These operators allow you to collect emissions over time or based on other Observables, enabling powerful patterns like batching analytics events, implementing rate limiting, and building time-aware data processing pipelines.

**Estimated Total Time:** 105–125 minutes  
**Difficulty:** Intermediate to Advanced  
**Prerequisites:** Modules 05, 13 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Understand the difference between `buffer` and `window`
- Use time-based, count-based, and notifier-based buffering
- Implement analytics batching and rate limiting
- Build time-aware reactive systems
- Choose the right operator for different use cases

---

## Lesson 14.1: Buffer vs Window Philosophy

**Estimated Time:** 20 minutes

### The Core Difference

- **`buffer`**: Collects values into **arrays**
- **`window`**: Collects values into **Observables**

### Visual Comparison


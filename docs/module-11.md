# Module 11: Advanced State Management

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

---

## Module Overview

This module takes state management to the next level by adding **Undo/Redo**, **Time Travel**, and advanced patterns on top of the `scan` + reducer foundation. These features are what separate basic state management from professional-grade solutions used in tools like Redux DevTools, Figma, and many enterprise applications.

**Estimated Total Time:** 125–145 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Module 10 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Implement Undo/Redo functionality using state history
- Add Time Travel debugging capabilities
- Build an enhanced Todo application with full history support
- Understand optimistic updates and conflict resolution
- Prepare for production-grade state management systems

---

## Lesson 11.1: Undo/Redo Logic with History Management

**Estimated Time:** 22 minutes

### The Undo/Redo Pattern
We extend our state to keep a history of previous states:

```ts
interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

const initialHistoryState: HistoryState<TodoState> = {
  past: [],
  present: initialTodoState,
  future: []
};

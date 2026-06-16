<!-- Thanks for the PR. A short description here makes review faster. -->

## What

<!-- One paragraph: what does this change, and what does it not change. -->

## Why

<!-- The problem it solves. Link an issue if there is one. -->

## How to test

```bash
npm test
# plus any specific flow worth walking, e.g.:
# npm run dev -- demo
```

## Checklist

- [ ] Tests added or updated
- [ ] `npm test` passes locally
- [ ] No new heavyweight dependencies (or justified above)
- [ ] Behaviour is local-first (no telemetry, no remote calls)
- [ ] Every new flag/signal has a human-readable `reason`

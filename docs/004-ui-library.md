# Decision: UI Component Library

**Date:** Phase 2 addendum (post-conflict validation)  
**Status:** Final

## Chosen: shadcn/ui + Tailwind v4

## Alternatives Considered

**Mantine**
- Rejected because: first-class RTL support is genuinely good, but the engineer
  already knows shadcn/ui. Mantine has a steeper learning curve and significantly
  less AI agent training data — agent-generated Mantine code has lower accuracy
  than agent-generated shadcn/ui code. Heavier bundle.

**Ant Design**
- Not seriously considered. Heavy, opinionated, RTL support is secondary, Chinese
  design aesthetic doesn't match the Arabic retail market.

**Custom components from scratch**
- Rejected. The project is a business application, not a design system. Time spent
  building accordions and date pickers is time not spent on the actual POS logic.

## Why shadcn/ui + Tailwind v4

1. **Engineer familiarity** — zero learning curve, productive from day one
2. **Agent training data** — shadcn/ui is the most represented React component
   library in LLM training data. Agent-generated code is more accurate.
3. **Tailwind v4 + Vite** — `@tailwindcss/vite` plugin drops straight into Tauri's
   existing Vite config with one line. No `tailwind.config.js` needed.
4. **RTL compatibility** — shadcn/ui components use logical CSS properties
   (`margin-inline-start` instead of `margin-left`). Setting `dir=rtl` on `<html>`
   flips them automatically.
5. **Bundle size** — shadcn ships only the components you install. Tailwind v4
   purges unused utilities. Lean bundle = faster Tauri window startup.

## RTL Implementation Detail

The one gotcha: Radix UI portals (used by Dialog, Sheet, Popover, DropdownMenu,
Toast) mount their DOM outside the React tree, after `<body>`. They do not inherit
`dir=rtl` from `<html>` automatically.

Fix: `RtlProvider.tsx` sets the `dir` attribute on the Radix portal container on mount.

```tsx
// src/app/providers/RtlProvider.tsx
import { useEffect } from 'react'

export function RtlProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Radix portals mount into document.body directly
    // Force RTL on the body so all portals inherit it
    document.body.setAttribute('dir', 'rtl')
    document.body.setAttribute('lang', 'ar')
  }, [])
  return <>{children}</>
}
```

This is written once in T-002 and never touched again.

## Reversibility: Medium

shadcn/ui components are copied into the project (not installed as a package).
They can be modified freely. Migrating to a different library would require
replacing each component file — significant but not catastrophic.

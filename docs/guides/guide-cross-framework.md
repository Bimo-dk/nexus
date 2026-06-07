---
id: guide-cross-framework
title: Guide — Cross-framework components (BYOF)
sidebar_position: 2
description: How a Vue host loads a React component, how a React host loads a Vue component, and why the Bring-Your-Own-Framework mount(el) pattern sidesteps every multi-framework runtime bug.
keywords:
  - cross-framework micro frontend
  - Vue host React component
  - React host Vue component
  - bring your own framework
  - mount el pattern
  - multi-framework runtime sharing
  - module federation cross-framework
---

# Cross-framework components (BYOF)

Nexus ships a single convention for federated components that **any host** can load, regardless of which framework the remote is written in: `mount(el)`. This guide explains the pattern, when to use it, and what to do when it does not apply.

## The problem cross-framework loading actually solves

Module federation lets you ship a component from one bundle and consume it in another. That worked the day the host and the remote used the same React (or the same Angular runtime, or the same Vue runtime). The day they did not, every team hit the same wall:

```
TypeError: Cannot read properties of null (reading 'useState')
```

React calls `useState` on a dispatcher that was set during the host's render phase. The remote's bundle imported a *second* React, with a *second* dispatcher that was never primed. The hook throws on first call. Vue has the same bug with reactivity context; Angular has the same bug with the injector tree.

The standard fix is to share the framework runtime across host and remote. That works inside one framework — and only inside one framework. The moment you mix Vue and React in the same browser tab, neither can be shared without the other, and the runtime mismatch returns.

## BYOF — Bring Your Own Framework

Instead of sharing the runtime, every Nexus remote exports a tiny function:

```ts
export function mount(el: HTMLElement): () => void;
```

The host hands the remote a DOM element. The remote brings its own framework runtime (its own React, its own Vue app instance, its own Angular `bootstrapApplication`) and renders **inside** that element. The host never imports React, Vue, or Angular from the remote, and never tries to render a class it does not understand.

The returned function is a teardown. When the host route unmounts the slot, it calls the teardown and the remote unmounts cleanly.

### The Vue side

```ts
// src/entry.ts
import { createApp, defineComponent, h } from 'vue';

const Cart = defineComponent({
  setup() {
    return () => h('div', { class: 'cart' }, 'Vue cart');
  },
});

export function mount(el: HTMLElement): () => void {
  const app = createApp(Cart);
  app.mount(el);
  return () => app.unmount();
}

export default Cart; // legacy fallback for Vue-only hosts
```

### The React side

```tsx
// src/entry.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';

function Checkout(): React.ReactElement {
  return <div className="checkout">React checkout</div>;
}

export function mount(el: HTMLElement): () => void {
  const root = createRoot(el);
  root.render(<Checkout />);
  return () => root.unmount();
}

export default Checkout; // legacy fallback for React-only hosts
```

### The Angular side

```ts
// src/app/remote-entry/entry.component.ts
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

@Component({
  selector: 'app-remote-entry',
  standalone: true,
  template: `<div class="reviews">Angular reviews</div>`,
})
export class EntryComponent {}

export async function mount(el: HTMLElement): Promise<() => void> {
  const host = document.createElement('app-remote-entry');
  el.appendChild(host);
  const appRef = await bootstrapApplication(EntryComponent);
  return () => {
    appRef.destroy();
    if (host.parentNode === el) el.removeChild(host);
  };
}

export default EntryComponent;
```

## How the host consumes it

The three framework runtimes (`@bimo-dk/nexus-runtime`, `@bimo-dk/nexus-runtime-vue`, `@bimo-dk/nexus-runtime-react`) ship a generic wrapper component that detects `mount` automatically. There is no per-remote configuration in the host:

```html
<!-- Angular host -->
<nexus-component remote="checkout" expose="./CheckoutForm"></nexus-component>
```

```vue
<!-- Vue host -->
<NexusComponent remote="checkout" expose="./CheckoutForm" />
```

```tsx
{/* React host */}
<NexusComponent remote="checkout" expose="./CheckoutForm" />
```

Under the hood each adapter:

1. Resolves the remote's manifest at `/remotes/<route>/remoteEntry.json`.
2. Looks up the chunk for the requested `expose` key.
3. `import()`s the chunk dynamically.
4. If the module exports `mount`, calls it with a host-owned div.
5. Otherwise falls back to rendering the default export as a framework-native component (legacy path).

## When BYOF does **not** apply

BYOF is for *cross-framework* loading. When the host and the remote share a framework — Angular host loading an Angular remote, Vue host loading a Vue remote — the legacy path is still faster and cheaper because the runtime is already loaded. The runtimes pick the legacy path automatically when the module exports a usable component but no `mount`.

There are also two cases BYOF cannot rescue:

- **Shared application state across the boundary.** A Vue Pinia store and a React Zustand store are different reactive systems. If you need the cart count to update in two frameworks simultaneously, broadcast events through `@bimo-dk/nexus-bus` (a framework-agnostic event bus) rather than expecting reactivity to propagate.
- **Angular remotes loaded by a non-Angular host that need bundled Angular core.** The default Angular CLI federation config (`shareAll()`) externalizes `@angular/core`; a Vue host has no `@angular/core` to satisfy that import. Either the Angular remote must be built with a bundled-runtime variant, or the consuming host must initialise the share scope with the same shared deps Angular expects. The official workaround is documented in [getting-started/installation](../getting-started/installation.md). See [B-22 in the release readiness report](https://github.com/Bimo-dk/nexus/issues) for the upstream tracking.

## Multi-component remotes

A remote can expose many components, not just one. The build plugin handles the chunk layout; the catalog tracks them.

```ts
// vite.config.ts (Vue remote)
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { nexusVite } from '@bimo-dk/nexus-build/vite';

export default defineConfig({
  plugins: [
    vue(),
    nexusVite({
      name: 'shop',
      exposes: {
        ProductCard: './src/entry-product-card.ts',
        CartWidget:  './src/entry-cart-widget.ts',
        ReviewStars: './src/entry-review-stars.ts',
      },
      catalog: [
        { expose: './ProductCard', title: 'Product Card', category: 'commerce',
          description: 'Product card with image and like toggle.', tags: ['vue', 'card'] },
        { expose: './CartWidget',  title: 'Cart Widget',  category: 'commerce',
          description: 'Cart line counter with add-to-cart.',     tags: ['vue', 'cart'] },
        { expose: './ReviewStars', title: 'Review Stars', category: 'feedback',
          description: '5-star rating widget.',                   tags: ['vue', 'reviews'] },
      ],
    }),
  ],
});
```

Each `expose` is a separate `mount(el)`-shaped entry file. The catalog block populates the portal's Component Catalog so every consumer can discover the component without reading the source.

```ts
// src/entry-cart-widget.ts
import { createApp } from 'vue';
import { CartWidget } from './components';
export function mount(el: HTMLElement) {
  const app = createApp(CartWidget);
  app.mount(el);
  return () => app.unmount();
}
export default CartWidget;
```

In the portal, the catalog renders as a sortable table. Click a row and you land on a detail page with the metadata, copy-able snippets for every host framework, and a live preview area (when the remote is reachable from the portal's network).

## Roadmap

Hand-writing a wrapper file per exposed component is exactly the kind of boilerplate Nexus exists to remove. The next iteration of `@bimo-dk/nexus-build` will scan `src/` for components annotated with `@NexusComponent` (TypeScript decorator for Angular, JSDoc marker for Vue and React) and emit the exposes map, the wrapper files, the catalog entries, and the `vite.config.ts` preset itself. Until that lands, the snippet above is the canonical pattern.

## Where to next

- **[Cross-framework deep dive — guide-mixed-stack](guide-mixed-stack.md)** — an Angular shell loading a Vue remote and a React remote.
- **[Portal Component Catalog](../infrastructure/infra-portal.md)** — how to discover components and copy the implementation snippet from a single page.
- **[BYOF pattern in the runtime adapters](../packages/nexus-runtime.md)** — package-side reference for `NexusComponent` and the BYOF detector.

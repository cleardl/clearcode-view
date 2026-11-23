import type { Mermaid, MermaidConfig } from 'mermaid';
import { spacedElk } from './layout.js';

let enginePromise: Promise<Mermaid> | undefined;
let layoutPromise: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();

/** Serialize every parse and draw because Mermaid owns mutable global configuration. */
export function withMermaid<T>(configuration: MermaidConfig, operation: (engine: Mermaid) => Promise<T>, layout = false): Promise<T> {
  const task = queue.then(async () => {
    enginePromise ??= import('mermaid').then(module => module.default);
    const engine = await enginePromise;
    if (layout) {
      layoutPromise ??= import('@mermaid-js/layout-elk').then(module => {
        const layered = module.default.find(value => value.name === 'elk');
        if (!layered) throw new Error('Mermaid ELK 布局入口不兼容');
        engine.registerLayoutLoaders([spacedElk({ ...layered, name: 'ccv-elk' })]);
      });
      await layoutPromise;
    }
    engine.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, ...configuration });
    return operation(engine);
  });
  queue = task.catch(() => undefined);
  return task;
}

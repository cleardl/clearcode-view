import type { ArchifyRendererOptions } from '../../src/renderers.js';

/** Match the pinned reference's visual presets without putting presentation fields in Mermaid. */
export const archifyExamplePresentation: ArchifyRendererOptions = {
  diagrams: {
    'production-deployment': { preset: 'blueprint', engineeringProfile: 'deployment-ownership' },
    'agent-workflow': { preset: 'signal-flow' },
    'incident-response': { preset: 'signal-flow' },
    'async-jobs': { preset: 'signal-flow' },
    'event-stream': { preset: 'signal-flow' },
    'deployment-lifecycle': { preset: 'signal-flow' },
    'checkout-changes-before': { preset: 'signal-flow' },
    'checkout-changes-after': { preset: 'signal-flow' },
  },
};

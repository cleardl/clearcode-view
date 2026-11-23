// Adapted from tt-a1i/archify; see ../NOTICE.md and sources.json.
import { compileWorkflow } from './workflow-compiler.mjs';
export function render(input) { const result = compileWorkflow({ workflow: input, qualityProfile: input.meta?.quality_profile }); if (!result.ok) { const error = new Error(result.error || 'Workflow compilation failed'); error.archifyDiagnostics = result.diagnostics; throw error; } return { svg: result.svg, report: result.receipt }; }

// Adapted from tt-a1i/archify; see ../NOTICE.md and sources.json.
import { compileDataflow } from './dataflow-compiler.mjs';
export function render(input) { return { svg: compileDataflow({ dataflow: input, qualityProfile: input.meta?.quality_profile }) }; }

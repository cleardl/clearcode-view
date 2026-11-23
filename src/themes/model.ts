import type { MermaidConfig } from 'mermaid';
import type { DiagramRenderer } from '../renderers/model.js';

/** Presentation settings are supplied by the host, independently of Markdown. */
export interface ClearcodeTheme {
  id: string;
  label: string;
  colorScheme?: 'light' | 'dark';
  variables: Record<`--${string}`, string>;
  mermaid: Pick<MermaidConfig, 'theme' | 'look' | 'themeVariables'>;
}

/** Hosts may replace the available themes or choose an initial theme. */
export interface ClearcodeViewOptions { themes?: ClearcodeTheme[]; theme?: string; renderer?: DiagramRenderer; renderers?: DiagramRenderer[]; preferenceKey?: string | false }

/** Native Mermaid classes and participant properties may name these roles. */
export const semanticRoles = ['frontend', 'backend', 'database', 'security', 'messagebus', 'cloud', 'external'] as const;
export type SemanticRole = typeof semanticRoles[number];

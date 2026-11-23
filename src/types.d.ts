declare module 'markdown-it-attrs' {
  import type MarkdownIt from 'markdown-it';
  const plugin: (md: MarkdownIt, options?: { allowedAttributes?: string[] }) => void;
  export default plugin;
}

declare module 'markdown-it-container' {
  import type MarkdownIt from 'markdown-it';
  const plugin: (md: MarkdownIt, name: string, options?: { validate?: (info: string) => boolean }) => void;
  export default plugin;
}

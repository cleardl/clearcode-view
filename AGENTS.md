# Repository guidance

Read docs/architecture.md before changing implementation responsibilities, and docs/protocol.md before changing authored syntax. README.md records the current implementation status.

Keep Mermaid diagram definitions in their native syntax. Project-owned metadata describes reading interactions and document references; it must not duplicate the graph structure or explanatory prose.

Keep protocol parsing independent of Vue, browser APIs and VitePress. Isolate diagram-specific Mermaid element mapping from shared UI behavior. Use maintained dependencies for Markdown, YAML, validation and rendering.

Graph selection, collapse state and camera state are distinct. Preserve the interaction requirements in docs/protocol.md. Bind listeners and observers to component lifetimes, including route changes.

Use generic examples in this repository. Business knowledge, private source excerpts and project source-version mappings belong to their business repositories.

Update the canonical protocol, usage or architecture document alongside an implemented change. Report design intent separately from tested behavior. Validate root SKILL.md with the available skill validator after changing it.

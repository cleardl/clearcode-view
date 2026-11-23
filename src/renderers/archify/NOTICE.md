# Archify browser drawing port

The ten drawing engines and their shared dependencies in upstream/ are adapted from tt-a1i/archify at commit 7e45f36c66de1254d5ad6ba1d878f6499ea269fd. Original paths and SHA-256 digests are recorded in upstream/sources.json. The scoped drawing CSS, light/dark palettes and embedded fonts are generated from archify/assets/template.html at the same commit.

Upstream: https://github.com/tt-a1i/archify. Licensed under Apache-2.0; see LICENSE.txt and UPSTREAM-NOTICE.txt. The browser adaptation removes CLI and filesystem entrypoints, viewer scripts and network brand capture. It preserves drawing, validation, layout, routing and localization, with small semantic hooks for shared reading interactions. The adapter code outside upstream/ projects Mermaid into this internal drawing input; reference JSON and HTML are not runtime inputs.

Bundled brand paths retain their individual metadata in upstream/shared/generated-brand-marks.mjs. See THIRD_PARTY_NOTICES.md for third-party marks and the embedded JetBrains Mono font; JetBrainsMono-OFL.txt preserves its SIL Open Font License 1.1. No third-party endorsement is implied.

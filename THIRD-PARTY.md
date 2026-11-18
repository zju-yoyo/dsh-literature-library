# Third-party components

## pdf.js

- **What**: the PDF parsing/text-extraction engine used on the Host to read page
  counts, plain text, and text-layer geometry.
- **Version**: 6.3.289 (`pdfjs-dist` `legacy/build/pdf.min.mjs` and
  `legacy/build/pdf.worker.min.mjs`, vendored under `vendor/pdf/`).
- **License**: Apache License 2.0, reproduced in
  [`vendor/pdf/LICENSE`](vendor/pdf/LICENSE).
- **Upstream**: <https://github.com/mozilla/pdf.js>
- **Modifications**: none; the minified build files are copied verbatim under
  stable names (`pdf.mjs`, `pdf.worker.mjs`).

Everything else in this repository is original work released under the MIT
license in [`LICENSE`](LICENSE).

## Document rendering

The original-page images are produced at runtime by the DSH profile's document
engine (`ctx.officeKit`, backed by the LibreOffice kit shipped with DeepSeek
Harness). No LibreOffice code is redistributed in this repository.

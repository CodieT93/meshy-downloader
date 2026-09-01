# Meshy Downloader

A Chromium extension that saves your [Meshy](https://www.meshy.ai) 3D models as GLB files, plus any intercepted PNG textures.

Meshy can generate models under a CC0 license but still gate the download behind a paid plan. This extension does not talk to Meshy’s servers. It waits until the on-page 3D viewer has already decrypted the model, then lets you save a local copy.

## Install

Works in Chrome, Edge, Brave, and other Chromium browsers.

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.

Reload the extension on that same page after you change the code.

## Use

1. Open a model page on [meshy.ai](https://www.meshy.ai).
2. Wait until the 3D viewer finishes loading.
3. Download from either:
   - the floating **Download** button on the page (drag it if it gets in the way)
   - the extension popup → **Download all**

The popup stays disabled until a GLB has been intercepted. If you open a different model, the previous files are cleared and the new one is captured.

## How it works

Everything runs in your browser. Nothing is uploaded.

1. The content script starts before the page’s JavaScript.
2. It wraps `Worker` and watches Meshy’s decrypt worker. When that worker posts a `glTF` buffer, the extension keeps a copy.
3. It wraps `fetch` and keeps PNG textures loaded from `assets.meshy.ai`.
4. Those files are stored in IndexedDB in the page, then downloaded as `.glb` / `.png`.

## Disclaimer

For personal use with models you generated yourself. You are responsible for Meshy’s terms of service, copyright law, and platform rules. This does not bypass login or reach other people’s assets.

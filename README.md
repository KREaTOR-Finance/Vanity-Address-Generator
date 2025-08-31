# XRPL Vanity r-address Generator (xApp-ready)

Client-side React + TypeScript app that brute-forces XRPL classic addresses starting with your chosen prefix (after the fixed `r`). Uses Web Workers and `xrpl.js` in the worker, no network calls, safe for GitHub Pages.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

- Set base path when building (replace `/your-repo/`):
  - PowerShell (Windows):
    ```powershell
    $env:VITE_BASE_PATH = '/your-repo/'
    npm run build
    ```
  - macOS/Linux:
    ```bash
    VITE_BASE_PATH=/your-repo/ npm run build
    ```
- Publish `dist/` to Pages. Your app will work entirely client-side.

## Security: CSP

`index.html` includes a CSP suitable for this app:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' https://unpkg.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://unpkg.com; img-src 'self' data:; font-src 'self' data:;">
```

## Notes
- Longer prefixes grow exponentially (×58 per extra char). 5 letters ≈ minutes; 6 ≈ hours; 7+ ≈ days.
- Mobile devices are slower and may throttle under heavy load.
- Keep seeds offline. To import into Xaman: Add Account → Full access → paste seed.

## Tech
- React 18, Vite, TypeScript
- Web Worker via Blob URL, `xrpl.js` loaded in worker from CDN
- Modular UI components and minimal CSS (no Tailwind dependency) 
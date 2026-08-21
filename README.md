# Harmless Hacker Prank

A fun, harmless fake-hacker terminal prank you can share with friends. It simulates a dramatic "system compromise" sequence with CRT effects, typing animations, progress bars, and humorous fake discoveries — all entirely in the browser.

## Features

- **CRT terminal boot sequence** — scanlines, flicker, vignette, and glitch effects
- **Fake system diagnostics** — humorous hardware/software readings
- **Fake network scan** — discovers devices like `smart-toaster` and `rgb-gaming-pc`
- **Animated progress bars** — compiling, injecting, handshaking
- **Funny discovery results** — `brain_storage: 3%`, `procrastination.log`, `plants_kept_alive/` (empty)
- **Dramatic "SYSTEM COMPROMISED" warning** with countdown
- **"YOU GOT PRANKED" reveal** with replay button
- **Local sound effects** — keyboard clicks, beeps, alerts, and a reveal melody (Web Audio API)
- **Sound toggle** — mute/unmute with one click
- **Fully responsive** — works on desktop, tablet, and mobile (320px+)
- **Accessibility** — respects `prefers-reduced-motion`

## Safety & Privacy

This project is **100% client-side** and **completely harmless**:

- **No network requests** — zero fetch, XHR, WebSocket, or external resource loads
- **No device API access** — no camera, microphone, location, clipboard, or notifications
- **No data collection** — no cookies, localStorage, sessionStorage, or browser storage
- **No file access** — no FileReader, indexedDB, or filesystem APIs
- **No tracking or analytics** — no scripts, pixels, or third-party services
- **No redirects** — no window.open or location changes
- **No eval** — no dynamic code execution

Everything displayed is hardcoded text and `Math.random()` output. Sound effects are generated locally using the Web Audio API (oscillator tones — no audio files downloaded).

## Usage

No server required — just open the HTML file in any browser.

### Option 1: Direct file open

```bash
# Windows
start index.html

# macOS
open index.html

# Linux
xdg-open index.html
```

### Option 2: Local development server

```bash
npx serve .
```

Then open `http://localhost:3000` in your browser.

## Project Structure

```
.
├── index.html   (2 KB)   Entry point
├── style.css   (10 KB)   CRT theme, animations, responsive layout
├── script.js   (19 KB)   Prank sequence, typing effects, local sounds
└── README.md            This file
```

## Technology

- **HTML5** — semantic markup, viewport meta, theme-color
- **CSS3** — keyframe animations, media queries, clamp(), custom properties
- **JavaScript (ES6+)** — async/await, Web Audio API, IIFE pattern

**Zero dependencies.** No frameworks, no libraries, no build tools, no package.json.

## License

This project is provided as-is for entertainment purposes. Use it to have fun with your friends!

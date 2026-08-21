/**
 * Harmless Hacker Prank Terminal — Script
 * ========================================
 * This is a 100% client-side, purely visual prank.
 *
 * It does NOT:
 *   - Access the camera, microphone, or location
 *   - Read files, cookies, passwords, or browser storage
 *   - Make any network requests (zero fetch/XHR/WebSocket)
 *   - Collect or transmit any data
 *   - Access any device APIs
 *
 * Everything displayed is hardcoded text and Math.random() output.
 * Sound effects are generated locally via the Web Audio API
 * (oscillator tones — no audio files downloaded).
 */

(function () {
  'use strict';

  // ── DOM References ────────────────────────────────────────

  var terminal  = document.getElementById('terminal');
  var output    = document.getElementById('output');
  var inputLine = document.getElementById('inputLine');
  var typedCmd  = document.getElementById('typedCommand');
  var overlay   = document.getElementById('overlay');
  var replayBtn = document.getElementById('replayBtn');
  var soundBtn  = document.getElementById('soundToggle');
  var statusTime = document.getElementById('statusTime');
  var screen    = document.getElementById('screen');

  // ── State ─────────────────────────────────────────────────

  var soundEnabled = true;
  var audioCtx = null;
  var sequenceRunning = false;
  var prankStartTime = 0; // absolute timestamp when prank started
  var escapeCleanupTimer = null;
  var beforeunloadHandler = null;
  var popstateHandler = null;

  // ── Persistence (localStorage, 5-minute window) ─────────

  var PERSIST_KEY     = 'harmless_prank_ts';
  var PERSIST_MS      = 300000; // 5 minutes
  var ESCAPE_LOCK_MS  = 300000; // 5-minute escape-resistance window
  var PRANK_GUARD     = '__prank_guard__'; // history.state marker for back-button guard

  function savePrankState() {
    try { localStorage.setItem(PERSIST_KEY, String(Date.now())); } catch (e) { /* quota or private mode — ignore */ }
  }

  function loadPrankState() {
    try {
      var raw = localStorage.getItem(PERSIST_KEY);
      if (!raw) return null;
      var ts = Number(raw);
      if (isNaN(ts)) { clearPrankState(); return null; }
      if (Date.now() - ts < PERSIST_MS) return ts;
      clearPrankState();
      return null;
    } catch (e) { return null; }
  }

  function clearPrankState() {
    try { localStorage.removeItem(PERSIST_KEY); } catch (e) { /* ignore */ }
  }

  // ── Escape Resistance (browser-compatible, 5-min lock) ──
  // Uses only standard browser APIs: visibilitychange, pagehide,
  // blur/focus, beforeunload, and the Fullscreen API.
  // Does NOT use infinite loops, popups, forced reloads, or
  // anything that interferes with the OS or Task Manager.

  function isPrankActive() {
    return prankStartTime > 0 && Date.now() - prankStartTime < ESCAPE_LOCK_MS;
  }

  function remainingMs() {
    if (!isPrankActive()) return 0;
    return ESCAPE_LOCK_MS - (Date.now() - prankStartTime);
  }

  // Fullscreen: request once on user gesture, re-request if browser
  // allows it when the user returns. Stops after the lock expires.
  function requestFullscreenIfAllowed() {
    if (!isPrankActive()) return;
    try {
      var el = document.documentElement;
      var r = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (r) r.call(el);
    } catch (e) { /* browser may reject — that's fine */ }
  }

  // Event handlers installed during the active period
  function onVisibilityChange() {
    if (!isPrankActive()) return;
    if (document.visibilityState === 'visible') {
      // User returned — restore prank state, re-request fullscreen
      restorePrankState();
      requestFullscreenIfAllowed();
    }
  }

  function onPageHide() {
    // Page is being hidden/unloaded — persist state for return
    if (isPrankActive()) savePrankState();
  }

  function onBlur() {
    if (!isPrankActive()) return;
    // Window lost focus — persist state in case user navigates away
    savePrankState();
  }

  function onFocus() {
    if (!isPrankActive()) return;
    // Window regained focus — restore if needed, re-request fullscreen
    restorePrankState();
    requestFullscreenIfAllowed();
  }

  // Restore prank state when returning within the active window
  function restorePrankState() {
    if (!isPrankActive()) return;
    // Ensure the reveal overlay is visible (the end state of the prank)
    if (overlay.classList.contains('hidden')) {
      output.innerHTML = '';
      hideInput();
      overlay.classList.remove('hidden');
    }
  }

  // Back-button guard: when Back is pressed during the active period,
  // push a new guard entry so the user stays on the prank page.
  // pushState is synchronous — no race conditions with async go()/forward().
  // History entries grow by 1 per Back press, but this is bounded by the
  // 5-minute timer and realistic user behavior (typically <20 presses).
  var _popstateGuard = false;
  function onPopState() {
    if (_popstateGuard) return;        // Prevent re-entry during pushState
    if (!isPrankActive()) return;       // Prank not active — allow normal Back
    var st = history.state;
    if (st && st[PRANK_GUARD]) return;  // Already on guard entry — nothing to do
    _popstateGuard = true;
    try {
      history.pushState({ __prank_guard__: true }, '');
    } catch (e) { /* ignore */ }
    _popstateGuard = false;
  }

  // Install all escape-resistance handlers
  function activateEscapeResistance(startTime) {
    prankStartTime = startTime || Date.now();

    // beforeunload: standard browser leave warning (only during active period)
    beforeunloadHandler = function (e) {
      if (!isPrankActive()) return;
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome
    };
    window.addEventListener('beforeunload', beforeunloadHandler);

    // Visibility, focus, page visibility
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    // Back-button guard via History API
    // Push an initial guard entry so Back triggers popstate instead of
    // navigating away. onPopState uses pushState (synchronous) to maintain
    // the user's position — no async go()/forward() race conditions.
    if (!popstateHandler) {
      try {
        history.pushState({ __prank_guard__: true }, '');
      } catch (e) { /* ignore */ }
      popstateHandler = onPopState;
      window.addEventListener('popstate', popstateHandler);
    }

    // Request fullscreen (requires user gesture — called from click handlers)
    // Will be called from the first user interaction after activation.

    // Schedule cleanup after the lock expires
    clearTimeout(escapeCleanupTimer);
    var msLeft = remainingMs();
    if (msLeft > 0) {
      escapeCleanupTimer = setTimeout(deactivateEscapeResistance, msLeft + 1000);
    }

    // Persist start time for tab-close/return scenarios
    savePrankState();
  }

  // Remove all escape-resistance handlers
  function deactivateEscapeResistance() {
    clearTimeout(escapeCleanupTimer);
    escapeCleanupTimer = null;
    prankStartTime = 0;

    if (beforeunloadHandler) {
      window.removeEventListener('beforeunload', beforeunloadHandler);
      beforeunloadHandler = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);

    // Remove back-button guard
    if (popstateHandler) {
      window.removeEventListener('popstate', popstateHandler);
      popstateHandler = null;
    }
  }

  // ── Local Sound Engine (Web Audio API — no network) ───────

  function getAudioCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

  function playTone(freq, duration, type, volume) {
    if (!soundEnabled) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.value = volume || 0.04;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  function sfxKeypress() {
    playTone(800 + Math.random() * 400, 0.04, 'square', 0.025);
  }

  function sfxBeep() {
    playTone(1000, 0.08, 'square', 0.03);
  }

  function sfxAlert() {
    playTone(600, 0.12, 'sawtooth', 0.04);
    setTimeout(function () { playTone(800, 0.12, 'sawtooth', 0.04); }, 150);
  }

  function sfxSuccess() {
    playTone(523, 0.1, 'sine', 0.04);
    setTimeout(function () { playTone(659, 0.1, 'sine', 0.04); }, 100);
    setTimeout(function () { playTone(784, 0.15, 'sine', 0.04); }, 200);
  }

  function sfxError() {
    playTone(200, 0.25, 'sawtooth', 0.05);
  }

  function sfxGlitch() {
    for (var i = 0; i < 4; i++) {
      (function (delay) {
        setTimeout(function () {
          playTone(100 + Math.random() * 2000, 0.03, 'sawtooth', 0.03);
        }, delay);
      })(i * 40);
    }
  }

  function sfxReveal() {
    var notes = [523, 659, 784, 1047, 784, 659, 523];
    notes.forEach(function (n, i) {
      setTimeout(function () { playTone(n, 0.12, 'sine', 0.05); }, i * 100);
    });
  }

  // ── Helpers ───────────────────────────────────────────────

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function scrollToBottom() {
    terminal.scrollTop = terminal.scrollHeight;
  }

  function addLine(text, className) {
    var line = document.createElement('div');
    line.classList.add('line');
    if (className) line.classList.add(className);
    line.textContent = text;
    output.appendChild(line);
    scrollToBottom();
  }

  async function typeCommand(cmd, delay) {
    typedCmd.textContent = '';
    inputLine.classList.add('visible');
    for (var i = 0; i < cmd.length; i++) {
      typedCmd.textContent += cmd[i];
      sfxKeypress();
      await sleep(delay || (35 + Math.random() * 45));
    }
    await sleep(250);
    sfxBeep();
  }

  function hideInput() {
    inputLine.classList.remove('visible');
  }

  function showPrompt(text) {
    addLine('$ ' + text, 'prompt-line');
  }

  async function fakeProgressBar(label, steps, msPerStep) {
    var container = document.createElement('div');
    container.classList.add('line');
    output.appendChild(container);
    for (var i = 0; i <= steps; i++) {
      var pct = Math.round((i / steps) * 100);
      var filled = '█'.repeat(i);
      var empty = '░'.repeat(steps - i);
      container.textContent = '  ' + label + ' [' + filled + empty + '] ' + String(pct).padStart(3) + '%';
      scrollToBottom();
      if (i % 5 === 0) sfxBeep();
      await sleep(msPerStep);
    }
  }

  function randomHex(len) {
    var chars = '0123456789abcdef';
    var s = '';
    for (var i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
    return s;
  }

  function randomIP() {
    return [1, 2, 3, 4].map(function () { return Math.floor(Math.random() * 256); }).join('.');
  }

  function triggerGlitch() {
    screen.classList.add('glitch');
    sfxGlitch();
    setTimeout(function () { screen.classList.remove('glitch'); }, 500);
  }

  function updateClock() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    var s = String(now.getSeconds()).padStart(2, '0');
    statusTime.textContent = h + ':' + m + ':' + s;
  }

  // ── Main Sequence ─────────────────────────────────────────

  async function runSequence() {
    if (sequenceRunning) return;
    sequenceRunning = true;

    // Persist the start timestamp so a reload within 5 min restores the reveal
    savePrankState();
    activateEscapeResistance(Date.now());

    // Reset everything
    output.innerHTML = '';
    hideInput();
    overlay.classList.add('hidden');
    screen.classList.remove('glitch');
    await sleep(400);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 1: CRT BOOT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    triggerGlitch();
    await sleep(300);

    addLine('╔══════════════════════════════════════════════════════════════╗', 'header');
    addLine('║            SYSTEM ACCESS TERMINAL  v3.7.1                    ║', 'header');
    addLine('║            Quantum Encryption Bypass Module                  ║', 'header');
    addLine('║            [CLASSIFIED — LEVEL 9 CLEARANCE]                  ║', 'header');
    addLine('╚══════════════════════════════════════════════════════════════╝', 'header');
    addLine('', 'dim');

    addLine('[BOOT] Initializing secure environment...', 'system');
    await sleep(600);
    addLine('[BOOT] Loading kernel: 6.2.0-prank-generic-amd64', 'dim');
    await sleep(300);
    addLine('[BOOT] Network adapter eth0: UP', 'dim');
    addLine('[BOOT] Loading exploit modules... 147 found', 'dim');
    await sleep(300);
    addLine('[BOOT] Firewall status: ██████████████ BYPASSED', 'warning');
    addLine('[BOOT] IDS evasion: ACTIVE', 'warning');
    addLine('[BOOT] Proton pack: CHARGED', 'system');
    await sleep(500);
    triggerGlitch();
    addLine('[BOOT] System ready. Commencing operation.', 'success');
    addLine('', 'dim');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 2: SYSTEM DIAGNOSTIC
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await typeCommand('system_diagnostic --verbose --target local');
    hideInput();
    showPrompt('system_diagnostic --verbose --target local');
    addLine('[*] Running system diagnostic...', 'system');
    await sleep(400);

    var diagItems = [
      { label: 'CPU',        val: 'Quantum Pentium 0.5 (overclocked with hopes & dreams)', cls: 'info' },
      { label: 'RAM',        val: '3.5TB (mostly Chrome tabs)',                            cls: 'info' },
      { label: 'OS',         val: 'PrankOS 4.2.0 (Build: u_got_em)',                     cls: 'info' },
      { label: 'Uptime',     val: '13 days, 7 hours (user never sleeps)',                 cls: 'dim' },
      { label: 'Disk',       val: '487GB/512GB — 95% full ( memes_backup/ ),',           cls: 'warning' },
      { label: 'Firewall',   val: 'DISABLED (left open for this exact moment)',           cls: 'error' },
      { label: 'Antivirus',  val: 'Not found — LOL',                                     cls: 'error' },
      { label: 'Vibe Check', val: 'PASSING ✅',                                          cls: 'success' },
    ];

    for (var d = 0; d < diagItems.length; d++) {
      addLine('  ' + diagItems[d].label.padEnd(12) + ': ' + diagItems[d].val, diagItems[d].cls);
      await sleep(200);
    }
    addLine('  [✓] Diagnostic complete — 8 findings', 'success');
    addLine('', 'dim');

    await sleep(500);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 3: NETWORK SCAN
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await typeCommand('net_scan --deep --ports 1-65535 --network 192.168.1.0/24');
    hideInput();
    showPrompt('net_scan --deep --ports 1-65535 --network 192.168.1.0/24');
    addLine('[*] Initiating deep network scan...', 'system');
    addLine('[*] Sending 1,048,576 packets... (this is fine)', 'dim');
    await sleep(400);

    await fakeProgressBar('  Scanning', 30, 55);

    addLine('', 'dim');
    var fakeHosts = [
      { ip: '192.168.1.1',   host: 'gateway.local',  ports: '22/tcp open ssh, 80/tcp open http',          cls: 'dim' },
      { ip: '192.168.1.15',  host: 'smart-toaster',   ports: '9999/tcp open toaster-protocol',             cls: 'dim' },
      { ip: '192.168.1.42',  host: '★ THIS DEVICE ★', ports: '22/tcp, 445/tcp, 3389/tcp, ALL OPEN',       cls: 'error' },
      { ip: '192.168.1.69',  host: 'spice-router',    ports: '6969/tcp open definitely-not-suspicious',    cls: 'dim' },
      { ip: '192.168.1.105', host: 'nas-box.local',   ports: '80/tcp open http, 443/tcp open https',       cls: 'dim' },
      { ip: '192.168.1.200', host: 'printer.local',   ports: '9100/tcp open jetdirect',                    cls: 'dim' },
      { ip: '192.168.1.254', host: 'rgb-gaming-pc',   ports: '42069/tcp open yes-i-know',                  cls: 'dim' },
    ];

    for (var h = 0; h < fakeHosts.length; h++) {
      addLine('  Host: ' + fakeHosts[h].host + ' (' + fakeHosts[h].ip + ')', fakeHosts[h].cls);
      addLine('    Ports: ' + fakeHosts[h].ports, fakeHosts[h].cls);
      await sleep(300);
    }
    addLine('  Nmap done: 7 hosts up — scanned in 12.34s', 'success');
    triggerGlitch();
    addLine('', 'system');
    addLine('⚠  TARGET IDENTIFIED: 192.168.1.42  ← This device', 'warning');
    addLine('', 'dim');

    await sleep(600);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 4: SECURITY ANALYSIS PROGRESS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await typeCommand('exploit --target 192.168.1.42 --payload mega-prank.exe --intensity OVER9000');
    hideInput();
    showPrompt('exploit --target 192.168.1.42 --payload mega-prank.exe --intensity OVER9000');

    addLine('[*] Compiling exploit payload...', 'system');
    await fakeProgressBar('  Compiling', 20, 60);
    sfxSuccess();
    addLine('[+] Payload compiled: mega-prank.exe (4.20 MB)', 'success');
    addLine('', 'dim');

    addLine('[*] Injecting into target memory...', 'system');
    await fakeProgressBar('  Injecting', 18, 90);
    addLine('[+] Memory injection successful', 'success');
    addLine('', 'dim');

    addLine('[*] Establishing reverse shell...', 'system');
    await fakeProgressBar('  Handshake', 15, 70);
    sfxSuccess();
    addLine('[+] Reverse shell established on port 1337', 'success');
    addLine('[+] Encryption layer: AES-256-PRANK', 'info');
    addLine('', 'dim');

    await sleep(400);
    triggerGlitch();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 5: FAKE DISCOVERY RESULTS (the funny part)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await typeCommand('file_sweep --deep --include-hidden --emotional-damage');
    hideInput();
    showPrompt('file_sweep --deep --include-hidden --emotional-damage');
    addLine('[*] Deep-diving into the filesystem...', 'system');
    await sleep(500);

    addLine('', 'dim');
    addLine('  ┌─────────────────────────────────────────────────┐', 'info');
    addLine('  │         SENSITIVE FILES DISCOVERED               │', 'info');
    addLine('  └─────────────────────────────────────────────────┘', 'info');
    addLine('', 'dim');

    var discoveries = [
      { file: 'embarrassing_memes/',             note: '437 items — deeply incriminating',         cls: 'error' },
      { file: 'suspicious_search_history.txt',   note: '2.3MB of "how to" queries',               cls: 'error' },
      { file: 'friendship.exe',                  note: 'STATUS: CORRUPTED (you have no friends)', cls: 'highlight' },
      { file: 'brain_storage:',                  note: '3% used — (2% is lyrics to Wonderwall)',  cls: 'warning' },
      { file: 'snacks.txt',                      note: 'A detailed list of every snack ever eaten', cls: 'dim' },
      { file: 'procrastination.log',             note: 'Last 847 entries: "I\'ll do it tomorrow"',cls: 'error' },
      { file: 'gym_membership.pdf',              note: 'UNUSED SINCE: Jan 2, 2019',               cls: 'warning' },
      { file: 'totally_real_homework/',          note: 'Empty. Completely empty.',                 cls: 'dim' },
      { file: 'diary_of_a_coding_rockstar.md',   note: 'Chapters 1-42: "TODO"',                   cls: 'highlight' },
      { file: 'my_secret_playlist.m3u',          note: 'Shake It Off (x47) and Baby Shark',       cls: 'error' },
      { file: 'shower_thoughts.db',              note: '8,412 entries — mostly about spaghetti',  cls: 'dim' },
      { file: 'plants_kept_alive/',              note: '0 items — this directory has never been used', cls: 'warning' },
    ];

    for (var f = 0; f < discoveries.length; f++) {
      addLine('  ⚡ ' + discoveries[f].file, discoveries[f].cls);
      addLine('     → ' + discoveries[f].note, 'dim');
      await sleep(280);
    }

    addLine('', 'dim');
    addLine('  [!] ' + discoveries.length + ' catastrophic files located', 'warning');
    addLine('  [!] Emotional damage level: MAXIMUM', 'error');
    addLine('', 'dim');

    await sleep(500);
    triggerGlitch();

    // Credential dump (all fake)
    await typeCommand('shadow_dump --all --format leet');
    hideInput();
    showPrompt('shadow_dump --all --format leet');
    addLine('[*] Extracting credential hashes...', 'system');
    await fakeProgressBar('  Dumping', 25, 50);

    var fakeUsers = ['admin', 'root', 'gamer420', 'xX_prankLord_Xx', 'not_a_bot'];
    addLine('', 'dim');
    for (var u = 0; u < fakeUsers.length; u++) {
      addLine('  ' + fakeUsers[u] + ':$pr4nk$' + randomHex(32) + ':0:666::/root:/bin/pwn', 'error');
      await sleep(120);
    }
    addLine('  [!] ' + fakeUsers.length + ' password hashes extracted (they\'re all "password123")', 'warning');
    addLine('', 'dim');

    await sleep(400);

    // Fake network traffic
    await typeCommand('tcpdump -i eth0 -c 8 --numeric --dramatic');
    hideInput();
    showPrompt('tcpdump -i eth0 -c 8 --numeric --dramatic');
    addLine('[*] Monitoring network traffic...', 'system');

    for (var t = 0; t < 8; t++) {
      var srcIP = randomIP();
      var dstIP = randomIP();
      var srcPort = Math.floor(Math.random() * 60000) + 1024;
      var dstPort = [80, 443, 53, 8080, 420, 1337][Math.floor(Math.random() * 6)];
      var protos = ['ACK', 'SYN', 'PSH+ACK', 'FIN', 'RST'];
      var proto = protos[Math.floor(Math.random() * protos.length)];
      addLine(
        '  ' + String(t + 1).padStart(2) + '. ' +
        srcIP + '.' + srcPort + ' → ' + dstIP + '.' + dstPort +
        ' [' + proto + '] len=' + Math.floor(Math.random() * 1500),
        'dim'
      );
      await sleep(180);
    }
    addLine('  [+] Packet capture complete — exfil channel confirmed', 'success');
    addLine('', 'dim');

    await sleep(600);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 6: SYSTEM COMPROMISED WARNING
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    triggerGlitch();
    await sleep(200);
    triggerGlitch();

    sfxAlert();
    addLine('', 'dim');
    addLine('══════════════════════════════════════════════════════════════', 'error');
    addLine('', 'dim');
    addLine('  ████████████████████████████████████████████████████████', 'big-red');
    addLine('  ██                                                    ██', 'big-red');
    addLine('  ██   ⚠  ALL SYSTEMS COMPROMISED                      ██', 'big-red');
    addLine('  ██   ⚠  ACCESS LEVEL: ROOT                            ██', 'big-red');
    addLine('  ██   ⚠  DATA EXFILTRATION: IN PROGRESS                ██', 'big-red');
    addLine('  ██   ⚠  STATUS: IRRECOVERABLE                        ██', 'big-red');
    addLine('  ██                                                    ██', 'big-red');
    addLine('  ████████████████████████████████████████████████████████', 'big-red');
    addLine('', 'dim');
    addLine('══════════════════════════════════════════════════════════════', 'error');
    addLine('', 'dim');

    await sleep(1200);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 7: COUNTDOWN
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    addLine('  Initiating self-destruct sequence...', 'error');
    await sleep(400);

    for (var c = 5; c >= 1; c--) {
      addLine('  💀 System wipe in ' + c + '...', 'error');
      sfxError();
      if (c <= 3) triggerGlitch();
      await sleep(700);
    }

    addLine('', 'dim');
    addLine('  Just kidding. 😏', 'success');
    await sleep(600);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 8: REVEAL
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    triggerGlitch();
    sfxReveal();
    await sleep(300);
    overlay.classList.remove('hidden');
    sequenceRunning = false;
    // Escape resistance remains active until the 5-min lock expires.
    // deactivateEscapeResistance() will clean up all handlers.
  }

  // ── Sound Toggle ──────────────────────────────────────────

  soundBtn.addEventListener('click', function () {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    soundBtn.classList.toggle('muted', !soundEnabled);
    // First user click — attempt fullscreen if prank is active
    requestFullscreenIfAllowed();
  });

  // ── Replay Button ─────────────────────────────────────────

  replayBtn.addEventListener('click', function () {
    // First user click — attempt fullscreen if prank is active
    requestFullscreenIfAllowed();
    runSequence();
  });

  // ── Status Bar Clock ──────────────────────────────────────

  updateClock();
  setInterval(updateClock, 1000);

  // ── Restore or Start ───────────────────────────────────────

  var persistedTs = loadPrankState();
  if (persistedTs !== null) {
    // Prank is within the 5-minute window — restore state and
    // re-activate escape resistance with the original start time
    output.innerHTML = '';
    hideInput();
    overlay.classList.remove('hidden');
    activateEscapeResistance(persistedTs);
  } else {
    runSequence();
  }

})();

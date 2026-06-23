"use strict";

const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock } = goals;
const config = require("./settings.json");
const express = require("express");
const http = require("http");
const https = require("https");

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 5000;

let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  errors: [],
  wasThrottled: false,
};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} Dashboard</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" media="print" onload="this.media='all'"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          body { font-family: 'Inter', -apple-system, sans-serif; background: #0d1117; color: #e6edf3; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 24px; }
          main { width: 100%; max-width: 400px; }
          header { margin-bottom: 28px; }
          header h1 { font-size: 26px; font-weight: 700; color: #f0f6fc; margin: 0; }
          header p { font-size: 14px; color: #8b949e; margin: 6px 0 0; }
          .status-section { border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; display: flex; align-items: center; gap: 16px; transition: background 0.3s, border-color 0.3s; }
          .status-section.online  { background: #0d2218; border: 2px solid #238636; }
          .status-section.offline { background: #200d0d; border: 2px solid #da3633; }
          .status-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
          .status-icon.online  { background: #238636; }
          .status-icon.offline { background: #da3633; }
          .status-label { font-size: 18px; font-weight: 700; }
          .status-label.online  { color: #3fb950; }
          .status-label.offline { color: #f85149; }
          .status-detail { font-size: 13px; color: #8b949e; margin-top: 3px; }
          dl { margin: 0; }
          .stat-card { background: #161b22; border: 1px solid #21262d; border-radius: 10px; padding: 16px 20px; margin-bottom: 10px; }
          dt { font-size: 12px; color: #8b949e; font-weight: 600; margin-bottom: 4px; }
          dd { margin: 0; font-size: 17px; font-weight: 600; color: #e6edf3; }
          .stat-detail { margin: 4px 0 0; font-size: 11px; color: #6e7681; }
          .controls { margin-top: 8px; }
          .btn-grid { display: grid; gap: 10px; margin-bottom: 10px; }
          .btn-grid-2 { grid-template-columns: 1fr 1fr; }
          .btn-primary { min-height: 52px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity 0.2s, filter 0.2s; font-family: inherit; }
          .btn-primary:hover { filter: brightness(1.1); }
          .btn-start { border: 2px solid #238636; background: #0d2218; color: #3fb950; }
          .btn-stop  { border: 2px solid #da3633; background: #200d0d; color: #f85149; }
          .btn-secondary { min-height: 44px; border-radius: 10px; border: 1px solid #21262d; background: #161b22; color: #8b949e; font-size: 13px; font-weight: 500; text-decoration: none; display: flex; align-items: center; justify-content: center; font-family: inherit; cursor: pointer; transition: background 0.2s; }
          .btn-secondary:hover { background: #21262d; color: #c9d1d9; }
          footer { margin-top: 20px; text-align: center; }
          footer p { font-size: 12px; color: #484f58; margin: 0; }
        </style>
      </head>
      <body>
        <main>
          <header><h1>AFK Bot Dashboard</h1><p>Minecraft server bot · Live status</p></header>
          <section id="status-section" class="status-section offline">
            <div id="status-icon" class="status-icon offline">✗</div>
            <div>
              <div id="status-label" class="status-label offline">Connecting…</div>
              <div id="status-detail" class="status-detail">Establishing connection</div>
            </div>
          </section>
          <section>
            <dl>
              <div class="stat-card"><dt>Uptime</dt><dd id="uptime-text">—</dd><p class="stat-detail">Time since last connection</p></div>
              <div class="stat-card"><dt>Coordinates</dt><dd id="coords-text">Searching…</dd><p class="stat-detail">Bot's current in-game position</p></div>
              <div class="stat-card"><dt>Server address</dt><dd>${config.server.ip}</dd><p class="stat-detail">Minecraft server hostname</p></div>
            </dl>
          </section>
          <section class="controls">
            <div class="btn-grid btn-grid-2">
              <button class="btn-primary btn-start" onclick="startBot()">Start bot</button>
              <button class="btn-primary btn-stop" onclick="stopBot()">Stop bot</button>
            </div>
            <div class="btn-grid btn-grid-2">
              <a href="/tutorial" class="btn-secondary">Setup guide</a>
              <a href="/logs" class="btn-secondary">View logs</a>
            </div>
          </section>
          <footer><p>Status updates every 5 seconds</p></footer>
        </main>
        <script>
          function formatUptime(s) {
            const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
            if (h > 0) return h+'h '+m+'m '+sec+'s';
            if (m > 0) return m+'m '+sec+'s';
            return sec+' seconds';
          }
          async function update() {
            try {
              const r = await fetch('/health');
              const data = await r.json();
              const online = data.status === 'connected';
              const section = document.getElementById('status-section');
              const icon = document.getElementById('status-icon');
              const label = document.getElementById('status-label');
              const detail = document.getElementById('status-detail');
              section.className = 'status-section '+(online?'online':'offline');
              icon.className = 'status-icon '+(online?'online':'offline');
              icon.textContent = online?'✓':'✗';
              label.className = 'status-label '+(online?'online':'offline');
              label.textContent = online?'Connected':'Disconnected';
              detail.textContent = online?'Bot is active on the server':'Attempting to reconnect';
              document.getElementById('uptime-text').textContent = formatUptime(data.uptime);
              if (data.coords) {
                const {x, y, z} = data.coords;
                document.getElementById('coords-text').textContent = 'X '+Math.floor(x)+', Y '+Math.floor(y)+', Z '+Math.floor(z);
              } else {
                document.getElementById('coords-text').textContent = 'Searching…';
              }
            } catch(e) {
              document.getElementById('status-label').textContent = 'Unreachable';
            }
          }
          async function startBot() { const r = await fetch('/start',{method:'POST'}); const d = await r.json(); alert(d.success?'Bot started!':d.msg); update(); }
          async function stopBot()  { const r = await fetch('/stop',{method:'POST'});  const d = await r.json(); alert(d.success?'Bot stopped!':d.msg); update(); }
          setInterval(update, 5000);
          update();
        </script>
      </body>
    </html>
  `);
});

app.get("/tutorial", (req, res) => {
  res.send(`<!DOCTYPE html><html lang="en"><head><title>Setup Guide</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;background:#0d1117;color:#e6edf3;padding:40px 24px;margin:0}main{max-width:560px;margin:0 auto}a.back{display:inline-block;margin-bottom:32px;color:#8b949e;text-decoration:none;background:#161b22;border:1px solid #21262d;border-radius:8px;padding:7px 14px}h1{font-size:26px;color:#f0f6fc;margin:0}.card{background:#161b22;border:1px solid #21262d;border-radius:12px;padding:24px;margin-bottom:16px}.step-num{width:32px;height:32px;border-radius:50%;background:#0d2218;border:2px solid #238636;color:#3fb950;font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-right:12px}h2{display:inline;font-size:16px}ul{margin:12px 0 0;padding-left:20px;color:#8b949e;line-height:1.8}code{background:#21262d;padding:2px 7px;border-radius:5px;font-size:12px}</style></head><body><main><a class="back" href="/">← Back</a><h1>Setup Guide</h1><p style="color:#8b949e">Get running in under 15 minutes</p><div class="card"><span class="step-num">1</span><h2>Aternos Config</h2><ul><li>Enable <strong>Cracked</strong> mode</li><li>Install plugins: <code>ViaVersion</code>, <code>ViaBackwards</code></li></ul></div><div class="card"><span class="step-num">2</span><h2>GitHub Setup</h2><ul><li>Upload all 4 files to a GitHub repo</li><li>Edit <code>settings.json</code> with your server IP/port</li></ul></div><div class="card"><span class="step-num">3</span><h2>Deploy on Render (Free 24/7)</h2><ul><li>Import your GitHub repo to <strong>Render.com</strong></li><li>Set run command: <code>npm start</code></li><li>Set <code>RENDER_EXTERNAL_URL</code> env var to your Render URL</li><li>Hit <strong>Deploy</strong> — bot auto-connects and self-pings every 10 min</li></ul></div></main></body></html>`);
});

app.get("/health", (req, res) => {
  res.json({
    status: botState.connected ? "connected" : "disconnected",
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: bot && bot.entity ? bot.entity.position : null,
    lastActivity: botState.lastActivity,
    reconnectAttempts: botState.reconnectAttempts,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
  });
});

app.get("/ping", (req, res) => res.send("pong"));

app.get("/logs", (req, res) => {
  const logs = getLogs();
  const escapeHTML = (str) => str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  res.send(`<!DOCTYPE html><html lang="en"><head><title>Bot Logs</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{font-family:sans-serif;background:#0d1117;color:#e6edf3;margin:0;padding:40px 24px}main{max-width:760px;margin:0 auto}a.back{display:inline-block;margin-bottom:32px;color:#8b949e;text-decoration:none;background:#161b22;border:1px solid #21262d;border-radius:8px;padding:7px 14px}h1{font-size:26px;color:#f0f6fc;margin:0}.log-card{background:#0d1117;border:1px solid #21262d;border-radius:12px;overflow:hidden}.log-header{background:#161b22;border-bottom:1px solid #21262d;padding:12px 18px;font-size:12px;color:#484f58}.log-body{padding:16px 18px;max-height:560px;overflow-y:auto;font-family:monospace;font-size:12.5px;line-height:1.7}.log-entry{display:block;padding:1px 0;white-space:pre-wrap;word-break:break-all}.error{color:#ff7b72}.warn{color:#e3b341}.success{color:#3fb950}.control{color:#58a6ff}.default{color:#8b949e}.console-row{display:flex;align-items:center;border-top:1px solid #21262d;padding:10px 18px;gap:10px}.console-prompt{font-family:monospace;color:#3fb950;font-weight:700;flex-shrink:0}.console-input{flex:1;background:transparent;border:none;outline:none;font-family:monospace;font-size:12.5px;color:#e6edf3}.console-send{background:#0d2218;border:1px solid #238636;color:#3fb950;font-size:12px;font-weight:600;padding:5px 14px;border-radius:6px;cursor:pointer}</style></head><body><main><a class="back" href="/">← Back</a><h1>Bot Logs</h1><p style="color:#8b949e;margin:4px 0 20px">${logs.length} entries</p><div class="log-card"><div class="log-header">bot.log</div><div class="log-body" id="log-body">${logs.length===0?'<div style="text-align:center;color:#484f58;padding:40px">No logs yet.</div>':logs.map(l=>{const e=escapeHTML(l);const lower=l.toLowerCase();let cls='default';if(lower.includes('error')||lower.includes('fail'))cls='error';else if(lower.includes('warn'))cls='warn';else if(lower.includes('[control]'))cls='control';else if(lower.includes('connect')||lower.includes('spawn'))cls='success';return'<span class="log-entry '+cls+'">'+e+'</span>';}).join('')}</div><div class="console-row"><span class="console-prompt">&gt;</span><input id="console-input" class="console-input" type="text" placeholder="Type a command or message..." autocomplete="off"><button id="console-send" class="console-send">Send</button></div></div></main><script>(function(){var input=document.getElementById('console-input');var send=document.getElementById('console-send');var body=document.getElementById('log-body');body.scrollTop=body.scrollHeight;function sendCmd(){var cmd=input.value.trim();if(!cmd)return;input.value='';send.disabled=true;fetch('/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd})}).then(r=>r.json()).then(d=>{if(d.msg){var span=document.createElement('span');span.className='log-entry control';span.textContent='> '+d.msg;body.appendChild(span);body.scrollTop=body.scrollHeight;}}).finally(()=>{send.disabled=false;input.focus();});}send.addEventListener('click',sendCmd);input.addEventListener('keydown',e=>{if(e.key==='Enter')sendCmd();});setInterval(()=>location.reload(),5000);})();</script></body></html>`);
});

let botRunning = true;

app.post("/start", (req, res) => {
  if (botRunning) return res.json({ success: false, msg: "Already running" });
  botRunning = true;
  createBot();
  addLog("[Control] Bot started");
  res.json({ success: true });
});

app.post("/stop", (req, res) => {
  if (!botRunning) return res.json({ success: false, msg: "Already stopped" });
  botRunning = false;
  if (bot) { try { bot.end(); } catch(e){} bot = null; }
  clearAllIntervals();
  addLog("[Control] Bot stopped");
  res.json({ success: true });
});

app.post("/command", (req, res) => {
  const cmd = (req.body.command || "").trim();
  if (!cmd) return res.json({ success: false, msg: "Empty command." });
  addLog(`[Console] > ${cmd}`);

  if (cmd === "/help") {
    const lines = ["Available commands:","  /pos - Bot coordinates","  /status - Connection info","  /list - Player list","  /say <msg> - Send chat","  /<cmd> - Any Minecraft command"];
    lines.forEach(l => addLog(`[Console] ${l}`));
    return res.json({ success: true, msg: lines.join("\n") });
  }
  if (cmd === "/pos" || cmd === "/coords") {
    const pos = bot && bot.entity ? bot.entity.position : null;
    const msg = pos ? `Position: X=${Math.floor(pos.x)} Y=${Math.floor(pos.y)} Z=${Math.floor(pos.z)}` : "Position unavailable.";
    addLog(`[Console] ${msg}`);
    return res.json({ success: true, msg });
  }
  if (cmd === "/status") {
    const uptime = Math.floor((Date.now() - botState.startTime) / 1000);
    const msg = `Status: ${botState.connected?"Connected":"Disconnected"} | Uptime: ${uptime}s | Reconnects: ${botState.reconnectAttempts}`;
    addLog(`[Console] ${msg}`);
    return res.json({ success: true, msg });
  }
  if (!bot || typeof bot.chat !== "function") {
    return res.json({ success: false, msg: "Bot is not running." });
  }
  try {
    bot.chat(cmd);
    return res.json({ success: true, msg: `Sent: ${cmd}` });
  } catch (err) {
    return res.json({ success: false, msg: err.message });
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  addLog(`[Server] HTTP server started on port ${server.address().port}`);
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const fallback = PORT + 1;
    addLog(`[Server] Port ${PORT} in use - trying ${fallback}`);
    server.listen(fallback, "0.0.0.0");
  }
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

// Self-ping to prevent Render from sleeping
const SELF_PING_INTERVAL = 10 * 60 * 1000;
function startSelfPing() {
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (!renderUrl) {
    addLog("[KeepAlive] No RENDER_EXTERNAL_URL set - self-ping disabled");
    return;
  }
  setInterval(() => {
    const protocol = renderUrl.startsWith("https") ? https : http;
    protocol.get(`${renderUrl}/ping`, () => {}).on("error", (err) => {
      addLog(`[KeepAlive] Self-ping failed: ${err.message}`);
    });
  }, SELF_PING_INTERVAL);
  addLog("[KeepAlive] Self-ping started (every 10 min)");
}
startSelfPing();

// Memory monitoring
setInterval(() => {
  const heapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  addLog(`[Memory] Heap: ${heapMB} MB`);
}, 5 * 60 * 1000);

// ============================================================
// BOT CORE
// ============================================================
let bot = null;
let activeIntervals = [];
let reconnectTimeoutId = null;
let connectionTimeoutId = null;
let isReconnecting = false;
let lastDiscordSend = 0;
const DISCORD_RATE_LIMIT_MS = 5000;

function clearBotTimeouts() {
  if (reconnectTimeoutId) { clearTimeout(reconnectTimeoutId); reconnectTimeoutId = null; }
  if (connectionTimeoutId) { clearTimeout(connectionTimeoutId); connectionTimeoutId = null; }
}

function clearAllIntervals() {
  addLog(`[Cleanup] Clearing ${activeIntervals.length} intervals`);
  activeIntervals.forEach(id => clearInterval(id));
  activeIntervals = [];
}

function addInterval(callback, delay) {
  const id = setInterval(callback, delay);
  activeIntervals.push(id);
  return id;
}

function getReconnectDelay() {
  if (botState.wasThrottled) {
    botState.wasThrottled = false;
    const d = 60000 + Math.floor(Math.random() * 60000);
    addLog(`[Bot] Throttle detected - extended delay: ${d/1000}s`);
    return d;
  }
  const base = config.utils["auto-reconnect-delay"] || 15000;
  const max  = config.utils["max-reconnect-delay"]  || 120000;
  const delay = Math.min(base * Math.pow(1.5, botState.reconnectAttempts), max);
  return delay + Math.floor(Math.random() * 2000);
}

function createBot() {
  if (isReconnecting) { addLog("[Bot] Already reconnecting, skipping..."); return; }

  if (bot) {
    clearAllIntervals();
    try { bot.removeAllListeners(); bot.end(); } catch(e) {}
    bot = null;
  }

  addLog(`[Bot] Connecting to ${config.server.ip}:${config.server.port}...`);

  try {
    const botVersion = config.server.version && config.server.version.trim() !== "" ? config.server.version : false;
    bot = mineflayer.createBot({
      username: config["bot-account"].username,
      password: config["bot-account"].password || undefined,
      auth: config["bot-account"].type,
      host: config.server.ip,
      port: config.server.port,
      version: botVersion,
      hideErrors: false,
      checkTimeoutInterval: 600000,
    });

    bot.loadPlugin(pathfinder);

    clearBotTimeouts();
    connectionTimeoutId = setTimeout(() => {
      if (!botState.connected) {
        addLog("[Bot] Connection timeout - no spawn received");
        try { bot.removeAllListeners(); bot.end(); } catch(e) {}
        bot = null;
        scheduleReconnect();
      }
    }, 150000);

    let spawnHandled = false;

    bot.once("spawn", () => {
      if (spawnHandled) return;
      spawnHandled = true;
      clearBotTimeouts();
      botState.connected = true;
      botState.lastActivity = Date.now();
      botState.reconnectAttempts = 0;
      isReconnecting = false;
      addLog(`[Bot] ✓ Spawned on server! (v${bot.version})`);

      if (config.discord?.events?.connect) sendDiscordWebhook(`✅ **Connected** to \`${config.server.ip}\``, 0x4ade80);

      const mcData = require("minecraft-data")(bot.version);
      const defaultMove = new Movements(bot, mcData);
      defaultMove.allowFreeMotion = false;
      defaultMove.canDig = false;
      defaultMove.liquidCost = 1000;
      defaultMove.fallDamageCost = 1000;

      initializeModules(bot, mcData, defaultMove);

      setTimeout(() => {
        if (bot && botState.connected && config.server["try-creative"]) {
          bot.chat("/gamemode creative");
        }
      }, 3000);
    });

    bot.on("kicked", (reason) => {
      const r = typeof reason === "object" ? JSON.stringify(reason) : reason;
      addLog(`[Bot] Kicked: ${r}`);
      botState.connected = false;
      clearAllIntervals();
      const rLower = String(r).toLowerCase();
      if (rLower.includes("throttl") || rLower.includes("too fast") || rLower.includes("wait before")) {
        botState.wasThrottled = true;
      }
      if (config.discord?.events?.disconnect) sendDiscordWebhook(`⚠️ **Kicked**: ${r}`, 0xff0000);
    });

    bot.on("end", (reason) => {
      addLog(`[Bot] Disconnected: ${reason || "unknown"}`);
      botState.connected = false;
      clearAllIntervals();
      spawnHandled = false;
      if (config.discord?.events?.disconnect) sendDiscordWebhook(`🔴 **Disconnected**: ${reason || "unknown"}`, 0xf87171);
      scheduleReconnect();
    });

    bot.on("error", (err) => {
      addLog(`[Bot] Error: ${err.message}`);
    });

  } catch (err) {
    addLog(`[Bot] Failed to create bot: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  clearBotTimeouts();
  if (isReconnecting) { addLog("[Bot] Reconnect already scheduled."); return; }
  isReconnecting = true;
  botState.reconnectAttempts++;
  const delay = getReconnectDelay();
  addLog(`[Bot] Reconnecting in ${(delay/1000).toFixed(1)}s (attempt #${botState.reconnectAttempts})`);
  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    isReconnecting = false;
    createBot();
  }, delay);
}

// ============================================================
// MODULES
// ============================================================
function initializeModules(bot, mcData, defaultMove) {
  addLog("[Modules] Initializing...");

  // Auto-auth
  if (config.utils["auto-auth"]?.enabled) {
    const password = config.utils["auto-auth"].password;
    let authHandled = false;
    const tryAuth = (type) => {
      if (authHandled || !bot || !botState.connected) return;
      authHandled = true;
      if (type === "register") {
        bot.chat(`/register ${password} ${password}`);
        addLog("[Auth] Sent /register");
      } else {
        bot.chat(`/login ${password}`);
        addLog("[Auth] Sent /login");
      }
    };
    bot.on("messagestr", (msg) => {
      if (authHandled) return;
      const m = msg.toLowerCase();
      if (m.includes("/register") || m.includes("register ")) tryAuth("register");
      else if (m.includes("/login") || m.includes("login ")) tryAuth("login");
    });
    setTimeout(() => {
      if (!authHandled && bot && botState.connected) {
        addLog("[Auth] No prompt after 10s - sending /login as failsafe");
        bot.chat(`/login ${password}`);
        authHandled = true;
      }
    }, 10000);
  }

  // Chat messages
  if (config.utils["chat-messages"]?.enabled) {
    const messages = config.utils["chat-messages"].messages;
    if (config.utils["chat-messages"].repeat) {
      let i = 0;
      addInterval(() => {
        if (bot && botState.connected) {
          bot.chat(messages[i]);
          botState.lastActivity = Date.now();
          i = (i + 1) % messages.length;
        }
      }, config.utils["chat-messages"]["repeat-delay"] * 1000);
    }
  }

  // Position goal
  if (config.position?.enabled && !config.movement?.["circle-walk"]?.enabled) {
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
    addLog("[Position] Navigating to configured position...");
  }

  // Anti-AFK
  if (config.utils["anti-afk"]?.enabled) {
    addInterval(() => {
      if (!bot || !botState.connected) return;
      try { bot.swingArm(); } catch(e) {}
    }, 10000 + Math.floor(Math.random() * 50000));

    addInterval(() => {
      if (!bot || !botState.connected) return;
      try { bot.setQuickBarSlot(Math.floor(Math.random() * 9)); } catch(e) {}
    }, 30000 + Math.floor(Math.random() * 90000));

    if (!config.movement?.["circle-walk"]?.enabled) {
      addInterval(() => {
        if (!bot || !botState.connected) return;
        try {
          const yaw = Math.random() * Math.PI * 2;
          bot.look(yaw, 0, true);
          bot.setControlState("forward", true);
          setTimeout(() => { if (bot) bot.setControlState("forward", false); }, 500 + Math.floor(Math.random() * 1500));
          botState.lastActivity = Date.now();
        } catch(e) {}
      }, 120000 + Math.floor(Math.random() * 360000));
    }

    if (config.utils["anti-afk"].sneak) {
      try { bot.setControlState("sneak", true); } catch(e) {}
    }
  }

  // Movement modules
  if (config.movement?.enabled !== false) {
    if (config.movement?.["circle-walk"]?.enabled) startCircleWalk(bot, defaultMove);
    if (config.movement?.["random-jump"]?.enabled && !config.movement?.["circle-walk"]?.enabled) startRandomJump(bot);
    if (config.movement?.["look-around"]?.enabled) startLookAround(bot);
  }

  // Custom modules
  if (config.modules.avoidMobs && !config.modules.combat) avoidMobs(bot);
  if (config.modules.combat) combatModule(bot, mcData);
  if (config.modules.beds) bedModule(bot, mcData);
  if (config.modules.chat) chatModule(bot);

  addLog("[Modules] All modules initialized!");
}

function startCircleWalk(bot, defaultMove) {
  let angle = 0, lastPathTime = 0;
  addInterval(() => {
    if (!bot || !botState.connected) return;
    const now = Date.now();
    if (now - lastPathTime < 2000) return;
    lastPathTime = now;
    try {
      const radius = config.movement["circle-walk"].radius;
      const x = bot.entity.position.x + Math.cos(angle) * radius;
      const z = bot.entity.position.z + Math.sin(angle) * radius;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(Math.floor(x), Math.floor(bot.entity.position.y), Math.floor(z)));
      angle += Math.PI / 4;
      botState.lastActivity = Date.now();
    } catch(e) {}
  }, config.movement["circle-walk"].speed);
}

function startRandomJump(bot) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      bot.setControlState("jump", true);
      setTimeout(() => { if (bot) bot.setControlState("jump", false); }, 300);
      botState.lastActivity = Date.now();
    } catch(e) {}
  }, config.movement["random-jump"].interval);
}

function startLookAround(bot) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      bot.look(Math.random() * Math.PI * 2 - Math.PI, (Math.random() * Math.PI / 2) - Math.PI / 4, false);
      botState.lastActivity = Date.now();
    } catch(e) {}
  }, config.movement["look-around"].interval);
}

function avoidMobs(bot) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      const entities = Object.values(bot.entities).filter(e =>
        e.type === "mob" || (e.type === "player" && e.username !== bot.username)
      );
      for (const e of entities) {
        if (!e.position) continue;
        if (bot.entity.position.distanceTo(e.position) < 5) {
          bot.setControlState("back", true);
          setTimeout(() => { if (bot) bot.setControlState("back", false); }, 500);
          break;
        }
      }
    } catch(e) {}
  }, 2000);
}

function combatModule(bot, mcData) {
  let lastAttack = 0, lockedTarget = null, lockedExpiry = 0;
  bot.on("physicsTick", () => {
    if (!bot || !botState.connected || !config.combat["attack-mobs"]) return;
    const now = Date.now();
    if (now - lastAttack < 620) return;
    try {
      if (lockedTarget && now < lockedExpiry && bot.entities[lockedTarget.id] && lockedTarget.position) {
        if (bot.entity.position.distanceTo(lockedTarget.position) < 4) {
          bot.attack(lockedTarget); lastAttack = now; return;
        } else { lockedTarget = null; }
      }
      const mobs = Object.values(bot.entities).filter(e =>
        e.type === "mob" && e.position && bot.entity.position.distanceTo(e.position) < 4
      );
      if (mobs.length > 0) {
        lockedTarget = mobs[0]; lockedExpiry = now + 3000;
        bot.attack(lockedTarget); lastAttack = now;
      }
    } catch(e) {}
  });
  bot.on("health", () => {
    if (!config.combat["auto-eat"]) return;
    try {
      if (bot.food < 14) {
        const food = bot.inventory.items().find(i => i.foodPoints && i.foodPoints > 0);
        if (food) bot.equip(food, "hand").then(() => bot.consume()).catch(() => {});
      }
    } catch(e) {}
  });
}

function bedModule(bot, mcData) {
  let isTrying = false;
  addInterval(async () => {
    if (!bot || !botState.connected || !config.beds["place-night"]) return;
    try {
      const isNight = bot.time.timeOfDay >= 12500 && bot.time.timeOfDay <= 23500;
      if (isNight && !isTrying) {
        const bedBlock = bot.findBlock({ matching: b => b.name.includes("bed"), maxDistance: 8 });
        if (bedBlock) {
          isTrying = true;
          try { await bot.sleep(bedBlock); addLog("[Bed] Sleeping..."); }
          catch(e) {}
          finally { isTrying = false; }
        }
      }
    } catch(e) { isTrying = false; }
  }, 10000);
}

function chatModule(bot) {
  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;
    try {
      if (config.discord?.enabled && config.discord?.events?.chat) {
        sendDiscordWebhook(`💬 **${username}**: ${message}`, 0x7289da);
      }
      if (config.chat?.respond) {
        const m = message.toLowerCase();
        if (m.includes("hello") || m.includes("hi")) bot.chat(`Hello, ${username}!`);
        if (message.startsWith("!tp ")) {
          const target = message.split(" ")[1];
          if (target) bot.chat(`/tp ${target}`);
        }
      }
    } catch(e) {}
  });
}

// ============================================================
// CONSOLE INPUT
// ============================================================
const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on("line", (line) => {
  if (!bot || !botState.connected) { addLog("[Console] Bot not connected"); return; }
  const t = line.trim();
  if (t.startsWith("say ")) bot.chat(t.slice(4));
  else if (t.startsWith("cmd ")) bot.chat("/" + t.slice(4));
  else if (t === "status") addLog(`Connected: ${botState.connected} | Uptime: ${formatUptime(Math.floor((Date.now()-botState.startTime)/1000))}`);
  else bot.chat(t);
});

// ============================================================
// DISCORD WEBHOOK
// ============================================================
function sendDiscordWebhook(content, color = 0x0099ff) {
  if (!config.discord?.enabled || !config.discord?.webhookUrl || config.discord.webhookUrl === "") return;
  const now = Date.now();
  if (now - lastDiscordSend < DISCORD_RATE_LIMIT_MS) return;
  lastDiscordSend = now;
  try {
    const urlParts = new URL(config.discord.webhookUrl);
    const protocol = config.discord.webhookUrl.startsWith("https") ? https : http;
    const payload = JSON.stringify({ username: config.name, embeds: [{ description: content, color, timestamp: new Date().toISOString() }] });
    const req = protocol.request({ hostname: urlParts.hostname, port: 443, path: urlParts.pathname + urlParts.search, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload, "utf8") } }, () => {});
    req.on("error", (e) => addLog(`[Discord] Error: ${e.message}`));
    req.write(payload); req.end();
  } catch(e) { addLog(`[Discord] Webhook error: ${e.message}`); }
}

// ============================================================
// CRASH RECOVERY
// ============================================================
process.on("uncaughtException", (err) => {
  addLog(`[FATAL] Uncaught Exception: ${err.message}`);
  botState.errors.push({ type: "uncaught", message: err.message, time: Date.now() });
  if (botState.errors.length > 100) botState.errors = botState.errors.slice(-50);
  clearAllIntervals();
  botState.connected = false;
  if (isReconnecting) { isReconnecting = false; clearBotTimeouts(); }
  const isNetwork = /PartialReadError|ECONNRESET|EPIPE|ETIMEDOUT|timed out|write after end|socket has been ended/i.test(err.message);
  setTimeout(() => scheduleReconnect(), isNetwork ? 5000 : 10000);
});

process.on("unhandledRejection", (reason) => {
  const msg = String(reason);
  addLog(`[FATAL] Unhandled Rejection: ${msg}`);
  botState.errors.push({ type: "rejection", message: msg, time: Date.now() });
  if (botState.errors.length > 100) botState.errors = botState.errors.slice(-50);
  if (/ETIMEDOUT|ECONNRESET|EPIPE|ENOTFOUND|timed out|PartialReadError/i.test(msg) && !isReconnecting) {
    clearAllIntervals();
    botState.connected = false;
    if (bot) { try { bot.end(); } catch(_) {} bot = null; }
    scheduleReconnect();
  }
});

process.on("SIGTERM", () => addLog("[System] SIGTERM received - ignoring, staying alive."));
process.on("SIGINT",  () => addLog("[System] SIGINT received - ignoring, staying alive."));

// ============================================================
// START
// ============================================================
addLog("=".repeat(50));
addLog("  BotV3 - 24/7 AFK Bot");
addLog("=".repeat(50));
addLog(`Server: ${config.server.ip}:${config.server.port}`);
addLog(`Username: ${config["bot-account"].username}`);
addLog(`Version: ${config.server.version || "auto-detect"}`);
addLog("=".repeat(50));

createBot();

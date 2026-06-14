/**
 * WRBL Digital – Regelbasierter Chatbot Widget (kein AI, keine API-Kosten)
 *
 * Konfiguration über window.WRBL_RULES_CHAT_CONFIG:
 * {
 *   business: { name: "Salon Name", short: "S" },
 *   theme: { primary: "#d4607a", primaryHover: "#6b3a4a" },
 *   greeting: "Hallo! Wie kann ich helfen?",
 *   subtitle: "Häufige Fragen – schnell beantwortet",
 *   font: "Jost",
 *   rules: [
 *     { keywords: ["preis", "kosten", "was kostet"], answer: "Eine Fußpflege kostet 35€." },
 *     { keywords: ["öffnungszeiten", "geöffnet", "wann"], answer: "Mo-Fr 08-20 Uhr." },
 *   ],
 *   fallback: "Das kann ich leider nicht beantworten. Ruf uns an oder schreib per WhatsApp!",
 *   quickReplies: [
 *     { label: "Preise", msg: "Was kostet eine Behandlung?" },
 *     { label: "Öffnungszeiten", msg: "Wann habt ihr geöffnet?" }
 *   ]
 * }
 */
(function() {
  'use strict';

  var cfg = window.WRBL_RULES_CHAT_CONFIG;
  if (!cfg) return;

  // HTML-Escape
  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // Finde passende Regel
  function findAnswer(input) {
    var lower = input.toLowerCase().trim();
    var rules = cfg.rules || [];
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      for (var k = 0; k < r.keywords.length; k++) {
        if (lower.indexOf(r.keywords[k].toLowerCase()) !== -1) {
          return r.answer;
        }
      }
    }
    return cfg.fallback || 'Das kann ich leider nicht beantworten. Bitte kontaktiere uns direkt!';
  }

  // CSS
  var style = document.createElement('style');
  style.textContent = `
    .wrbl-rb{position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999;font-family:"${esc(cfg.font || 'sans-serif')}",sans-serif}
    .wrbl-rb *{box-sizing:border-box;margin:0;padding:0}
    .wrbl-rb-toggle{width:56px;height:56px;border-radius:50%;background:${esc(cfg.theme.primary)};color:#fff;border:none;cursor:pointer;font-size:1.5rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(0,0,0,.2);transition:transform .2s,background .2s}
    .wrbl-rb-toggle:hover{background:${esc(cfg.theme.primaryHover)};transform:scale(1.05)}
    .wrbl-rb-box{display:none;position:fixed;bottom:5.5rem;right:1.5rem;width:360px;max-width:calc(100vw - 2rem);background:#fff;border-radius:18px;box-shadow:0 12px 48px rgba(0,0,0,.18);overflow:hidden;z-index:99999;flex-direction:column;max-height:500px}
    .wrbl-rb-box.open{display:flex}
    .wrbl-rb-head{background:${esc(cfg.theme.primary)};color:#fff;padding:1.1rem 1.2rem;display:flex;align-items:center;gap:.7rem}
    .wrbl-rb-av{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1rem}
    .wrbl-rb-info{flex:1}
    .wrbl-rb-name{font-weight:600;font-size:.92rem}
    .wrbl-rb-sub{font-size:.72rem;opacity:.8}
    .wrbl-rb-close{background:none;border:none;color:#fff;font-size:1.4rem;cursor:pointer;padding:.2rem;opacity:.7;transition:opacity .2s}
    .wrbl-rb-close:hover{opacity:1}
    .wrbl-rb-msgs{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.6rem;min-height:180px;max-height:320px}
    .wrbl-rb-msg{max-width:85%;padding:.65rem .9rem;border-radius:14px;font-size:.85rem;line-height:1.5;word-wrap:break-word}
    .wrbl-rb-msg.bot{background:#f3f4f6;color:#1f2937;border-bottom-left-radius:4px;align-self:flex-start}
    .wrbl-rb-msg.user{background:${esc(cfg.theme.primary)};color:#fff;border-bottom-right-radius:4px;align-self:flex-end}
    .wrbl-rb-qr{display:flex;flex-wrap:wrap;gap:.4rem;padding:0 1rem .6rem}
    .wrbl-rb-qr-btn{background:rgba(212,96,122,.08);color:${esc(cfg.theme.primary)};border:1px solid rgba(212,96,122,.2);border-radius:20px;padding:.35rem .8rem;font-size:.75rem;cursor:pointer;font-family:inherit;transition:background .2s}
    .wrbl-rb-qr-btn:hover{background:rgba(212,96,122,.15)}
    .wrbl-rb-input{display:flex;border-top:1px solid #eee;padding:.5rem}
    .wrbl-rb-input input{flex:1;border:none;padding:.6rem .8rem;font-size:.85rem;font-family:inherit;outline:none}
    .wrbl-rb-input button{background:${esc(cfg.theme.primary)};color:#fff;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:background .2s}
    .wrbl-rb-input button:hover{background:${esc(cfg.theme.primaryHover)}}
    .wrbl-rb-foot{text-align:center;padding:.3rem;font-size:.6rem;color:#999;border-top:1px solid #f3f4f6}
    .wrbl-rb-foot a{color:#999;text-decoration:none}
    @media(max-width:480px){.wrbl-rb-box.open{position:fixed;inset:0;bottom:0;right:0;width:100%;max-width:100%;max-height:100%;border-radius:0}}
  `;
  document.head.appendChild(style);

  // HTML
  var wrap = document.createElement('div');
  wrap.className = 'wrbl-rb';
  wrap.innerHTML = `
    <div class="wrbl-rb-box" id="wrbl-rb-box">
      <div class="wrbl-rb-head">
        <div class="wrbl-rb-av">${esc(cfg.business.short)}</div>
        <div class="wrbl-rb-info">
          <div class="wrbl-rb-name">${esc(cfg.business.name)}</div>
          <div class="wrbl-rb-sub">${esc(cfg.subtitle || 'Häufige Fragen')}</div>
        </div>
        <button class="wrbl-rb-close" id="wrbl-rb-close">✕</button>
      </div>
      <div class="wrbl-rb-msgs" id="wrbl-rb-msgs">
        <div class="wrbl-rb-msg bot">${esc(cfg.greeting)}</div>
      </div>
      <div class="wrbl-rb-qr" id="wrbl-rb-qr"></div>
      <div class="wrbl-rb-input">
        <input type="text" id="wrbl-rb-in" placeholder="Deine Frage..." maxlength="300">
        <button id="wrbl-rb-send">➤</button>
      </div>
      <div class="wrbl-rb-foot"><a href="https://wrbl.digital" target="_blank" rel="noopener noreferrer">Powered by WRBL Digital</a></div>
    </div>
    <button class="wrbl-rb-toggle" id="wrbl-rb-toggle">💬</button>
  `;
  document.body.appendChild(wrap);

  // Elements
  var box = document.getElementById('wrbl-rb-box');
  var msgs = document.getElementById('wrbl-rb-msgs');
  var input = document.getElementById('wrbl-rb-in');
  var toggle = document.getElementById('wrbl-rb-toggle');
  var closeBtn = document.getElementById('wrbl-rb-close');
  var qrWrap = document.getElementById('wrbl-rb-qr');

  // Quick Replies rendern
  function renderQR() {
    qrWrap.innerHTML = '';
    var qrs = cfg.quickReplies || [];
    for (var i = 0; i < qrs.length; i++) {
      var btn = document.createElement('button');
      btn.className = 'wrbl-rb-qr-btn';
      btn.textContent = qrs[i].label;
      btn.setAttribute('data-msg', qrs[i].msg);
      btn.addEventListener('click', function() {
        sendMessage(this.getAttribute('data-msg'));
      });
      qrWrap.appendChild(btn);
    }
  }

  function addMsg(text, sender) {
    var div = document.createElement('div');
    div.className = 'wrbl-rb-msg ' + sender;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function sendMessage(text) {
    if (!text || !text.trim()) return;
    addMsg(text, 'user');
    input.value = '';
    // Quick Replies nach erster Nachricht ausblenden
    qrWrap.style.display = 'none';
    // Kurze Verzögerung für natürliches Gefühl
    setTimeout(function() {
      var answer = findAnswer(text);
      addMsg(answer, 'bot');
    }, 400);
  }

  // Events
  toggle.addEventListener('click', function() {
    box.classList.toggle('open');
    if (box.classList.contains('open')) {
      toggle.style.display = 'none';
      input.focus();
    }
  });

  closeBtn.addEventListener('click', function() {
    box.classList.remove('open');
    toggle.style.display = 'flex';
  });

  document.getElementById('wrbl-rb-send').addEventListener('click', function() {
    sendMessage(input.value);
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') sendMessage(input.value);
  });

  renderQR();
})();

/**
 * WRBL Digital – Universal Chatbot Widget v2
 * Config-based: works for any client by passing a config object
 *
 * Usage:
 * <script>
 *   window.WRBL_CHAT_CONFIG = {
 *     apiUrl: "https://ewelinas-oase-chatbot.pages.dev/api/chat",
 *     business: { name: "Ewelinas Oase", short: "E" },
 *     theme: { primary: "#d4607a", primaryHover: "#b84d66" },
 *     greeting: "Hallo! Schön, dass du vorbeischaust. Wie kann ich dir helfen?",
 *     subtitle: "Meistens antworte ich sofort",
 *     quickReplies: [
 *       { label: "Preise", msg: "Was kostet eine Fußpflege?" },
 *       { label: "Öffnungszeiten", msg: "Wann habt ihr geöffnet?" },
 *       { label: "Termin buchen", msg: "Ich möchte einen Termin buchen" },
 *       { label: "Adresse", msg: "Wo ist der Salon?" }
 *     ],
 *     position: { bottom: "90px", right: "20px" },
 *     font: "Jost"
 *   };
 * </script>
 * <script src="chatbot-widget-v2.js"></script>
 */
(function () {
  // Config with defaults
  const cfg = Object.assign({
    apiUrl: "",
    clientId: "",
    business: { name: "Chatbot", short: "C" },
    theme: { primary: "#3282b8", primaryHover: "#2668a0" },
    greeting: "Hallo! Wie kann ich dir helfen?",
    subtitle: "Meistens antworte ich sofort",
    quickReplies: [],
    position: { bottom: "90px", right: "20px" },
    font: "Jost"
  }, window.WRBL_CHAT_CONFIG || {});

  // HTML-Escape Funktion (XSS-Schutz für Config-Werte)
  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  const P = cfg.theme.primary;
  const PH = cfg.theme.primaryHover;
  const chatHistory = [];
  let quickRepliesShown = true;

  // Font: Use the font already loaded by the host page.
  // No external Google Fonts request (DSGVO-compliant).
  // If the host page doesn't load the font, system-ui is used as fallback.

  // Styles
  const style = document.createElement("style");
  style.textContent = `
    .wrbl-toggle {
      position: fixed;
      bottom: ${cfg.position.bottom};
      right: ${cfg.position.right};
      width: 60px;
      height: 60px;
      background: ${P};
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px ${P}4d;
      transition: all 0.3s ease;
      z-index: 99999;
    }
    .wrbl-toggle:hover {
      background: ${PH};
      transform: scale(1.05);
      box-shadow: 0 6px 20px ${P}66;
    }
    .wrbl-toggle svg { width: 28px; height: 28px; fill: #fff; }
    .wrbl-toggle.wrbl-active svg.wrbl-icon-chat { display: none; }
    .wrbl-toggle:not(.wrbl-active) svg.wrbl-icon-close { display: none; }

    .wrbl-widget {
      position: fixed;
      bottom: calc(${cfg.position.bottom} + 74px);
      right: ${cfg.position.right};
      width: 380px;
      height: 520px;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 99999;
      font-family: "${cfg.font}", system-ui, sans-serif;
    }
    .wrbl-widget.wrbl-open { display: flex; }

    .wrbl-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: ${P};
      color: #fff;
    }
    .wrbl-header-info { display: flex; align-items: center; gap: 12px; }
    .wrbl-avatar {
      width: 38px;
      height: 38px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
      font-weight: 600;
    }
    .wrbl-header-text h1 {
      font-size: 17px;
      font-weight: 600;
      color: #fff;
      margin: 0;
      font-family: "${cfg.font}", system-ui, sans-serif;
      line-height: 1.2;
    }
    .wrbl-header-sub {
      font-size: 12px;
      opacity: 0.8;
      font-weight: 400;
      margin-top: 2px;
    }
    .wrbl-close {
      background: rgba(255,255,255,0.15);
      border: none;
      cursor: pointer;
      font-size: 20px;
      color: #fff;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      line-height: 1;
    }
    .wrbl-close:hover { background: rgba(255,255,255,0.3); }

    .wrbl-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8f9fa;
    }
    .wrbl-messages::-webkit-scrollbar { width: 4px; }
    .wrbl-messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }

    .wrbl-msg {
      max-width: 82%;
      padding: 10px 15px;
      line-height: 1.5;
      font-size: 14px;
      white-space: pre-wrap;
      font-family: "${cfg.font}", system-ui, sans-serif;
      animation: wrbl-fadeIn 0.3s ease;
    }
    @keyframes wrbl-fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .wrbl-msg-user {
      align-self: flex-end;
      background: ${P};
      color: #fff;
      border-radius: 16px 16px 4px 16px;
    }
    .wrbl-msg-assistant {
      align-self: flex-start;
      background: #fff;
      color: #333;
      border-radius: 16px 16px 16px 4px;
      border: 1px solid #eee;
    }
    .wrbl-msg-typing {
      font-style: italic;
      color: #999;
      border: 1px solid #eee;
    }

    .wrbl-quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 16px 12px;
      background: #f8f9fa;
      animation: wrbl-fadeIn 0.4s ease;
    }
    .wrbl-quick-btn {
      padding: 7px 14px;
      background: #fff;
      color: ${P};
      border: 1.5px solid ${P};
      border-radius: 20px;
      font-size: 13px;
      font-family: "${cfg.font}", system-ui, sans-serif;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .wrbl-quick-btn:hover {
      background: ${P};
      color: #fff;
    }

    .wrbl-input-area {
      display: flex;
      padding: 12px;
      border-top: 1px solid #eee;
      gap: 8px;
      background: #fff;
      align-items: center;
    }
    .wrbl-input-area input {
      flex: 1;
      padding: 10px 14px;
      border: 1.5px solid #e0e0e0;
      border-radius: 24px;
      font-size: 16px; /* iOS: < 16px triggert Auto-Zoom auf Fokus */
      font-family: "${cfg.font}", system-ui, sans-serif;
      outline: none;
      transition: border-color 0.2s;
    }
    .wrbl-input-area input::placeholder { color: #bbb; }
    .wrbl-input-area input:focus { border-color: ${P}; }
    .wrbl-send {
      background: ${P};
      border: none;
      cursor: pointer;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .wrbl-send svg { width: 18px; height: 18px; fill: #fff; }
    .wrbl-send:hover { background: ${PH}; transform: scale(1.05); }
    .wrbl-send:disabled { opacity: 0.5; transform: none; cursor: default; }

    .wrbl-powered {
      text-align: center;
      padding: 6px;
      font-size: 10px;
      color: #bbb;
      background: #fff;
    }
    .wrbl-powered a { color: #999; text-decoration: none; }
    .wrbl-powered a:hover { color: #666; }

    /* Tap-delay + Doppeltap-Zoom auf iOS unterdrücken */
    .wrbl-toggle, .wrbl-close, .wrbl-quick-btn, .wrbl-send {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    @media (max-width: 480px) {
      .wrbl-widget {
        top: 0; left: 0; right: 0; bottom: 0;
        width: 100%;
        height: 100vh;            /* Fallback für alte Browser */
        height: 100dvh;           /* iOS: schrumpft mit URL-Bar + Keyboard */
        max-height: 100dvh;
        border-radius: 0;
      }
      .wrbl-toggle.wrbl-active { display: none; }

      /* Safe-Area: Header nicht unter Dynamic Island, Input nicht am Home-Indicator */
      .wrbl-header {
        padding-top: calc(16px + env(safe-area-inset-top));
        padding-left: calc(20px + env(safe-area-inset-left));
        padding-right: calc(20px + env(safe-area-inset-right));
        flex-shrink: 0;           /* Header darf nicht zusammengequetscht werden */
      }
      .wrbl-input-area {
        padding-bottom: calc(12px + env(safe-area-inset-bottom));
        padding-left: calc(12px + env(safe-area-inset-left));
        padding-right: calc(12px + env(safe-area-inset-right));
        flex-shrink: 0;
      }

      /* Touch-Target >= 44x44 (WCAG) */
      .wrbl-close {
        width: 44px;
        height: 44px;
        font-size: 24px;
      }

      /* Scroll im Chat bleibt im Chat, kein Pull-to-Refresh der Host-Seite */
      .wrbl-messages {
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
    }
  `;
  document.head.appendChild(style);

  // Build quick replies HTML
  const qrHTML = cfg.quickReplies.map(qr =>
    `<button class="wrbl-quick-btn" data-msg="${esc(qr.msg)}">${esc(qr.label)}</button>`
  ).join("");

  // HTML
  const container = document.createElement("div");
  container.innerHTML = `
    <button class="wrbl-toggle" id="wrbl-toggle">
      <svg class="wrbl-icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>
      <svg class="wrbl-icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
    <div class="wrbl-widget" id="wrbl-widget">
      <div class="wrbl-header">
        <div class="wrbl-header-info">
          <div class="wrbl-avatar">${esc(cfg.business.short)}</div>
          <div class="wrbl-header-text">
            <h1>${esc(cfg.business.name)}</h1>
            <div class="wrbl-header-sub">${esc(cfg.subtitle)}</div>
          </div>
        </div>
        <button class="wrbl-close" id="wrbl-close">&times;</button>
      </div>
      <div class="wrbl-messages" id="wrbl-messages">
        <div class="wrbl-msg wrbl-msg-assistant">${esc(cfg.greeting)}</div>
      </div>
      ${qrHTML ? `<div class="wrbl-quick-replies" id="wrbl-quick-replies">${qrHTML}</div>` : ""}
      <div class="wrbl-input-area">
        <input type="text" id="wrbl-input" placeholder="Schreib eine Nachricht..." autocomplete="off">
        <button class="wrbl-send" id="wrbl-send">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div class="wrbl-powered">Powered by <a href="https://wrbl.digital" target="_blank" rel="noopener">WRBL Digital</a></div>
    </div>
  `;
  document.body.appendChild(container);

  // Logic
  const widget = document.getElementById("wrbl-widget");
  const toggle = document.getElementById("wrbl-toggle");
  const closeBtn = document.getElementById("wrbl-close");
  const messages = document.getElementById("wrbl-messages");
  const input = document.getElementById("wrbl-input");
  const sendBtn = document.getElementById("wrbl-send");
  const quickRepliesEl = document.getElementById("wrbl-quick-replies");

  // iOS Keyboard: Widget-Höhe an sichtbaren Viewport anpassen.
  // Ohne das wird der Header vom Keyboard nach oben aus dem Screen geschoben.
  function syncViewportHeight() {
    if (window.innerWidth > 480) return;
    if (!widget.classList.contains("wrbl-open")) return;
    if (window.visualViewport) {
      widget.style.height = window.visualViewport.height + "px";
      messages.scrollTop = messages.scrollHeight;
    }
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncViewportHeight);
    window.visualViewport.addEventListener("scroll", syncViewportHeight);
  }

  toggle.addEventListener("click", function () {
    const isOpen = widget.classList.toggle("wrbl-open");
    toggle.classList.toggle("wrbl-active", isOpen);
    if (isOpen) {
      syncViewportHeight();
      input.focus();
    } else {
      widget.style.height = ""; // Reset auf CSS-Wert
    }
  });

  closeBtn.addEventListener("click", function () {
    widget.classList.remove("wrbl-open");
    toggle.classList.remove("wrbl-active");
    widget.style.height = ""; // Reset auf CSS-Wert
  });

  if (quickRepliesEl) {
    quickRepliesEl.addEventListener("click", function (e) {
      const btn = e.target.closest(".wrbl-quick-btn");
      if (btn) {
        input.value = btn.getAttribute("data-msg");
        sendMessage();
      }
    });
  }

  function hideQuickReplies() {
    if (quickRepliesShown && quickRepliesEl) {
      quickRepliesEl.style.display = "none";
      quickRepliesShown = false;
    }
  }

  function addMsg(text, role) {
    const div = document.createElement("div");
    div.className = "wrbl-msg wrbl-msg-" + role;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    hideQuickReplies();
    addMsg(text, "user");
    chatHistory.push({ role: "user", content: text });

    sendBtn.disabled = true;
    const typing = addMsg("Schreibt...", "assistant wrbl-msg-typing");

    try {
      const res = await fetch(cfg.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory, clientId: cfg.clientId }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      typing.remove();
      addMsg(data.reply, "assistant");
      chatHistory.push({ role: "assistant", content: data.reply });
    } catch (err) {
      typing.remove();
      addMsg("Entschuldigung, da ist etwas schiefgelaufen. Bitte versuch es nochmal.", "assistant");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendMessage();
  });
})();

(function () {
  const API_URL = "https://ewelinas-oase-chatbot.pages.dev/api/chat";
  const chatHistory = [];
  let quickRepliesShown = true;

  // Font
  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap";
  document.head.appendChild(font);

  // Styles
  const style = document.createElement("style");
  style.textContent = `
    .eo-toggle {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 60px;
      height: 60px;
      background: #e8006f;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(232,0,111,0.3);
      transition: all 0.3s ease;
      z-index: 99999;
    }
    .eo-toggle:hover {
      background: #c70060;
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(232,0,111,0.4);
    }
    .eo-toggle svg { width: 28px; height: 28px; fill: #fff; }
    .eo-toggle.eo-active svg.eo-icon-chat { display: none; }
    .eo-toggle:not(.eo-active) svg.eo-icon-close { display: none; }

    .eo-widget {
      position: fixed;
      bottom: 164px;
      right: 20px;
      width: 370px;
      height: 500px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 5px 30px rgba(0,0,0,0.12);
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #f0f0f0;
      z-index: 99999;
      font-family: "Cormorant Garamond", Georgia, serif;
    }
    .eo-widget.eo-open { display: flex; }

    .eo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      background: #e8006f;
      color: #fff;
    }
    .eo-header-info { display: flex; align-items: center; gap: 12px; }
    .eo-header-avatar {
      width: 36px;
      height: 36px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .eo-header h1 {
      font-size: 19px;
      font-weight: 600;
      color: #fff;
      letter-spacing: 0.5px;
      margin: 0;
      font-family: "Cormorant Garamond", Georgia, serif;
      line-height: 1.2;
    }
    .eo-header-sub {
      font-size: 12px;
      opacity: 0.85;
      font-weight: 400;
    }
    .eo-header button {
      background: rgba(255,255,255,0.15);
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: #fff;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .eo-header button:hover { background: rgba(255,255,255,0.3); }

    .eo-messages {
      flex: 1;
      overflow-y: auto;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #fafafa;
    }
    .eo-messages::-webkit-scrollbar { width: 4px; }
    .eo-messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }

    .eo-msg {
      max-width: 85%;
      padding: 10px 16px;
      line-height: 1.5;
      font-size: 16px;
      white-space: pre-wrap;
      font-family: "Cormorant Garamond", Georgia, serif;
      animation: eo-fadeIn 0.3s ease;
    }
    @keyframes eo-fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .eo-msg-user {
      align-self: flex-end;
      background: #e8006f;
      color: #fff;
      border-radius: 16px 16px 4px 16px;
    }
    .eo-msg-assistant {
      align-self: flex-start;
      background: #fff;
      color: #333;
      border-radius: 16px 16px 16px 4px;
      border: 1px solid #eee;
    }
    .eo-msg-typing {
      font-style: italic;
      color: #999;
      border: 1px solid #eee;
    }

    .eo-quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0 18px 14px;
      background: #fafafa;
      animation: eo-fadeIn 0.4s ease;
    }
    .eo-quick-btn {
      padding: 8px 16px;
      background: #fff;
      color: #e8006f;
      border: 1.5px solid #e8006f;
      border-radius: 20px;
      font-size: 14px;
      font-family: "Cormorant Garamond", Georgia, serif;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .eo-quick-btn:hover {
      background: #e8006f;
      color: #fff;
    }

    .eo-input {
      display: flex;
      padding: 14px;
      border-top: 1px solid #eee;
      gap: 10px;
      background: #fff;
      align-items: center;
    }
    .eo-input input {
      flex: 1;
      padding: 10px 16px;
      border: 1.5px solid #e8e8e8;
      border-radius: 24px;
      font-size: 15px;
      font-family: "Cormorant Garamond", Georgia, serif;
      outline: none;
      transition: border-color 0.2s;
    }
    .eo-input input::placeholder { color: #bbb; }
    .eo-input input:focus { border-color: #e8006f; }
    .eo-input button {
      background: #e8006f;
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
    .eo-input button svg { width: 18px; height: 18px; fill: #fff; }
    .eo-input button:hover { background: #c70060; transform: scale(1.05); }
    .eo-input button:disabled { background: #f0a0c0; transform: none; }

    @media (max-width: 480px) {
      .eo-widget {
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
        border: none;
      }
      .eo-toggle.eo-active { display: none; }
    }
  `;
  document.head.appendChild(style);

  // HTML
  const container = document.createElement("div");
  container.innerHTML = `
    <button class="eo-toggle" id="eo-toggle">
      <svg class="eo-icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>
      <svg class="eo-icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
    <div class="eo-widget" id="eo-widget">
      <div class="eo-header">
        <div class="eo-header-info">
          <div class="eo-header-avatar">E</div>
          <div>
            <h1>Ewelinas Oase</h1>
            <div class="eo-header-sub">Meistens antworte ich sofort</div>
          </div>
        </div>
        <button id="eo-close">&times;</button>
      </div>
      <div class="eo-messages" id="eo-messages">
        <div class="eo-msg eo-msg-assistant">Hallo! Sch\u00f6n, dass du bei Ewelinas Oase vorbeischaust. Wie kann ich dir helfen?</div>
      </div>
      <div class="eo-quick-replies" id="eo-quick-replies">
        <button class="eo-quick-btn" data-msg="Was kostet eine Fu\u00dfpflege?">Preise</button>
        <button class="eo-quick-btn" data-msg="Wann habt ihr ge\u00f6ffnet?">\u00d6ffnungszeiten</button>
        <button class="eo-quick-btn" data-msg="Ich m\u00f6chte einen Termin buchen">Termin buchen</button>
        <button class="eo-quick-btn" data-msg="Wo ist der Salon?">Adresse</button>
      </div>
      <div class="eo-input">
        <input type="text" id="eo-input" placeholder="Schreib mir eine Nachricht..." autocomplete="off">
        <button id="eo-send">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // Logic
  var widget = document.getElementById("eo-widget");
  var toggle = document.getElementById("eo-toggle");
  var close = document.getElementById("eo-close");
  var messages = document.getElementById("eo-messages");
  var input = document.getElementById("eo-input");
  var send = document.getElementById("eo-send");
  var quickReplies = document.getElementById("eo-quick-replies");

  toggle.addEventListener("click", function () {
    var isOpen = widget.classList.toggle("eo-open");
    toggle.classList.toggle("eo-active", isOpen);
    if (isOpen) input.focus();
  });

  close.addEventListener("click", function () {
    widget.classList.remove("eo-open");
    toggle.classList.remove("eo-active");
  });

  // Quick reply buttons
  quickReplies.addEventListener("click", function (e) {
    var btn = e.target.closest(".eo-quick-btn");
    if (btn) {
      var msg = btn.getAttribute("data-msg");
      input.value = msg;
      sendMessage();
    }
  });

  function hideQuickReplies() {
    if (quickRepliesShown) {
      quickReplies.style.display = "none";
      quickRepliesShown = false;
    }
  }

  function addMsg(text, role) {
    var div = document.createElement("div");
    div.className = "eo-msg eo-msg-" + role;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text) return;

    input.value = "";
    hideQuickReplies();
    addMsg(text, "user");
    chatHistory.push({ role: "user", content: text });

    send.disabled = true;
    var typing = addMsg("Schreibt...", "assistant eo-msg-typing");

    try {
      var res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory }),
      });

      var data = await res.json();
      if (data.error) throw new Error(data.error);

      typing.remove();
      addMsg(data.reply, "assistant");
      chatHistory.push({ role: "assistant", content: data.reply });
    } catch (err) {
      typing.remove();
      addMsg("Entschuldigung, da ist etwas schiefgelaufen. Bitte versuch es nochmal.", "assistant");
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  send.addEventListener("click", sendMessage);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendMessage();
  });
})();

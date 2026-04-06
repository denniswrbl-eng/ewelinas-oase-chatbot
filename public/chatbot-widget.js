(function () {
  const API_URL = "https://glowing-kataifi-ed4931.netlify.app/.netlify/functions/chat";
  const chatHistory = [];

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
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      background: #e8006f;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      transition: background 0.2s;
      z-index: 99999;
    }
    .eo-toggle:hover { background: #c70060; }
    .eo-toggle svg { width: 26px; height: 26px; fill: #fff; }

    .eo-widget {
      position: fixed;
      bottom: 92px;
      right: 24px;
      width: 300px;
      height: 400px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #eee;
      z-index: 99999;
      font-family: "Cormorant Garamond", Georgia, serif;
    }
    .eo-widget.eo-open { display: flex; }

    .eo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: #fff;
      border-bottom: 1px solid #eee;
    }
    .eo-header h1 {
      font-size: 18px;
      font-weight: 600;
      color: #e8006f;
      letter-spacing: 1px;
      margin: 0;
      font-family: "Cormorant Garamond", Georgia, serif;
    }
    .eo-header button {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 20px;
      color: #999;
      line-height: 1;
      padding: 0 2px;
    }
    .eo-header button:hover { color: #e8006f; }

    .eo-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #fff;
    }
    .eo-messages::-webkit-scrollbar { width: 4px; }
    .eo-messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }

    .eo-msg {
      max-width: 85%;
      padding: 8px 12px;
      line-height: 1.4;
      font-size: 15px;
      white-space: pre-wrap;
      border-radius: 4px;
      font-family: "Cormorant Garamond", Georgia, serif;
    }
    .eo-msg-user {
      align-self: flex-end;
      background: #e8006f;
      color: #fff;
    }
    .eo-msg-assistant {
      align-self: flex-start;
      background: #f3f3f3;
      color: #333;
    }
    .eo-msg-typing {
      font-style: italic;
      color: #999;
    }

    .eo-input {
      display: flex;
      padding: 10px;
      border-top: 1px solid #eee;
      gap: 8px;
      background: #fff;
      align-items: center;
    }
    .eo-input input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      font-family: "Cormorant Garamond", Georgia, serif;
      outline: none;
    }
    .eo-input input::placeholder { color: #bbb; }
    .eo-input input:focus { border-color: #e8006f; }
    .eo-input button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
    }
    .eo-input button svg { width: 22px; height: 22px; fill: #e8006f; transition: fill 0.2s; }
    .eo-input button:hover svg { fill: #c70060; }
    .eo-input button:disabled svg { fill: #f0a0c0; }
  `;
  document.head.appendChild(style);

  // HTML
  const container = document.createElement("div");
  container.innerHTML = `
    <button class="eo-toggle" id="eo-toggle">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>
    </button>
    <div class="eo-widget" id="eo-widget">
      <div class="eo-header">
        <h1>Ewelinas Oase</h1>
        <button id="eo-close">&times;</button>
      </div>
      <div class="eo-messages" id="eo-messages">
        <div class="eo-msg eo-msg-assistant">Willkommen bei Ewelinas Oase! Wie kann ich Ihnen helfen?</div>
      </div>
      <div class="eo-input">
        <input type="text" id="eo-input" placeholder="Ihre Nachricht..." autocomplete="off">
        <button id="eo-send">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // Logic
  const widget = document.getElementById("eo-widget");
  const toggle = document.getElementById("eo-toggle");
  const close = document.getElementById("eo-close");
  const messages = document.getElementById("eo-messages");
  const input = document.getElementById("eo-input");
  const send = document.getElementById("eo-send");

  toggle.addEventListener("click", function () {
    widget.classList.toggle("eo-open");
    if (widget.classList.contains("eo-open")) input.focus();
  });

  close.addEventListener("click", function () {
    widget.classList.remove("eo-open");
  });

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
      addMsg("Fehler: " + err.message, "assistant");
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

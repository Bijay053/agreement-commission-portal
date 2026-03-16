let pendingPortalInfo = null;
let bannerElement = null;

function isVisible(el) {
  return !!(el && el.offsetWidth > 0 && el.offsetHeight > 0);
}

function triggerEvents(el) {
  el.focus();
  ["focus", "input", "change"].forEach((name) => {
    el.dispatchEvent(new Event(name, { bubbles: true }));
  });
  el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
}

function setNativeValue(element, value) {
  const valueSetter =
    Object.getOwnPropertyDescriptor(element.__proto__, "value")?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter =
    Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function findUsernameField(customSelector) {
  if (customSelector) {
    const el = document.querySelector(customSelector);
    if (el && isVisible(el)) return el;
  }

  const candidates = [
    'input[type="email"]',
    'input[name*="email" i]',
    'input[id*="email" i]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[name*="user" i]',
    'input[id*="user" i]',
    'input[name*="login" i]',
    'input[id*="login" i]',
    'input[type="text"]'
  ];

  for (const selector of candidates) {
    const fields = document.querySelectorAll(selector);
    for (const field of fields) {
      if (isVisible(field)) return field;
    }
  }
  return null;
}

function findPasswordField(customSelector) {
  if (customSelector) {
    const el = document.querySelector(customSelector);
    if (el && isVisible(el)) return el;
  }
  const fields = document.querySelectorAll('input[type="password"]');
  for (const field of fields) {
    if (isVisible(field)) return field;
  }
  return null;
}

function findSubmitButton(customSelector) {
  if (customSelector) {
    const el = document.querySelector(customSelector);
    if (el && isVisible(el)) return el;
  }

  const candidates = [
    'button[type="submit"]',
    'input[type="submit"]',
    "button"
  ];

  for (const selector of candidates) {
    const fields = document.querySelectorAll(selector);
    for (const field of fields) {
      if (!isVisible(field)) continue;
      const text = (field.innerText || field.value || "").toLowerCase();
      if (
        text.includes("login") ||
        text.includes("log in") ||
        text.includes("sign in") ||
        text.includes("submit")
      ) {
        return field;
      }
    }
  }

  return (
    document.querySelector('button[type="submit"]') ||
    document.querySelector('input[type="submit"]') ||
    null
  );
}

function sendLog(portalId, action, message) {
  chrome.runtime.sendMessage({
    type: "LOG_EVENT",
    portalId,
    action,
    url: window.location.href,
    message
  });
}

function clearPending() {
  pendingPortalInfo = null;
}

function removeBanner() {
  if (bannerElement) {
    bannerElement.remove();
    bannerElement = null;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str || ""));
  return div.innerHTML;
}

function showAutofillBanner(info) {
  removeBanner();

  const shadow = document.createElement("div");
  shadow.id = "sic-autofill-root";
  const shadowRoot = shadow.attachShadow({ mode: "closed" });

  shadowRoot.innerHTML = `
    <style>
      @keyframes sic-slide-in {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
      .sic-banner {
        position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
        background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
        color: white; padding: 10px 16px;
        display: flex; align-items: center; justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px; box-shadow: 0 2px 12px rgba(0,0,0,0.2);
        animation: sic-slide-in 0.3s ease-out;
      }
      .sic-left { display: flex; align-items: center; gap: 10px; }
      .sic-btns { display: flex; gap: 8px; align-items: center; }
      .sic-fill {
        background: white; color: #4f46e5; border: none; border-radius: 4px;
        padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
      }
      .sic-dismiss {
        background: transparent; color: rgba(255,255,255,0.8);
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 4px; padding: 6px 10px; font-size: 12px; cursor: pointer;
      }
    </style>
    <div class="sic-banner">
      <div class="sic-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>
          <strong>${escapeHtml(info.portalName)}</strong> &mdash;
          credentials ready for <strong>${escapeHtml(info.username)}</strong>
        </span>
      </div>
      <div class="sic-btns">
        <button class="sic-fill">Fill Credentials</button>
        <button class="sic-dismiss">Dismiss</button>
      </div>
    </div>
  `;

  document.body.appendChild(shadow);
  bannerElement = shadow;

  shadowRoot.querySelector(".sic-fill").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    performAutofill(info);
    removeBanner();
    clearPending();
  });

  shadowRoot.querySelector(".sic-dismiss").addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    removeBanner();
    sendLog(info.portalId, "autofill_dismissed", "User dismissed autofill banner");
    clearPending();
  });

  setTimeout(() => {
    removeBanner();
    clearPending();
  }, 30000);
}

function performAutofill(info) {
  const usernameField = findUsernameField(info.usernameSelector);
  const passwordField = findPasswordField(info.passwordSelector);

  if (!usernameField && !passwordField) {
    sendLog(info.portalId, "autofill_failed", "No login fields found on page");
    return;
  }

  if (usernameField) {
    setNativeValue(usernameField, info.username);
    triggerEvents(usernameField);
  }

  chrome.runtime.sendMessage(
    { type: "FETCH_PASSWORD", portalId: info.portalId },
    (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        sendLog(
          info.portalId,
          "autofill_failed",
          "Failed to fetch password: " + (response?.error || chrome.runtime.lastError?.message || "unknown")
        );
        return;
      }

      let password = response.password;

      if (passwordField) {
        setNativeValue(passwordField, password);
        triggerEvents(passwordField);
      }

      password = null;
      if (response) response.password = null;

      sendLog(
        info.portalId,
        "autofill_success",
        `Filled: username=${!!usernameField}, password=${!!passwordField}`
      );

      if (info.autoSubmit) {
        const submitButton = findSubmitButton(info.submitSelector);
        if (submitButton) {
          setTimeout(() => submitButton.click(), 600);
        }
      }
    }
  );
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CREDENTIALS_AVAILABLE") {
    pendingPortalInfo = {
      portalName: message.payload.portalName,
      portalId: message.payload.portalId,
      username: message.payload.username,
      usernameSelector: message.payload.usernameSelector,
      passwordSelector: message.payload.passwordSelector,
      submitSelector: message.payload.submitSelector,
      autoSubmit: message.payload.autoSubmit
    };
    showAutofillBanner(pendingPortalInfo);
    sendResponse({ ok: true });
  }

  if (message.type === "TRIGGER_FILL" && pendingPortalInfo) {
    performAutofill(pendingPortalInfo);
    removeBanner();
    clearPending();
    sendResponse({ ok: true });
  }
});

window.addEventListener("beforeunload", () => {
  removeBanner();
  clearPending();
});

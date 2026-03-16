function isVisible(el) {
  return !!(el && el.offsetWidth > 0 && el.offsetHeight > 0);
}

function triggerEvents(el) {
  el.focus();
  el.dispatchEvent(new Event("focus", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));

  el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
}

function setNativeValue(element, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(element.__proto__, "value")?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

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
    'button'
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
        text.includes("submit") ||
        text.includes("enter")
      ) {
        return field;
      }
    }
  }

  const submitBtn = document.querySelector('button[type="submit"]');
  if (submitBtn && isVisible(submitBtn)) return submitBtn;

  const inputSubmit = document.querySelector('input[type="submit"]');
  if (inputSubmit && isVisible(inputSubmit)) return inputSubmit;

  return null;
}

function logToServer(payload, config) {
  if (!config.crmBaseUrl || !config.sessionCookie) return;
  try {
    fetch(`${config.crmBaseUrl}/api/portal-access/autofill-log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sessionid=${config.sessionCookie}`
      },
      credentials: "include",
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Autofill log error:", e);
  }
}

function autofill(payload) {
  const { portal, autoSubmit, crmBaseUrl, sessionCookie } = payload;
  const config = { crmBaseUrl, sessionCookie };

  const usernameField = findUsernameField(portal.username_selector);
  const passwordField = findPasswordField(portal.password_selector);

  if (!usernameField && !passwordField) {
    console.warn("[SIC Autofill] No login fields found on page");
    logToServer({
      portal_id: portal.id,
      action: "autofill_failed",
      url: window.location.href,
      message: "No login fields found"
    }, config);
    return false;
  }

  if (usernameField) {
    setNativeValue(usernameField, portal.username);
    triggerEvents(usernameField);
  }

  if (passwordField) {
    setNativeValue(passwordField, portal.password);
    triggerEvents(passwordField);
  }

  logToServer({
    portal_id: portal.id,
    action: "autofill_success",
    url: window.location.href,
    message: `Filled: username=${!!usernameField}, password=${!!passwordField}`
  }, config);

  if (autoSubmit) {
    const submitButton = findSubmitButton(portal.submit_selector);
    if (submitButton) {
      setTimeout(() => submitButton.click(), 600);
    }
  }

  return true;
}

function retryAutofill(payload, maxAttempts = 6) {
  let count = 0;

  const run = () => {
    const ok = autofill(payload);
    count += 1;

    if (!ok && count < maxAttempts) {
      setTimeout(run, 1000);
    }
  };

  run();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTOFILL_CREDENTIALS") {
    retryAutofill(message.payload, 6);
    sendResponse({ ok: true });
  }
});

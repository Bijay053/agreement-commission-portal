chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("sessionCheck", { periodInMinutes: 30 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "sessionCheck") {
    const config = await getStoredConfig();
    if (!config.crmBaseUrl || !config.sessionCookie) return;
    try {
      const res = await fetch(`${config.crmBaseUrl}/api/auth/me`, {
        headers: {
          "X-Session-Token": config.sessionCookie
        }
      });
      if (!res.ok) {
        chrome.storage.sync.set({ sessionCookie: "" });
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
      }
    } catch {}
  }
});

async function getStoredConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["crmBaseUrl", "sessionCookie", "autoSubmit"],
      (result) => {
        resolve({
          crmBaseUrl: (result.crmBaseUrl || "").replace(/\/+$/, ""),
          sessionCookie: result.sessionCookie || "",
          autoSubmit: !!result.autoSubmit
        });
      }
    );
  });
}

function makeHeaders(sessionCookie) {
  return {
    "Content-Type": "application/json",
    "X-Session-Token": sessionCookie
  };
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("about:") ||
    tab.url.startsWith("edge://") ||
    tab.url.startsWith("file://")
  )
    return;

  const config = await getStoredConfig();
  if (!config.crmBaseUrl || !config.sessionCookie) return;

  let hostname;
  try {
    hostname = new URL(tab.url).hostname.toLowerCase();
  } catch {
    return;
  }

  try {
    const crmHost = new URL(config.crmBaseUrl).hostname.toLowerCase();
    if (hostname === crmHost) return;
  } catch {
    return;
  }

  try {
    const response = await fetch(`${config.crmBaseUrl}/api/portal-access/match`, {
      method: "POST",
      headers: makeHeaders(config.sessionCookie),
      body: JSON.stringify({ url: tab.url })
    });

    if (response.status === 401) {
      chrome.storage.sync.set({ sessionCookie: "" });
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
      return;
    }

    if (!response.ok) return;

    const data = await response.json();
    if (!data.matched) return;

    const portalDomain = (data.portal.domain || "").toLowerCase();
    if (portalDomain && hostname !== portalDomain && !hostname.endsWith("." + portalDomain)) {
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
    } catch (injErr) {
      console.error("Content script injection failed:", injErr.message);
      return;
    }

    await new Promise((r) => setTimeout(r, 300));

    chrome.tabs.sendMessage(tabId, {
      type: "CREDENTIALS_AVAILABLE",
      payload: {
        portalName: data.portal.portal_name,
        portalId: data.portal.id,
        username: data.portal.username,
        usernameSelector: data.portal.username_selector,
        passwordSelector: data.portal.password_selector,
        submitSelector: data.portal.submit_selector,
        autoSubmit: config.autoSubmit
      }
    }, (resp) => {
      if (chrome.runtime.lastError) {
        console.error("Message to content script failed:", chrome.runtime.lastError.message);
      }
    });

    chrome.action.setBadgeText({ text: "1", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#16a34a", tabId });
  } catch (error) {
    console.error("Portal match error:", error.message);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FETCH_PASSWORD") {
    (async () => {
      try {
        const config = await getStoredConfig();
        const response = await fetch(
          `${config.crmBaseUrl}/api/portal-access/${message.portalId}/copy-password`,
          {
            method: "POST",
            headers: makeHeaders(config.sessionCookie)
          }
        );
        if (!response.ok) {
          sendResponse({ ok: false, error: "Permission denied or server error" });
          return;
        }
        const data = await response.json();
        sendResponse({ ok: true, password: data.password || "" });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === "LOG_EVENT") {
    (async () => {
      try {
        const config = await getStoredConfig();
        if (!config.crmBaseUrl || !config.sessionCookie) return;
        await fetch(`${config.crmBaseUrl}/api/portal-access/autofill-log`, {
          method: "POST",
          headers: makeHeaders(config.sessionCookie),
          body: JSON.stringify({
            portal_id: message.portalId,
            action: message.action,
            url: message.url,
            message: message.message
          })
        });
      } catch {}
    })();
  }
});

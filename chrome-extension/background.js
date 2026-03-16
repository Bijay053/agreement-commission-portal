chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("sessionCheck", { periodInMinutes: 30 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "sessionCheck") {
    const config = await getStoredConfig();
    if (!config.crmBaseUrl || !config.sessionCookie) return;
    try {
      const res = await fetch(`${config.crmBaseUrl}/api/auth/me`, {
        headers: { "Cookie": `sessionid=${config.sessionCookie}` },
        credentials: "include"
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

function validateHttpsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("about:") ||
    tab.url.startsWith("edge://")
  )
    return;

  const config = await getStoredConfig();
  if (!config.crmBaseUrl || !config.sessionCookie) return;
  if (!validateHttpsUrl(config.crmBaseUrl)) return;

  let hostname;
  try {
    hostname = new URL(tab.url).hostname.toLowerCase();
  } catch {
    return;
  }

  if (hostname === new URL(config.crmBaseUrl).hostname.toLowerCase()) return;

  try {
    const response = await fetch(`${config.crmBaseUrl}/api/portal-access/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sessionid=${config.sessionCookie}`
      },
      credentials: "include",
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

    const origin = `https://${hostname}/*`;
    const hasPermission = await chrome.permissions.contains({ origins: [origin] });
    if (!hasPermission) {
      chrome.action.setBadgeText({ text: "?", tabId });
      chrome.action.setBadgeBackgroundColor({ color: "#f59e0b", tabId });
      chrome.storage.session.set({
        pendingPermission: { origin, tabId, portalName: data.portal.portal_name }
      });
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });

    await chrome.tabs.sendMessage(tabId, {
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
            headers: {
              "Content-Type": "application/json",
              "Cookie": `sessionid=${config.sessionCookie}`
            },
            credentials: "include"
          }
        );
        if (!response.ok) {
          sendResponse({ ok: false, error: "Permission denied" });
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
          headers: {
            "Content-Type": "application/json",
            "Cookie": `sessionid=${config.sessionCookie}`
          },
          credentials: "include",
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

chrome.runtime.onInstalled.addListener(() => {
  console.log("Study Info Centre Portal Autofill Extension installed");
});

async function getStoredConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["crmBaseUrl", "sessionCookie", "autoSubmit"], (result) => {
      resolve({
        crmBaseUrl: (result.crmBaseUrl || "").replace(/\/+$/, ""),
        sessionCookie: result.sessionCookie || "",
        autoSubmit: !!result.autoSubmit
      });
    });
  });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;

  const config = await getStoredConfig();
  if (!config.crmBaseUrl || !config.sessionCookie) return;

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

    if (!response.ok) return;

    const data = await response.json();
    if (!data.matched) return;

    await chrome.tabs.sendMessage(tabId, {
      type: "AUTOFILL_CREDENTIALS",
      payload: {
        portal: data.portal,
        autoSubmit: config.autoSubmit,
        crmBaseUrl: config.crmBaseUrl,
        sessionCookie: config.sessionCookie
      }
    });
  } catch (error) {
    console.error("Portal match error:", error);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const crmBaseUrl = document.getElementById("crmBaseUrl");
  const sessionCookie = document.getElementById("sessionCookie");
  const autoSubmit = document.getElementById("autoSubmit");
  const saveBtn = document.getElementById("saveBtn");
  const testBtn = document.getElementById("testBtn");
  const statusOk = document.getElementById("statusOk");
  const statusErr = document.getElementById("statusErr");
  const connStatus = document.getElementById("connStatus");

  chrome.storage.sync.get(
    ["crmBaseUrl", "sessionCookie", "autoSubmit"],
    (result) => {
      crmBaseUrl.value = result.crmBaseUrl || "";
      sessionCookie.value = result.sessionCookie || "";
      autoSubmit.checked = !!result.autoSubmit;
    }
  );

  function showStatus(el, msg, duration) {
    el.textContent = msg;
    el.style.display = "block";
    setTimeout(() => {
      el.style.display = "none";
    }, duration || 3000);
  }

  const permissionBar = document.getElementById("permissionBar");
  const permPortalName = document.getElementById("permPortalName");
  const grantPermBtn = document.getElementById("grantPermBtn");

  chrome.storage.session.get(["pendingPermission"], (result) => {
    if (result.pendingPermission) {
      const pp = result.pendingPermission;
      permPortalName.textContent = pp.portalName || pp.origin;
      permissionBar.style.display = "block";

      grantPermBtn.addEventListener("click", async () => {
        const granted = await chrome.permissions.request({
          origins: [pp.origin]
        });
        if (granted) {
          chrome.storage.session.remove("pendingPermission");
          permissionBar.style.display = "none";
          showStatus(statusOk, "Permission granted! Reload the portal page.");
          chrome.action.setBadgeText({ text: "" });
        } else {
          showStatus(statusErr, "Permission was denied");
        }
      });
    }
  });

  saveBtn.addEventListener("click", () => {
    const url = crmBaseUrl.value.trim().replace(/\/+$/, "");
    const cookie = sessionCookie.value.trim();

    if (!url) {
      showStatus(statusErr, "CRM Base URL is required");
      return;
    }

    if (!url.startsWith("https://")) {
      showStatus(statusErr, "CRM URL must use HTTPS for security");
      return;
    }

    chrome.storage.sync.set(
      {
        crmBaseUrl: url,
        sessionCookie: cookie,
        autoSubmit: autoSubmit.checked
      },
      () => {
        showStatus(statusOk, "Settings saved");
        chrome.action.setBadgeText({ text: "" });
      }
    );
  });

  testBtn.addEventListener("click", async () => {
    const url = crmBaseUrl.value.trim().replace(/\/+$/, "");
    const cookie = sessionCookie.value.trim();

    if (!url || !cookie) {
      connStatus.className = "conn-status status-err";
      connStatus.textContent = "Fill in CRM URL and session cookie first";
      connStatus.style.display = "block";
      return;
    }

    connStatus.className = "conn-status";
    connStatus.style.cssText =
      "display: block; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; font-size: 11px; margin-top: 6px;";
    connStatus.textContent = "Testing connection...";

    try {
      const res = await fetch(`${url}/api/auth/me`, {
        headers: {
          Cookie: `sessionid=${cookie}`
        },
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        const name = data.name || data.email || "Unknown";
        connStatus.className = "conn-status status-ok";
        connStatus.textContent = `Connected as ${name}`;
        connStatus.style.display = "block";
      } else if (res.status === 401) {
        connStatus.className = "conn-status status-err";
        connStatus.textContent =
          "Session expired or invalid. Please get a new sessionid cookie.";
        connStatus.style.display = "block";
      } else {
        connStatus.className = "conn-status status-err";
        connStatus.textContent = `Server error (${res.status})`;
        connStatus.style.display = "block";
      }
    } catch (e) {
      connStatus.className = "conn-status status-err";
      connStatus.textContent = `Connection failed: ${e.message}`;
      connStatus.style.display = "block";
    }
  });
});

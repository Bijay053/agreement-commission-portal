document.addEventListener("DOMContentLoaded", () => {
  const crmBaseUrl = document.getElementById("crmBaseUrl");
  const sessionCookie = document.getElementById("sessionCookie");
  const autoSubmit = document.getElementById("autoSubmit");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  chrome.storage.sync.get(["crmBaseUrl", "sessionCookie", "autoSubmit"], (result) => {
    crmBaseUrl.value = result.crmBaseUrl || "";
    sessionCookie.value = result.sessionCookie || "";
    autoSubmit.checked = !!result.autoSubmit;
  });

  saveBtn.addEventListener("click", () => {
    chrome.storage.sync.set({
      crmBaseUrl: crmBaseUrl.value.trim().replace(/\/+$/, ""),
      sessionCookie: sessionCookie.value.trim(),
      autoSubmit: autoSubmit.checked
    }, () => {
      status.style.display = "block";
      setTimeout(() => { status.style.display = "none"; }, 2000);
    });
  });
});

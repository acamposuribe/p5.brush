(() => {
  const start =
    performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd ??
    performance.now();

  let reported = false;
  let badge = null;

  function ensureBadge() {
    if (document.getElementById("firstLoadVal")) return null;
    if (badge) return badge;
    if (!document.body) return null;

    badge = document.createElement("div");
    badge.id = "standalone-first-load-badge";
    badge.style.position = "fixed";
    badge.style.top = "12px";
    badge.style.right = "12px";
    badge.style.zIndex = "9999";
    badge.style.padding = "8px 10px";
    badge.style.border = "1px solid rgba(48, 41, 30, 0.14)";
    badge.style.borderRadius = "8px";
    badge.style.background = "rgba(255, 252, 245, 0.9)";
    badge.style.color = "#153e5c";
    badge.style.font = '11px/1.4 Menlo, Monaco, "Courier New", monospace';
    badge.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.06)";
    badge.textContent = "First load -";
    document.body.appendChild(badge);
    return badge;
  }

  function setText(text) {
    const valueEl = document.getElementById("firstLoadVal");
    if (valueEl) {
      valueEl.textContent = text;
      return;
    }
    const el = ensureBadge();
    if (el) el.textContent = `First load ${text}`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureBadge();
  });

  window.reportStandaloneFirstFrame = (label = document.title || "standalone test") => {
    if (reported) return;
    reported = true;
    requestAnimationFrame(() => {
      const total = performance.now() - start;
      const text = `${total.toFixed(1)} ms`;
      setText(text);
      console.log(`${label} first load: ${text}`);
    });
  };
})();

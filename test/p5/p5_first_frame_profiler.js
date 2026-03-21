(() => {
  const start =
    performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd ??
    performance.now();

  // Exposed so scripts can compute parse time:
  // const parseMs = performance.now() - window.__brushLoadStart;
  window.__brushLoadStart = start;

  let reported = false;
  let badge = null;

  function ensureBadge() {
    if (document.getElementById("firstLoadVal")) return null;
    if (badge) return badge;
    if (!document.body) return null;

    badge = document.createElement("div");
    badge.id = "p5-first-load-badge";
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

  document.addEventListener("DOMContentLoaded", () => {
    ensureBadge();
  });

  // timing: optional { parseMs, drawMs }
  // render is derived as (total - parseMs - drawMs) inside the rAF, where total
  // is rAF-measured and therefore includes actual GPU work and any p5 draw() overhead
  // (e.g. the image(labelBuf) blit) that runs after setup() but before the frame paints.
  window.reportP5FirstFrame = (label = document.title || "p5 test", timing = {}) => {
    if (reported) return;
    reported = true;
    requestAnimationFrame(() => {
      const total = performance.now() - start;
      const parts = [];
      if (timing.parseMs != null) parts.push(`parse ${timing.parseMs.toFixed(0)} ms`);
      if (timing.drawMs  != null) parts.push(`draw ${timing.drawMs.toFixed(0)} ms`);
      if (timing.parseMs != null && timing.drawMs != null) {
        const renderMs = total - timing.parseMs - timing.drawMs;
        parts.push(`render ${renderMs.toFixed(0)} ms`);
      }
      const hasBreakdown = parts.length > 0;
      parts.push(hasBreakdown ? `total ${total.toFixed(0)} ms` : `${total.toFixed(1)} ms`);
      const text = parts.join(" · ");

      const valueEl = document.getElementById("firstLoadVal");
      if (valueEl) {
        valueEl.textContent = text;
      } else {
        const el = ensureBadge();
        if (el) el.textContent = hasBreakdown ? text : `First load ${text}`;
      }
      console.log(`${label}: ${text}`);
    });
  };
})();

(() => {
  const GROUPS = [
    [
      "p5/visual_suite.html",
      "p5/fill_circle_explorer.html",
      "p5/wash_test.html",
      "p5/pastel_hatching_test.html",
      "p5/angle_mode_test.html",
      "p5/transform_test.html",
      "p5/pushpop_test.html",
      "p5/hatch_test.html",
      "p5/field_explorer.html",
      "p5/offscreen_target_test.html",
      "p5/instance_mode_test.html",
      "p5/multi_instance_async_test.html",
    ],
    [
      "standalone/visual_suite.html",
      "standalone/fill_circle_explorer.html",
      "standalone/wash_test.html",
      "standalone/pastel_hatching_test.html",
      "standalone/angle_mode_test.html",
      "standalone/transform_test.html",
      "standalone/pushpop_test.html",
      "standalone/hatch_test.html",
      "standalone/field_explorer.html",
    ],
  ];

  function currentPage() {
    const parts = location.pathname.split("/");
    const testIdx = parts.lastIndexOf("test");
    if (testIdx === -1) return null;
    return parts.slice(testIdx + 1).join("/");
  }

  function relPath(from, to) {
    const fromDir = from.includes("/") ? from.split("/")[0] : "";
    const toDir   = to.includes("/")   ? to.split("/")[0]   : "";
    if (fromDir === toDir) return to.includes("/") ? to.split("/").slice(1).join("/") : to;
    if (fromDir === "") return "./" + to;
    return "../" + to;
  }

  function makeArrow(href, label, side) {
    const a = document.createElement("a");
    a.href = href;
    a.setAttribute("aria-label", label);
    a.style.cssText = [
      "position:fixed",
      side + ":14px",
      "top:50%",
      "transform:translateY(-50%)",
      "z-index:9000",
      "color:#8a9aa8",
      "text-decoration:none",
      "user-select:none",
      "transition:color 150ms",
    ].join(";");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${side === "left" ? '<polyline points="15 18 9 12 15 6"/>' : '<polyline points="9 18 15 12 9 6"/>'}</svg>`;
    a.innerHTML = svg;
    a.addEventListener("mouseenter", () => { a.style.color = "#153e5c"; });
    a.addEventListener("mouseleave", () => { a.style.color = "#8a9aa8"; });
    return a;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const cur = currentPage();
    if (!cur) return;
    for (const group of GROUPS) {
      const idx = group.indexOf(cur);
      if (idx === -1) continue;
      if (idx > 0)
        document.body.appendChild(makeArrow(relPath(cur, group[idx - 1]), "Previous test", "left"));
      if (idx < group.length - 1)
        document.body.appendChild(makeArrow(relPath(cur, group[idx + 1]), "Next test", "right"));
      break;
    }
  });
})();

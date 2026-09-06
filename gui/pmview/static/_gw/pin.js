"use strict";
// Region picker, spliced into a prototype by `?pin=1`.
//
// It renders NO input and holds NO text. Click a region, and the parent gets a
// label and a rect; the parent owns every field, the composer and the send. So
// the annotation UI is built from pmview's own components under its own class
// contract, and nothing the agent authored ever renders an input the human
// types into.
//
// The frame is sandboxed WITHOUT allow-same-origin, so this runs at an opaque
// origin and cannot reach /api/*. The parent therefore receives
// `event.origin === "null"` and must validate with `event.source ===
// frame.contentWindow` instead — never by origin.

(function () {
  const tag = document.currentScript;
  const surface = tag ? tag.dataset.gwSurface || "" : "";
  const screen = tag ? tag.dataset.gwScreen || "" : "";

  const style = document.createElement("style");
  style.textContent = `
    [data-gw-region]{cursor:crosshair}
    [data-gw-region]:hover{outline:2px dashed rgba(47,111,219,.85);outline-offset:2px}
    .gw-pin-lit{outline:2px solid rgba(47,111,219,1)!important;outline-offset:2px}`;
  document.head.appendChild(style);

  // Normalised against the document box, so the rect survives the frame being
  // resized between the pick and the human reading it back.
  function rectOf(node) {
    const box = node.getBoundingClientRect();
    const w = Math.max(1, document.documentElement.scrollWidth);
    const h = Math.max(1, document.documentElement.scrollHeight);
    return {
      x: +((box.left + window.scrollX) / w).toFixed(4),
      y: +((box.top + window.scrollY) / h).toFixed(4),
      w: +(box.width / w).toFixed(4),
      h: +(box.height / h).toFixed(4),
    };
  }

  document.addEventListener("click", (event) => {
    const region = event.target.closest("[data-gw-region]");
    if (!region) return;
    event.preventDefault();
    event.stopPropagation();
    parent.postMessage({
      source: "gw-pin",
      type: "pick",
      surface,
      screen,
      region: region.getAttribute("data-gw-region") || "",
      rect: rectOf(region),
    }, "*");   // safe: the payload is a label and a rect, nothing else
  }, true);

  let lit = null;
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== "gw-host" || data.type !== "highlight") return;
    if (lit) lit.classList.remove("gw-pin-lit");
    lit = data.region
      ? document.querySelector(`[data-gw-region="${CSS.escape(String(data.region))}"]`)
      : null;
    if (lit) {
      lit.classList.add("gw-pin-lit");
      lit.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });

  parent.postMessage({
    source: "gw-pin",
    type: "ready",
    surface,
    screen,
    regions: [...document.querySelectorAll("[data-gw-region]")]
      .map((n) => n.getAttribute("data-gw-region")),
  }, "*");
})();

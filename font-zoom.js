// ═══════════════════════════════════════════════════════════════
//  English Drills — A− / A+ per ingrandire il testo delle attività
//  Lo zoom vale per il contenuto della pagina, NON per i pulsanti A−/A+:
//  così restano fermi nello stesso punto e si può cliccare di seguito.
//  La scelta resta su questo computer (vale per tutte le attività).
// ═══════════════════════════════════════════════════════════════
(function () {
  var KEY = 'drill_zoom', MIN = 0.8, MAX = 2;
  var z = 1;
  try {
    var v = parseFloat(localStorage.getItem(KEY));
    if (v >= MIN && v <= MAX) z = v;
  } catch (e) {}

  var box, lbl;

  function zoomEl(el) {
    if (el.nodeType !== 1 || el === box || /^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(el.tagName)) return;
    el.style.zoom = z === 1 ? '' : String(z);
  }

  function apply() {
    [].forEach.call(document.body.children, zoomEl);
    lbl.textContent = Math.round(z * 100) + '%';
  }

  function step(dir) {
    z = dir === 0 ? 1 : Math.min(MAX, Math.max(MIN, Math.round((z + dir * 0.1) * 10) / 10));
    try { localStorage.setItem(KEY, String(z)); } catch (e) {}
    apply();
  }

  function init() {
    var css = document.createElement('style');
    css.textContent =
      '#drill-zoom{position:fixed;right:14px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:2px;' +
      'padding:3px 4px;background:rgba(20,20,30,.82);border:1px solid rgba(255,255,255,.18);border-radius:20px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
      'font:700 13px/1 -apple-system,"Segoe UI",system-ui,sans-serif;color:#fff;user-select:none;-webkit-user-select:none;}' +
      '#drill-zoom button{border:none;background:transparent;color:#fff;cursor:pointer;font:inherit;font-weight:800;' +
      'padding:6px 10px;border-radius:14px;line-height:1;letter-spacing:0;text-transform:none;transition:none;margin:0;box-shadow:none;min-width:0;}' +
      '#drill-zoom button:hover{background:rgba(255,255,255,.14);}' +
      '#drill-zoom .dz-minus{font-size:14px;}#drill-zoom .dz-plus{font-size:18px;}' +
      '#drill-zoom .dz-lbl{font-size:12px;font-weight:600;opacity:.75;width:46px;padding:6px 0;text-align:center;font-variant-numeric:tabular-nums;}' +
      '@media print{#drill-zoom{display:none!important;}}';
    document.head.appendChild(css);

    box = document.createElement('div');
    box.id = 'drill-zoom';
    box.innerHTML =
      '<button type="button" class="dz-minus" title="Riduci il testo">A−</button>' +
      '<button type="button" class="dz-lbl" title="Torna al 100%"></button>' +
      '<button type="button" class="dz-plus" title="Ingrandisci il testo">A+</button>';
    lbl = box.querySelector('.dz-lbl');
    box.querySelector('.dz-minus').addEventListener('click', function () { step(-1); });
    box.querySelector('.dz-plus').addEventListener('click', function () { step(1); });
    lbl.addEventListener('click', function () { step(0); });
    document.body.appendChild(box);

    // Anche gli elementi aggiunti dopo (popup, overlay…) seguono lo zoom
    new MutationObserver(function (list) {
      list.forEach(function (m) { [].forEach.call(m.addedNodes, zoomEl); });
    }).observe(document.body, { childList: true });

    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

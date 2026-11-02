// ═══════════════════════════════════════════════════════════════
//  Lucchetto docente — nasconde agli alunni la modalità "Oral test"
//  (What Are They Wearing?, Rules & Obligations).
//
//  • Gli alunni vedono solo "At home"; il pulsante 🔒 chiede il PIN.
//  • Una volta sbloccato, il computer se lo ricorda (se lasci la spunta)
//    finché non premi 🔓 per richiudere. Vale per tutte le attività.
//  • È un lucchetto "leggero": basta a tenere fuori i ragazzi, ma non è
//    una protezione vera (la pagina è pubblica).
//
//  Per cambiare il PIN: calcola il nuovo hash con
//    TeacherLock.hash('NUOVOPIN')  (dalla console del browser)
//  e sostituisci PIN_HASH qui sotto.
// ═══════════════════════════════════════════════════════════════
(function () {
  var KEY = 'myclass_docente';
  var PIN_HASH = '8d46b002';

  function hash(s) {
    var x = 0x811c9dc5, str = 'myclass-docente|' + String(s);
    for (var i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    return ('0000000' + x.toString(16)).slice(-8);
  }
  var TOKEN = hash(PIN_HASH + '|ok');
  function get(store) { try { return store.getItem(KEY); } catch (e) { return null; } }

  function isUnlocked() { return get(window.localStorage) === TOKEN || get(window.sessionStorage) === TOKEN; }
  function lock() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  var box = null;
  function ask(onOk) {
    if (isUnlocked()) { onOk && onOk(); return; }
    if (box) box.remove();
    box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Area docente');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:rgba(5,5,12,.72);backdrop-filter:blur(4px);padding:16px;font-family:"DM Sans",system-ui,sans-serif';
    box.innerHTML =
      '<form style="background:#161a26;color:#f1f4fa;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:22px 22px 18px;width:100%;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.5)">' +
      '<div style="font-size:19px;font-weight:800;margin-bottom:4px">🔒 Area docente</div>' +
      '<div style="font-size:13.5px;color:#a4adc2;margin-bottom:14px;line-height:1.45">La modalità <b>Oral test</b> è solo per l\'insegnante. Inserisci il PIN.</div>' +
      '<input type="password" inputmode="numeric" autocomplete="off" placeholder="PIN" style="width:100%;box-sizing:border-box;font:inherit;font-size:22px;letter-spacing:6px;text-align:center;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#0d1018;color:#fff;outline:none">' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:13px;color:#cfd6e4;margin-top:10px;cursor:pointer"><input type="checkbox" checked style="width:auto"> Ricorda su questo computer</label>' +
      '<div class="tl-err" style="min-height:20px;color:#ff6b81;font-size:13.5px;font-weight:700;margin-top:8px"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">' +
      '<button type="button" class="tl-no" style="font:inherit;font-weight:700;font-size:14px;padding:9px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#222838;color:#f1f4fa;cursor:pointer">Annulla</button>' +
      '<button type="submit" style="font:inherit;font-weight:800;font-size:14px;padding:9px 16px;border-radius:10px;border:none;background:#ffd166;color:#1a1300;cursor:pointer">🔓 Sblocca</button>' +
      '</div></form>';
    document.body.appendChild(box);
    var form = box.querySelector('form'), inp = box.querySelector('input[type=password]'), rem = box.querySelector('input[type=checkbox]'), err = box.querySelector('.tl-err');
    var close = function () { if (box) { box.remove(); box = null; } document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    box.querySelector('.tl-no').addEventListener('click', close);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (hash(inp.value.trim()) !== PIN_HASH) { err.textContent = 'PIN sbagliato.'; inp.value = ''; inp.focus(); return; }
      try { (rem.checked ? localStorage : sessionStorage).setItem(KEY, TOKEN); } catch (er) {}
      close();
      onOk && onOk();
    });
    setTimeout(function () { inp.focus(); }, 30);
  }

  window.TeacherLock = { isUnlocked: isUnlocked, ask: ask, lock: lock, hash: hash };
})();

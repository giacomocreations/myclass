// ═══════════════════════════════════════════════════════════════
//  Collegamento con la LIVE di MyClass — punteggi della griglia orale
//  (What Are They Wearing?, Rules & Obligations, Meet My Friend!, …)
//
//  • Attività → MyClass: quando nella finestra docente si sceglie un
//    punteggio, la pagina lo manda alla LIVE di MyClass aperta nello stesso
//    browser. MyClass lo mette nella sua griglia e risponde con chi l'ha
//    ricevuto.
//  • MyClass → attività: quando nella LIVE si seleziona un alunno, MyClass
//    lo annuncia; la finestra docente mostra lo stato del collegamento e
//    compila nome e classe (MyClassLive.follow).
//  • Elenco della classe nella finestra docente: classi e alunni si leggono
//    dai dati di MyClass salvati in questo browser (anche a MyClass chiusa);
//    se mancano, dall'elenco importato nei tornei. Un clic su un alunno
//    compila il nome e, se la LIVE è aperta, lo seleziona anche lì.
//
//  Funziona solo se MyClass è aperta dallo stesso sito e nello stesso
//  browser (anche in un'altra finestra o scheda). Non passa da internet.
//
//  ⚠️ Se modifichi questo file alza CACHE_VERSION in sw.js: sui computer
//  dove è stata aperta StudentApp il service worker lo tiene in cache.
//
//  Messaggio:  { type:'scores', reqId, grid:{id,nome,aree:[{nome,max}]},
//                scores:[punteggio|null per area], student, cls, save,
//                note: testo (pronuncia, errori, checklist) che va nel promemoria }
//  Risposta:   { type:'ack', reqId, ok, msg, student, classe }
//  Selezione:  { type:'select', reqId, student, cls }  →  'ack' come sopra
//  Stato:      { type:'hello', reqId }  →  { type:'live', reqId, classe,
//                student, griglia, paused, closed }   (senza reqId: annuncio
//                spontaneo quando nella LIVE cambia l'alunno o si chiude)
// ═══════════════════════════════════════════════════════════════
(function () {
  var CHANNEL = 'myclass-live-griglia';
  var bc = null;
  try { bc = new BroadcastChannel(CHANNEL); } catch (e) {}
  var waiting = {}, hellos = {}, followers = [];

  // Possono rispondere più schede di MyClass (es. una in pausa): una risposta "ok"
  // vale subito; un errore si tiene solo se entro poco non arriva una risposta ok.
  if (bc) bc.onmessage = function (e) {
    var m = e.data || {};
    if (m.type === 'live') {
      if (m.reqId && hellos[m.reqId]) {
        var h = hellos[m.reqId];
        if (!h.best || (h.best.paused && !m.paused)) h.best = m;
        if (!m.paused) { finishHello(m.reqId); }
        return;
      }
      if (!m.reqId) followers.forEach(function (f) { f(m); });
      return;
    }
    var w = m.type === 'ack' && waiting[m.reqId];
    if (!w) return;
    if (m.ok) { finish(m.reqId, m); return; }
    if (!w.err || (w.err.paused && !m.paused)) w.err = m;
    clearTimeout(w.t);
    w.t = setTimeout(function () { finish(m.reqId, w.err); }, 350);
  };
  function finish(id, r) {
    var w = waiting[id]; if (!w) return;
    delete waiting[id]; clearTimeout(w.t); w.cb(r);
  }
  function finishHello(id) {
    var h = hellos[id]; if (!h) return;
    delete hellos[id]; clearTimeout(h.t); h.cb(h.best);
  }
  var newId = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  function post(type, payload, cb) {
    cb = cb || function () {};
    if (!bc) { cb({ ok: false, msg: 'questo browser non permette il collegamento' }); return; }
    var reqId = newId();
    var msg = { type: type, reqId: reqId };
    for (var k in payload) msg[k] = payload[k];
    waiting[reqId] = { cb: cb, err: null, t: setTimeout(function () { finish(reqId, null); }, 1500) };
    bc.postMessage(msg);
  }
  // payload: { grid, scores, student, cls, save, note } · cb(risposta | null se MyClass non risponde)
  function send(payload, cb) { post('scores', payload, cb); }
  // Seleziona l'alunno nella LIVE · cb(risposta | null se la LIVE non è aperta)
  function select(student, cls, cb) { post('select', { student: student, cls: cls }, cb); }

  // Chiede alla LIVE com'è messa adesso · cb(stato | null se nessuna LIVE risponde)
  function hello(cb) {
    if (!bc) { cb(null); return; }
    var reqId = newId();
    hellos[reqId] = { cb: cb, best: null, t: setTimeout(function () { finishHello(reqId); }, 900) };
    bc.postMessage({ type: 'hello', reqId: reqId });
  }

  // ── Classi e alunni: dai dati di MyClass in questo browser, se no dai tornei ──
  function roster() {
    var out = [];
    try {
      var d = JSON.parse(localStorage.getItem('myclass_gemini_data') || 'null');
      var cl = d && d.classi; if (cl && !Array.isArray(cl)) cl = Object.values(cl);
      (cl || []).forEach(function (c) {
        var st = c.studenti || []; if (!Array.isArray(st)) st = Object.values(st);
        var nomi = st.map(function (s) { return [s.cognome, s.nome].filter(Boolean).join(' ').trim(); }).filter(Boolean)
          .sort(function (a, b) { return a.localeCompare(b, 'it'); });
        if (nomi.length) out.push({ nome: String(c.nome || '?'), studenti: nomi });
      });
    } catch (e) {}
    if (!out.length) {
      try { out = (JSON.parse(localStorage.getItem('myclass_roster_v1') || '[]') || []).filter(function (c) { return c && c.studenti && c.studenti.length; }); } catch (e) {}
    }
    return out.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'it', { numeric: true }); });
  }

  // Finestra docente che segue la LIVE: riga di stato sopra i campi nome/classe,
  // elenco della classe per scegliere l'alunno, e (se nameId) nome e classe
  // compilati con l'alunno selezionato nella LIVE. Il nome scritto a mano non
  // viene mai sostituito.
  //   getDoc(): documento della finestra docente, o null se è chiusa
  //   opts: { nameId:'t-name', classId:'t-class', onStudent(nome, classe),
  //           pickTarget(): id del campo da riempire col clic (default nameId),
  //           savedToday(): nomi già salvati oggi in questa attività (✓) }
  var PICK_KEY = 'myclass_teacher_pick';
  function follow(getDoc, opts) {
    opts = opts || {};
    var auto = { name: '', cls: '' }, timer = null, last = '', skip = '', liveCls = '', boundDoc = null;
    var pick = { cls: '', open: true };
    try { var sv = JSON.parse(localStorage.getItem(PICK_KEY) || '{}'); pick.cls = sv.cls || ''; pick.open = sv.open !== false; } catch (e) {}
    var savePick = function () { try { localStorage.setItem(PICK_KEY, JSON.stringify(pick)); } catch (e) {} };
    var esc = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
    var norm = function (t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
    var classes = [];

    function field(d, id, val, key, force) {
      var el = id && d.getElementById(id);
      if (!el || !val) return false;
      var cur = el.value.trim();
      if (!force && cur && cur !== auto[key]) return false;
      if (cur === val) return false;
      el.value = val; auto[key] = val; return true;
    }
    function fire(el) {
      ['input', 'change'].forEach(function (t) { try { el.dispatchEvent(new el.ownerDocument.defaultView.Event(t, { bubbles: true })); } catch (e) {} });
    }
    function box(d, id, before) {
      var el = d.getElementById(id);
      if (el) return el;
      var ref = d.getElementById(opts.nameId || 't-class') || d.getElementById('t-link');
      if (!ref) return null;
      ref = ref.closest('.fields') || ref;
      el = d.createElement('div'); el.id = id;
      if (before) ref.parentNode.insertBefore(el, ref); else ref.parentNode.insertBefore(el, ref.nextSibling);
      return el;
    }
    function namesInFields(d) {
      return [opts.nameId, opts.pickTarget && 't-nameA', opts.pickTarget && 't-nameB'].filter(Boolean)
        .map(function (id) { var el = d.getElementById(id); return el ? norm(el.value) : ''; }).filter(Boolean);
    }
    function renderPicker() {
      var d = getDoc(); if (!d) return;
      var el = box(d, 't-pick', true); if (!el) return;
      if (!classes.length) {
        el.innerHTML = '<div style="font-size:12px;opacity:.7;margin:2px 0 8px">👥 Nessun elenco di classi in questo browser: apri MyClass almeno una volta su questo computer (o importa l\'elenco in un torneo).</div>';
        return;
      }
      if (!pick.cls && liveCls && classes.some(function (c) { return c.nome === liveCls; })) pick.cls = liveCls;
      var c = classes.find(function (x) { return x.nome === pick.cls; });
      var done = {}; (opts.savedToday ? opts.savedToday() : []).forEach(function (n) { done[norm(n)] = 1; });
      var inFields = namesInFields(d);
      var btn = 'font:inherit;font-size:12.5px;font-weight:600;padding:4px 9px;border-radius:7px;cursor:pointer;border:1px solid rgba(127,127,127,.35);';
      var list = c && pick.open ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">' + c.studenti.map(function (n) {
        var sel = inFields.indexOf(norm(n)) >= 0, ok = done[norm(n)];
        return '<button data-pick-st="' + esc(n) + '" style="' + btn + (sel ? 'background:#ffd166;color:#1a1300;border-color:transparent;' : 'background:rgba(127,127,127,.12);color:inherit;') + '" title="' + (ok ? 'Già salvato oggi in questa attività' : 'Scegli ' + esc(n)) + '">' + (ok ? '✓ ' : '') + esc(n) + '</button>';
      }).join('') + '</div>' : '';
      el.innerHTML = '<div style="margin:2px 0 10px;padding:8px 10px;border:1px solid rgba(127,127,127,.3);border-radius:10px">'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px">👥 <b>Alunno</b>'
        + '<select data-pick-cls style="font:inherit;font-size:13px;padding:5px 8px;border-radius:8px;background:transparent;color:inherit;border:1px solid rgba(127,127,127,.4)">'
        + '<option value="">Scegli la classe…</option>' + classes.map(function (x) { return '<option value="' + esc(x.nome) + '"' + (x.nome === pick.cls ? ' selected' : '') + ' style="color:#000">' + esc(x.nome) + ' (' + x.studenti.length + ')</option>'; }).join('') + '</select>'
        + (c ? '<button data-pick-toggle style="' + btn + 'background:transparent;color:inherit">' + (pick.open ? '▴ nascondi' : '▾ mostra elenco') + '</button>' : '')
        + '<span style="opacity:.7">' + (c ? 'clic sul nome: lo scrive qui e lo seleziona nella LIVE se è aperta' : '') + '</span></div>'
        + list + '</div>';
    }
    function choose(d, name) {
      var target = opts.pickTarget ? opts.pickTarget(name) : opts.nameId;
      var el = target && d.getElementById(target);
      if (el) { el.value = name; if (target === opts.nameId) auto.name = name; fire(el); }
      var ce = opts.classId && d.getElementById(opts.classId);
      if (ce && pick.cls && ce.value.trim() !== pick.cls) { ce.value = pick.cls; auto.cls = pick.cls; fire(ce); }
      skip = '';
      renderPicker();
      select(name, pick.cls, function (r) {
        var st = d.getElementById('t-live'); if (!st || !getDoc()) return;
        if (!r) { st.className = 'link'; st.textContent = '⚪ LIVE di MyClass non aperta: ' + name + ' scelto solo qui (i voti restano nell\'attività).'; }
        else if (!r.ok) { st.className = 'link err'; st.textContent = '⚠️ MyClass: ' + r.msg; }
      });
    }
    function bind(d) {
      if (boundDoc === d) return; boundDoc = d;
      d.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-pick-st],[data-pick-toggle]'); if (!b) return;
        if (b.hasAttribute('data-pick-toggle')) { pick.open = !pick.open; savePick(); renderPicker(); return; }
        choose(d, b.getAttribute('data-pick-st'));
      });
      d.addEventListener('change', function (e) {
        if (e.target.hasAttribute && e.target.hasAttribute('data-pick-cls')) { pick.cls = e.target.value; pick.open = true; savePick(); renderPicker(); }
      });
      d.addEventListener('input', function (e) { if (/^t-name/.test(e.target.id || '')) { clearTimeout(bind.t); bind.t = setTimeout(renderPicker, 300); } });
    }
    function render(m) {
      var d = getDoc(); if (!d) return;
      bind(d);
      var el = box(d, 't-live', true); if (!el) return;
      el.className = 'link';
      if (!bc) { el.className = 'link err'; el.textContent = '⚠️ Questo browser non permette il collegamento con MyClass.'; renderPicker(); return; }
      if (!m || m.closed) {
        el.textContent = m && m.closed ? '⚪ LIVE di MyClass chiusa: puoi scegliere l\'alunno dall\'elenco qui sotto.' : '⚪ Nessuna LIVE di MyClass aperta in questo browser: scegli l\'alunno dall\'elenco qui sotto (o apri la LIVE per collegarla).';
        renderPicker(); return;
      }
      if (m.paused) { el.className = 'link err'; el.textContent = '⚠️ La LIVE è in una scheda di MyClass in pausa (MyClass aperta due volte): chiudi l\'altra scheda o premi "↻ Usa questa scheda" e riapri la LIVE.'; renderPicker(); return; }
      el.className = 'link ok';
      el.textContent = '🟢 Collegata alla LIVE di MyClass (' + (m.classe || '?') + ')' + (m.student ? ' · alunno selezionato: ' + m.student : ' · seleziona un alunno nella LIVE o qui sotto') + (m.griglia ? '' : ' · ⚠️ nessuna griglia scelta nella LIVE');
      if (m.classe && m.classe !== liveCls) { liveCls = m.classe; if (classes.some(function (c) { return c.nome === liveCls; })) { pick.cls = liveCls; savePick(); } }
      if (m.student !== last) { last = m.student || ''; if (last !== skip) skip = ''; }
      if (m.student && opts.nameId && m.student !== skip) {
        var changed = field(d, opts.nameId, m.student, 'name');
        field(d, opts.classId, m.classe, 'cls');
        if (changed && opts.onStudent) opts.onStudent(m.student, m.classe);
      }
      renderPicker();
    }
    followers.push(function (m) { render(m); });
    function poll() {
      if (!getDoc()) { clearInterval(timer); timer = null; return; }
      hello(render);
    }
    return {
      // da chiamare quando la finestra docente si apre (o si riapre)
      start: function () {
        auto = { name: '', cls: '' }; boundDoc = null; classes = roster();
        var d = getDoc();
        if (d) { bind(d); var el = box(d, 't-live', true); if (el) { el.className = 'link'; el.textContent = '⏳ Cerco la LIVE di MyClass…'; } renderPicker(); }
        if (timer) clearInterval(timer); timer = setInterval(poll, 10000); poll();
      },
      // dopo "Salva e prossimo": il prossimo alunno selezionato nella LIVE può riempire i campi
      // (finché nella LIVE resta selezionato l'alunno appena valutato, i campi restano vuoti)
      reset: function () { auto = { name: '', cls: '' }; skip = last; renderPicker(); poll(); },
      refresh: function () { renderPicker(); }
    };
  }

  window.MyClassLive = { available: !!bc, send: send, select: select, hello: hello, follow: follow, roster: roster };
})();

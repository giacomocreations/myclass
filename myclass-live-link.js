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

  // payload: { grid, scores, student, cls, save, note } · cb(risposta | null se MyClass non risponde)
  function send(payload, cb) {
    cb = cb || function () {};
    if (!bc) { cb({ ok: false, msg: 'questo browser non permette il collegamento' }); return; }
    var reqId = newId();
    var msg = { type: 'scores', reqId: reqId };
    for (var k in payload) msg[k] = payload[k];
    waiting[reqId] = { cb: cb, err: null, t: setTimeout(function () { finish(reqId, null); }, 1500) };
    bc.postMessage(msg);
  }

  // Chiede alla LIVE com'è messa adesso · cb(stato | null se nessuna LIVE risponde)
  function hello(cb) {
    if (!bc) { cb(null); return; }
    var reqId = newId();
    hellos[reqId] = { cb: cb, best: null, t: setTimeout(function () { finishHello(reqId); }, 900) };
    bc.postMessage({ type: 'hello', reqId: reqId });
  }

  // Finestra docente che segue la LIVE: riga di stato sopra i campi nome/classe
  // e (se nameId) nome e classe compilati con l'alunno selezionato nella LIVE.
  // Il nome scritto a mano non viene mai sostituito.
  //   getDoc(): documento della finestra docente, o null se è chiusa
  //   opts: { nameId:'t-name', classId:'t-class', onStudent(nome, classe) }
  function follow(getDoc, opts) {
    opts = opts || {};
    var auto = { name: '', cls: '' }, timer = null, last = '', skip = '';
    function field(d, id, val, key) {
      var el = id && d.getElementById(id);
      if (!el || !val) return false;
      var cur = el.value.trim();
      if (cur && cur !== auto[key]) return false;
      if (cur === val) return false;
      el.value = val; auto[key] = val; return true;
    }
    function render(m) {
      var d = getDoc(); if (!d) return;
      var el = d.getElementById('t-live');
      if (!el) {
        var ref = d.getElementById(opts.nameId || 't-class') || d.getElementById('t-link');
        if (!ref) return;
        ref = ref.closest('.fields') || ref;
        el = d.createElement('div'); el.id = 't-live'; el.className = 'link';
        ref.parentNode.insertBefore(el, ref);
      }
      if (!bc) { el.className = 'link err'; el.textContent = '⚠️ Questo browser non permette il collegamento con MyClass.'; return; }
      if (!m || m.closed) {
        el.className = 'link';
        el.textContent = m && m.closed ? '⚪ LIVE di MyClass chiusa.' : '⚪ Nessuna LIVE di MyClass aperta in questo browser: aprila (stesso browser, anche in un\'altra finestra) per collegarla.';
        return;
      }
      if (m.paused) { el.className = 'link err'; el.textContent = '⚠️ La LIVE è in una scheda di MyClass in pausa (MyClass aperta due volte): chiudi l\'altra scheda o premi "↻ Usa questa scheda" e riapri la LIVE.'; return; }
      el.className = 'link ok';
      el.textContent = '🟢 Collegata alla LIVE di MyClass (' + (m.classe || '?') + ')' + (m.student ? ' · alunno selezionato: ' + m.student : ' · seleziona un alunno nella LIVE') + (m.griglia ? '' : ' · ⚠️ nessuna griglia scelta nella LIVE');
      if (m.student !== last) { last = m.student || ''; if (last !== skip) skip = ''; }
      if (m.student && opts.nameId && m.student !== skip) {
        var changed = field(d, opts.nameId, m.student, 'name');
        field(d, opts.classId, m.classe, 'cls');
        if (changed && opts.onStudent) opts.onStudent(m.student, m.classe);
      }
    }
    followers.push(function (m) { render(m); });
    function poll() {
      if (!getDoc()) { clearInterval(timer); timer = null; return; }
      hello(render);
    }
    return {
      // da chiamare quando la finestra docente si apre (o si riapre)
      start: function () { auto = { name: '', cls: '' }; if (timer) clearInterval(timer); timer = setInterval(poll, 10000); poll(); },
      // dopo "Salva e prossimo": il prossimo alunno selezionato nella LIVE può riempire i campi
      // (finché nella LIVE resta selezionato l'alunno appena valutato, i campi restano vuoti)
      reset: function () { auto = { name: '', cls: '' }; skip = last; poll(); }
    };
  }

  window.MyClassLive = { available: !!bc, send: send, hello: hello, follow: follow };
})();

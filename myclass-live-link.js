// ═══════════════════════════════════════════════════════════════
//  Collegamento con la LIVE di MyClass — punteggi della griglia orale
//  (What Are They Wearing?, Rules & Obligations, …)
//
//  Quando nella finestra docente di un'attività si sceglie un punteggio,
//  la pagina lo manda alla LIVE di MyClass aperta nello stesso browser
//  (stesso sito, giacomocreations.github.io/myclass). MyClass lo mette
//  nella sua griglia per l'alunno e risponde con chi l'ha ricevuto.
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
// ═══════════════════════════════════════════════════════════════
(function () {
  var CHANNEL = 'myclass-live-griglia';
  var bc = null;
  try { bc = new BroadcastChannel(CHANNEL); } catch (e) {}
  var waiting = {};

  // Possono rispondere più schede di MyClass (es. una in pausa): una risposta "ok"
  // vale subito; un errore si tiene solo se entro poco non arriva una risposta ok.
  if (bc) bc.onmessage = function (e) {
    var m = e.data || {};
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

  // payload: { grid, scores, student, cls, save, note } · cb(risposta | null se MyClass non risponde)
  function send(payload, cb) {
    cb = cb || function () {};
    if (!bc) { cb({ ok: false, msg: 'questo browser non permette il collegamento' }); return; }
    var reqId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    var msg = { type: 'scores', reqId: reqId };
    for (var k in payload) msg[k] = payload[k];
    waiting[reqId] = { cb: cb, err: null, t: setTimeout(function () { finish(reqId, null); }, 1500) };
    bc.postMessage(msg);
  }

  window.MyClassLive = { available: !!bc, send: send };
})();

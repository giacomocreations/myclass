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
//                scores:[punteggio|null per area], student, cls }
//  Risposta:   { type:'ack', reqId, ok, msg, student, classe }
// ═══════════════════════════════════════════════════════════════
(function () {
  var CHANNEL = 'myclass-live-griglia';
  var bc = null;
  try { bc = new BroadcastChannel(CHANNEL); } catch (e) {}
  var waiting = {};

  if (bc) bc.onmessage = function (e) {
    var m = e.data || {};
    if (m.type !== 'ack' || !waiting[m.reqId]) return;
    var w = waiting[m.reqId]; delete waiting[m.reqId];
    clearTimeout(w.t); w.cb(m);
  };

  // payload: { grid, scores, student, cls } · cb(risposta | null se MyClass non risponde)
  function send(payload, cb) {
    cb = cb || function () {};
    if (!bc) { cb({ ok: false, msg: 'questo browser non permette il collegamento' }); return; }
    var reqId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    var msg = { type: 'scores', reqId: reqId };
    for (var k in payload) msg[k] = payload[k];
    waiting[reqId] = { cb: cb, t: setTimeout(function () { delete waiting[reqId]; cb(null); }, 1500) };
    bc.postMessage(msg);
  }

  window.MyClassLive = { available: !!bc, send: send };
})();

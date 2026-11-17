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
//  • Registrazione dalla finestra docente: scegliendo l'alunno dall'elenco
//    parte la registrazione qui (non in MyClass); cambiando alunno quella di
//    prima si ferma e si scarica (MP3, come in MyClass), e così con
//    "Salva e prossimo". Alla LIVE si dice norec: lì non parte una seconda
//    registrazione. Se l'alunno si sceglie nella LIVE, registra MyClass come
//    sempre (e qui si ferma quella in corso).
//  • Rivedi / correggi (MyClassLive.review): elenco degli alunni valutati, nota
//    e punteggi correggibili a mano, salvati anche nel promemoria di MyClass.
//  • Rivalutazione: { type:'prom-list', gridId } → MyClass risponde con i
//    promemoria salvati con quella griglia (items); { type:'prom-update',
//    grid, items:[{cls, student, ts, scores}] } li riscrive con i nuovi
//    punteggi (stessa data) e aggiorna la griglia di MyClass.
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
//  Selezione:  { type:'select', reqId, student, cls, norec }  →  'ack' come sopra
//              (+ recMyClass: true se MyClass stava già registrando quell'alunno)
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
  function send(payload, cb) { if (pageRecords && payload.norec === undefined) payload.norec = true; post('scores', payload, cb); }
  // Seleziona l'alunno nella LIVE · cb(risposta | null se la LIVE non è aperta)
  function select(student, cls, cb, norec) { post('select', { student: student, cls: cls, norec: !!norec }, cb); }
  // Richiesta generica (rivalutazione dei promemoria…) · cb(risposta | null)
  function request(type, payload, cb) { post(type, payload || {}, cb); }

  // ── Registrazione dalla finestra docente ──
  // Audio mono a 16 kHz, MP3 a 32 kbps (≈ 240 KB/min) come la LIVE di MyClass; senza encoder MP3
  // (es. offline) si scarica il WAV. Nome del file: Orale_Cognome_Nome_CLASSE_AAAA-MM-GG.mp3
  var REC_KEY = 'myclass_teacher_rec';
  var pageRecords = false;   // questa pagina registra da sé (finestra docente con elenco)
  var rec = { active: false, starting: false, who: '', cls: '', t0: 0, stream: null, ctx: null, src: null, proc: null, pcm: null, err: '' };
  var recListeners = [];
  var recNotify = function () { recListeners.forEach(function (f) { try { f(); } catch (e) {} }); };
  var lamePromise = null;
  function loadLame() {
    if (window.lamejs) return Promise.resolve(window.lamejs);
    if (lamePromise) return lamePromise;
    var urls = ['https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js', 'https://unpkg.com/lamejs@1.2.1/lame.min.js'];
    lamePromise = urls.reduce(function (p, u) {
      return p.catch(function () {
        return new Promise(function (res, rej) {
          var sc = document.createElement('script'); sc.src = u;
          sc.onload = function () { window.lamejs ? res(window.lamejs) : rej(new Error(u)); };
          sc.onerror = function () { sc.remove(); rej(new Error(u)); };
          document.head.appendChild(sc);
        });
      });
    }, Promise.reject(new Error('start'))).catch(function (e) { lamePromise = null; throw e; });
    return lamePromise;
  }
  function encodeMP3(samples, rate) {
    return loadLame().then(function (lame) {
      var enc = new lame.Mp3Encoder(1, rate, 32), BLOCK = 1152, out = [], pcm = new Int16Array(BLOCK);
      for (var i = 0; i < samples.length; i += BLOCK) {
        var len = Math.min(BLOCK, samples.length - i);
        for (var j = 0; j < len; j++) { var v = Math.max(-1, Math.min(1, samples[i + j])); pcm[j] = v < 0 ? v * 0x8000 : v * 0x7FFF; }
        var b = enc.encodeBuffer(len === BLOCK ? pcm : pcm.subarray(0, len));
        if (b.length) out.push(new Uint8Array(b.buffer, b.byteOffset, b.length).slice());
      }
      var end = enc.flush(); if (end.length) out.push(new Uint8Array(end.buffer, end.byteOffset, end.length).slice());
      return new Blob(out, { type: 'audio/mpeg' });
    });
  }
  function encodeWAV(samples, rate) {
    var buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
    var wr = function (o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    wr(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); wr(8, 'WAVE'); wr(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); wr(36, 'data'); v.setUint32(40, samples.length * 2, true);
    for (var i = 0, off = 44; i < samples.length; i++, off += 2) { var s0 = Math.max(-1, Math.min(1, samples[i])); v.setInt16(off, s0 < 0 ? s0 * 0x8000 : s0 * 0x7FFF, true); }
    return new Blob([buf], { type: 'audio/wav' });
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }
  var recEnabled = function () { try { return localStorage.getItem(REC_KEY) !== '0'; } catch (e) { return true; } };
  // Ferma la registrazione; save: scarica il file (se c'è audio)
  function recStop(save) {
    if (!rec.active && !rec.starting) return null;
    rec.starting = false;
    var wasActive = rec.active; rec.active = false;
    try { rec.src && rec.src.disconnect(); } catch (e) {}
    try { rec.proc && rec.proc.disconnect(); } catch (e) {}
    try { rec.stream && rec.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    var chunks = rec.pcm || [], rate = (rec.ctx && rec.ctx.sampleRate) || 16000, who = rec.who, cls = rec.cls, secs = rec.t0 ? Math.round((Date.now() - rec.t0) / 1000) : 0;
    try { rec.ctx && rec.ctx.close(); } catch (e) {}
    rec.stream = rec.ctx = rec.src = rec.proc = rec.pcm = null; rec.who = ''; rec.cls = ''; rec.t0 = 0;
    recNotify();
    if (!wasActive || !save || !chunks.length) return null;
    var tot = chunks.reduce(function (a, c) { return a + c.length; }, 0), merged = new Float32Array(tot), off = 0;
    chunks.forEach(function (c) { merged.set(c, off); off += c.length; });
    var d = new Date(), iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var base = 'Orale_' + String(who).trim().replace(/\s+/g, '_') + (cls ? '_' + String(cls).replace(/\s+/g, '') : '') + '_' + iso;
    encodeMP3(merged, rate).then(function (b) { download(b, base + '.mp3'); }, function () { download(encodeWAV(merged, rate), base + '.wav'); });
    return { who: who, secs: secs, file: base };
  }
  // Avvia la registrazione per un alunno (quella in corso, di un altro alunno, si ferma e si scarica)
  function recStart(who, cls) {
    who = String(who || '').trim(); if (!who) return;
    if ((rec.active || rec.starting) && rec.who === who) return;
    var prev = recStop(true);
    rec.last = prev;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { rec.err = 'questo browser non permette di registrare'; recNotify(); return; }
    rec.starting = true; rec.who = who; rec.cls = cls || ''; rec.err = ''; recNotify();
    var token = rec.tok = (rec.tok || 0) + 1;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (token !== rec.tok || !rec.starting) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      var ctx = new AC({ sampleRate: 16000 }), src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1), pcm = [];
      proc.onaudioprocess = function (e) { if (rec.active && rec.proc === proc) pcm.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(proc); proc.connect(ctx.destination);
      try { ctx.resume(); } catch (e) {}
      rec.stream = stream; rec.ctx = ctx; rec.src = src; rec.proc = proc; rec.pcm = pcm;
      rec.starting = false; rec.active = true; rec.t0 = Date.now(); recNotify();
    }, function (err) {
      if (token !== rec.tok) return;
      rec.starting = false; rec.who = ''; rec.cls = ''; rec.err = 'microfono non disponibile (' + (err && err.name || err) + '): consenti il microfono per questa pagina';
      recNotify();
    });
  }
  // Pagina chiusa o ricaricata durante la registrazione: il browser chiede conferma (l'audio andrebbe perso)
  window.addEventListener('beforeunload', function (e) { if (rec.active) { e.preventDefault(); e.returnValue = ''; } });

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
    var state;   // ultima risposta: undefined = non ancora chiesto, null = MyClass non risponde
    var pick = { cls: '', open: true };
    try { var sv = JSON.parse(localStorage.getItem(PICK_KEY) || '{}'); pick.cls = sv.cls || ''; pick.open = sv.open !== false; } catch (e) {}
    var savePick = function () { try { localStorage.setItem(PICK_KEY, JSON.stringify(pick)); } catch (e) {} };
    var esc = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
    var norm = function (t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
    var classes = [];
    // registrazione dalla finestra docente (non per le coppie: lì registra la LIVE)
    var recordable = opts.record !== undefined ? !!opts.record : !opts.pickTarget;
    if (recordable) pageRecords = recEnabled();
    var recTick = null;

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
        renderRec(); return;
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
        + '<span style="opacity:.7">' + (c ? 'clic sul nome: lo scrive qui e lo seleziona nella LIVE (se è chiusa la apro, con la registrazione)' : '') + '</span></div>'
        + list + '</div>';
      renderRec();
    }
    function fmt(sec) { return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
    // Riga della registrazione sotto l'elenco: stato, ⏹ Stop e salva / ⏺ Registra, scelta automatica
    function renderRec() {
      if (!recordable) return;
      var d = getDoc(); if (!d) return;
      var el = box(d, 't-rec', true); if (!el) return;
      var on = recEnabled(), nameEl = opts.nameId && d.getElementById(opts.nameId), nm = nameEl ? nameEl.value.trim() : '';
      var btn = 'font:inherit;font-size:12.5px;font-weight:700;padding:4px 10px;border-radius:7px;cursor:pointer;border:1px solid rgba(127,127,127,.35);';
      var st;
      if (rec.active) st = '<span style="display:inline-flex;align-items:center;gap:6px;color:#ff6b81;font-weight:800"><span style="width:9px;height:9px;border-radius:50%;background:#ff3b5c;display:inline-block"></span>REC · ' + esc(rec.who) + ' <span data-rec-time>' + fmt(Math.round((Date.now() - rec.t0) / 1000)) + '</span></span>'
        + '<button data-rec="stop" style="' + btn + 'background:#ff3b5c;color:#fff;border-color:transparent">⏹ Stop e salva</button>';
      else if (rec.starting) st = '<span style="opacity:.8">⏳ Avvio la registrazione per ' + esc(rec.who) + '… (se il browser chiede il microfono, consenti)</span>';
      else st = '<span style="opacity:.75">🎙️ Nessuna registrazione in corso</span>' + (nm ? '<button data-rec="start" style="' + btn + 'background:transparent;color:inherit">⏺ Registra ' + esc(nm) + '</button>' : '');
      var last = rec.last ? '<div style="font-size:12px;opacity:.75;margin-top:4px">💾 Scaricata la registrazione di ' + esc(rec.last.who) + ' (' + fmt(rec.last.secs) + ')</div>' : '';
      var err = rec.err ? '<div style="font-size:12px;color:#ffb547;margin-top:4px">⚠️ ' + esc(rec.err) + '</div>' : '';
      el.innerHTML = '<div style="margin:0 0 10px;padding:7px 10px;border:1px solid ' + (rec.active ? 'rgba(255,59,92,.6)' : 'rgba(127,127,127,.3)') + ';border-radius:10px">'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px">' + st
        + '<label style="margin-left:auto;display:inline-flex;gap:5px;align-items:center;opacity:.8;cursor:pointer" title="Scegliendo l\'alunno dall\'elenco parte la registrazione qui; cambiando alunno o con Salva e prossimo si ferma e si scarica il file. Se scegli l\'alunno nella LIVE di MyClass, registra MyClass."><input type="checkbox" data-rec="auto"' + (on ? ' checked' : '') + '> registra quando scelgo l\'alunno</label></div>'
        + last + err + '</div>';
      clearInterval(recTick); recTick = null;
      if (rec.active) recTick = setInterval(function () {
        var dd = getDoc(), t = dd && dd.querySelector('[data-rec-time]');
        if (!t || !rec.active) { clearInterval(recTick); recTick = null; return; }
        t.textContent = fmt(Math.round((Date.now() - rec.t0) / 1000));
      }, 1000);
    }
    if (recordable) recListeners.push(renderRec);
    var sameName = function (a, b) {
      var wa = norm(a).split(' ').filter(Boolean), wb = norm(b).split(' ').filter(Boolean);
      if (!wa.length || !wb.length) return false;
      var small = wa.length <= wb.length ? wa : wb, big = small === wa ? wb : wa;
      return small.every(function (x) { return big.indexOf(x) >= 0; });
    };
    function choose(d, name) {
      var target = opts.pickTarget ? opts.pickTarget(name) : opts.nameId;
      var el = target && d.getElementById(target);
      if (el) { el.value = name; if (target === opts.nameId) auto.name = name; fire(el); }
      var ce = opts.classId && d.getElementById(opts.classId);
      if (ce && pick.cls && ce.value.trim() !== pick.cls) { ce.value = pick.cls; auto.cls = pick.cls; fire(ce); }
      skip = '';
      var recNow = recordable && recEnabled();
      if (recNow) recStart(name, pick.cls || (ce && ce.value.trim()) || '');
      renderPicker();
      var st = d.getElementById('t-live');
      // MyClass non è aperta in questo browser: la apro io, con la LIVE e la registrazione per questo alunno
      if (state === null && pick.cls && opts.openMyClass !== false) {
        var url = new URL('MyClass_Analytics_v5.html', location.href);
        url.searchParams.set('apriLive', pick.cls); url.searchParams.set('alunno', name);
        if (recNow) url.searchParams.set('norec', '1');
        var w = null; try { w = d.defaultView.open(url.href, 'myclass_main'); } catch (e) {}
        if (st) { st.className = w ? 'link ok' : 'link err'; st.textContent = w ? '🚀 Apro MyClass con la LIVE della ' + pick.cls + (recNow ? ' (la registrazione di ' + name + ' è qui)…' : ' e la registrazione per ' + name + '… (se chiede il microfono, consenti)') : '⚠️ Il browser ha bloccato l\'apertura di MyClass: consenti i pop-up per questa pagina e riprova.'; }
        state = undefined;
        return;
      }
      select(name, pick.cls, function (r) {
        // MyClass stava già registrando questo alunno (scelto prima nella LIVE): tiene la sua, qui niente doppione
        if (r && r.recMyClass && rec.who === name) { recStop(false); rec.err = ''; rec.last = null; renderRec(); }
        st = d.getElementById('t-live'); if (!st || !getDoc()) return;
        if (!r) { state = null; st.className = 'link'; st.textContent = '⚪ MyClass non risponde: ' + name + ' scelto solo qui. Clicca di nuovo sul nome per aprire MyClass con la LIVE.'; }
        else if (!r.ok) { st.className = 'link err'; st.textContent = '⚠️ MyClass: ' + r.msg; }
        else if (r.opening) { st.className = 'link ok'; st.textContent = '🚀 Apro la LIVE della ' + (r.classe || pick.cls) + (recNow ? '… (la registrazione di ' + name + ' è qui)' : ' e la registrazione per ' + name + '…'); }
      }, recNow);
    }
    function bind(d) {
      if (boundDoc === d) return; boundDoc = d;
      d.addEventListener('click', function (e) {
        var rb = e.target.closest && e.target.closest('[data-rec="stop"],[data-rec="start"]');
        if (rb) {
          if (rb.getAttribute('data-rec') === 'stop') rec.last = recStop(true);
          else { var ne = d.getElementById(opts.nameId), cl = opts.classId && d.getElementById(opts.classId); recStart(ne ? ne.value : '', (cl && cl.value.trim()) || pick.cls); }
          renderRec(); return;
        }
        var b = e.target.closest && e.target.closest('[data-pick-st],[data-pick-toggle]'); if (!b) return;
        if (b.hasAttribute('data-pick-toggle')) { pick.open = !pick.open; savePick(); renderPicker(); return; }
        choose(d, b.getAttribute('data-pick-st'));
      });
      d.addEventListener('change', function (e) {
        if (e.target.hasAttribute && e.target.hasAttribute('data-pick-cls')) { pick.cls = e.target.value; pick.open = true; savePick(); renderPicker(); }
        if (e.target.getAttribute && e.target.getAttribute('data-rec') === 'auto') { try { localStorage.setItem(REC_KEY, e.target.checked ? '1' : '0'); } catch (x) {} pageRecords = e.target.checked; renderRec(); }
      });
      d.addEventListener('input', function (e) { if (/^t-name/.test(e.target.id || '')) { clearTimeout(bind.t); bind.t = setTimeout(renderPicker, 300); } });
    }
    function render(m) {
      if (m !== undefined) state = m;
      var d = getDoc(); if (!d) return;
      bind(d);
      var el = box(d, 't-live', true); if (!el) return;
      el.className = 'link';
      if (!bc) { el.className = 'link err'; el.textContent = '⚠️ Questo browser non permette il collegamento con MyClass.'; renderPicker(); return; }
      if (!m || m.closed) {
        el.textContent = m && m.closed
          ? '⚪ LIVE di MyClass chiusa: scegli l\'alunno qui sotto e la apro io, con la registrazione.'
          : m === null ? '⚪ MyClass non è aperta in questo browser: scegli l\'alunno qui sotto e la apro io, con la LIVE e la registrazione.'
          : '⚪ Nessuna LIVE di MyClass aperta: scegli l\'alunno qui sotto.';
        renderPicker(); return;
      }
      if (m.paused) { el.className = 'link err'; el.textContent = '⚠️ La LIVE è in una scheda di MyClass in pausa (MyClass aperta due volte): chiudi l\'altra scheda o premi "↻ Usa questa scheda" e riapri la LIVE.'; renderPicker(); return; }
      el.className = 'link ok';
      el.textContent = '🟢 Collegata alla LIVE di MyClass (' + (m.classe || '?') + ')' + (m.student ? ' · alunno selezionato: ' + m.student : ' · seleziona un alunno nella LIVE o qui sotto') + (m.griglia ? '' : ' · ⚠️ nessuna griglia scelta nella LIVE');
      if (m.classe && m.classe !== liveCls) { liveCls = m.classe; if (classes.some(function (c) { return c.nome === liveCls; })) { pick.cls = liveCls; savePick(); } }
      if (m.student !== last) { last = m.student || ''; if (last !== skip) skip = ''; }
      // Nella LIVE è stato scelto un altro alunno (registra MyClass): qui si ferma e si scarica quella in corso
      if (rec.active && m.student && !sameName(m.student, rec.who) && Date.now() - rec.t0 > 3000) { rec.last = recStop(true); renderRec(); }
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
      reset: function () { if (recordable && (rec.active || rec.starting)) rec.last = recStop(true); auto = { name: '', cls: '' }; skip = last; renderPicker(); poll(); },
      refresh: function () { renderPicker(); }
    };
  }

  // ── Rivedi / correggi le valutazioni salvate (finestra docente) ──
  // Elenca i promemoria di MyClass con questa griglia (LIVE aperta o no) e i voti salvati nella pagina;
  // per ogni alunno (✏️) si corregge la nota e si cambiano a mano i punteggi; «Salva» riscrive il
  // promemoria con la stessa data (il voto di prima resta annotato) e il voto salvato qui.
  //   opts: { getDoc(), boxId:'t-riv', grid:{id, aree:[{nome,max,descrittori}], conversione_voto},
  //           loadGrades(), storeGrades(g), voto(tot) → testo, onLocalSaved() }
  //   voti salvati qui: { name, cls, date 'g/m/aaaa', det 'a-b-c', voto, punti, note }
  function review(opts) {
    var items = [], msg = '', boundDoc = null;
    var esc = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var norm = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
    var same = function (a, b) { var wa = norm(a).split(' ').filter(Boolean), wb = norm(b).split(' ').filter(Boolean); if (!wa.length || !wb.length) return false; var sm = wa.length <= wb.length ? wa : wb, bg = sm === wa ? wb : wa; return sm.every(function (x) { return bg.indexOf(x) >= 0; }); };
    var isoFromIt = function (d) { var m = String(d || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : String(d || ''); };
    var itFromIso = function (d) { var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? +m[3] + '/' + +m[2] + '/' + m[1] : String(d || ''); };
    var aree = function () { return opts.grid.aree; };
    var sum = function (a) { return a.reduce(function (t, v) { return t + (+v || 0); }, 0); };
    var max = function () { return sum(aree().map(function (a) { return a.max; })); };
    var votoTxt = function (a) { return opts.voto ? opts.voto(sum(a)) : String(sum(a)); };
    var doc = function () { return opts.getDoc(); };
    var box = function () { var d = doc(); return d && d.getElementById(opts.boxId || 't-riv'); };
    var wrap = function (h) { return '<div style="background:rgba(127,127,127,.08);border:1px solid rgba(62,198,255,.45);border-radius:12px;padding:10px 12px;margin-top:10px">' + h + '</div>'; };
    var td = 'style="text-align:left;padding:5px;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top"';
    function bind() {
      var d = doc(); if (!d || boundDoc === d) return; boundDoc = d;
      d.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-rv]'); if (!b) return;
        var act = b.getAttribute('data-rv'), k = +b.getAttribute('data-k'), it = items[k];
        if (act === 'open') open();
        else if (act === 'close') { items = []; var x = box(); if (x) x.innerHTML = ''; }
        else if (act === 'edit') { it.open = !it.open; render(); }
        else if (act === 'pt') { it.neu[+b.getAttribute('data-j')] = +b.getAttribute('data-v'); it.sel = true; refresh(k); }
        else if (act === 'undo') { it.note = it.note0; it.neu = it.old.slice(); render(); }
        else if (act === 'rep') {
          var f = d.querySelector('[data-rvfrom="' + k + '"]').value, t = d.querySelector('[data-rvto="' + k + '"]').value;
          if (f) { it.note = it.note.split(f).join(t); it.sel = true; render(); }
        }
        else if (act === 'all' || act === 'none') { items.forEach(function (x) { x.sel = act === 'all'; }); render(); }
        else if (act === 'apply') apply();
      });
      d.addEventListener('input', function (e) {
        var t = e.target; if (!t.getAttribute) return;
        var nk = t.getAttribute('data-rvnote'); if (nk !== null && items[+nk]) { items[+nk].note = t.value; items[+nk].sel = true; refresh(+nk); }
        var sk = t.getAttribute('data-rvsel'); if (sk !== null && items[+sk]) items[+sk].sel = t.checked;
      });
    }
    function open() {
      bind();
      var x = box(); if (!x) return;
      x.innerHTML = wrap('⏳ Cerco in MyClass i promemoria di questa attività…');
      var local = (opts.loadGrades() || []).map(function (g, i) { return { g: g, i: i }; }).filter(function (o) { return String(o.g.det).split('-').length === aree().length; });
      var build = function (r) {
        items = [];
        if (r && r.ok && Array.isArray(r.items)) r.items.forEach(function (p) {
          if ((p.punteggi || []).length !== aree().length) return;
          var old = aree().map(function (a, k) { var q = p.punteggi.find(function (z) { return norm(z.nome) === norm(a.nome); }) || p.punteggi[k]; return +q.voto || 0; });
          var li = local.find(function (o) { return !o.used && isoFromIt(o.g.date) === p.data && same(o.g.name, p.student); });
          if (li) li.used = true;
          items.push({ src: 'mc', cls: p.cls, student: p.student, data: p.data, ts: p.ts, old: old, note: p.nota || (li ? li.g.note : '') || '', li: li ? li.i : -1, riv: p.rivalutato });
        });
        local.filter(function (o) { return !o.used; }).forEach(function (o) { items.push({ src: 'local', cls: o.g.cls, student: o.g.name, data: isoFromIt(o.g.date), old: String(o.g.det).split('-').map(Number), note: o.g.note || '', li: o.i, riv: o.g.riv }); });
        items.forEach(function (it) { it.neu = it.old.slice(); it.note0 = it.note; it.sel = false; it.open = false; });
        items.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)) || String(a.cls).localeCompare(String(b.cls)) || String(a.student).localeCompare(String(b.student)); });
        msg = !r ? '⚪ MyClass non risponde (aprila in questo browser per correggere anche i promemoria): qui ci sono solo i voti salvati su questa pagina.'
          : !r.ok ? '⚠️ MyClass: ' + esc(r.msg || 'errore') + ' — qui ci sono solo i voti salvati su questa pagina.'
          : '🔗 MyClass: ' + items.filter(function (x) { return x.src === 'mc'; }).length + ' promemoria di questa attività.';
        render();
      };
      request('prom-list', { gridId: opts.grid.id }, build);
    }
    function changed(it) { return it.neu.join('-') !== it.old.join('-') || it.note !== it.note0; }
    function scores(it, k) {
      return aree().map(function (a, j) {
        var pts = []; for (var v = a.max; v >= 0; v--) pts.push(v);
        var dsc = function (v) { var d = (a.descrittori || []).find(function (x) { return +x.pt === v; }); return d ? d.testo : ''; };
        return '<div class="r" style="margin-top:6px"><div class="rh"><div class="rn">' + esc(a.nome) + ' <small>/ ' + a.max + ' · allora ' + it.old[j] + '</small></div><div class="pts">'
          + pts.map(function (v) { return '<button class="' + (it.neu[j] === v ? 'on' : '') + '" data-rv="pt" data-k="' + k + '" data-j="' + j + '" data-v="' + v + '" title="' + esc(dsc(v)) + '">' + v + '</button>'; }).join('') + '</div></div></div>';
      }).join('') + '<div class="tot" style="margin-top:8px"><span class="v">' + esc(votoTxt(it.neu)) + '</span><span class="p">' + sum(it.neu) + ' / ' + max() + ' punti · prima ' + esc(votoTxt(it.old)) + ' (' + sum(it.old) + ')</span></div>';
    }
    function row(it, k) {
      var ch = changed(it);
      var h = '<tr><td ' + td + '><input type="checkbox" data-rvsel="' + k + '"' + (it.sel ? ' checked' : '') + '></td><td ' + td + '>' + esc(itFromIso(it.data)) + '</td><td ' + td + '>' + esc(it.cls) + '</td><td ' + td + '>' + esc(it.student) + (it.src === 'local' ? '<br><small>solo qui</small>' : '') + (it.riv ? '<br><small>♻️ già rivisto</small>' : '') + '</td>'
        + '<td ' + td + '>' + esc(votoTxt(it.old)) + ' <small>(' + it.old.join('-') + ')</small></td>'
        + '<td ' + td + ' id="rv-nv-' + k + '"><b style="color:' + (ch ? '#ffb547' : 'inherit') + '">' + esc(votoTxt(it.neu)) + '</b> <small>(' + it.neu.join('-') + ')' + (it.note !== it.note0 ? '<br>nota corretta' : '') + '</small></td>'
        + '<td ' + td + '><button data-rv="edit" data-k="' + k + '" title="Rivedi questo alunno: nota e punteggi">' + (it.open ? '▴' : '✏️') + '</button></td></tr>';
      if (it.open) h += '<tr><td colspan="7" ' + td + '><div style="padding:4px 0 8px">'
        + '<div style="font-size:12px;opacity:.8;margin-bottom:4px">🗒️ Nota: correggi pure il testo' + (changed(it) ? ' · <button data-rv="undo" data-k="' + k + '" style="padding:2px 8px;font-size:12px">↺ com\'era</button>' : '') + '</div>'
        + '<textarea data-rvnote="' + k + '" rows="4" style="width:100%;box-sizing:border-box;font:inherit;font-size:13px;padding:7px 9px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.25);color:inherit">' + esc(it.note) + '</textarea>'
        + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0;font-size:12.5px">Sostituisci <input data-rvfrom="' + k + '" placeholder="testo sbagliato" style="flex:1;min-width:120px;font:inherit;font-size:12.5px;padding:4px 7px"> con <input data-rvto="' + k + '" placeholder="testo giusto" style="flex:1;min-width:120px;font:inherit;font-size:12.5px;padding:4px 7px"><button data-rv="rep" data-k="' + k + '" style="padding:4px 10px;font-size:12.5px">Sostituisci</button></div>'
        + '<div id="rv-sc-' + k + '">' + scores(it, k) + '</div></div></td></tr>';
      return h;
    }
    function render() {
      var x = box(); if (!x) return;
      if (!items.length) { x.innerHTML = wrap(msg + '<br>Nessuna valutazione di questa attività da rivedere.<div class="bar" style="margin-top:8px"><button data-rv="close">Chiudi</button></div>'); return; }
      x.innerHTML = wrap('<b>♻️ Rivedi / correggi le valutazioni</b><div style="font-size:12.5px;opacity:.8;margin:4px 0">' + msg + ' Con ✏️ apri un alunno: correggi la nota e cambi i punteggi. Si salvano solo le righe spuntate (si spuntano da sole quando modifichi).</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px"><tr><th ' + td + '></th><th ' + td + '>Data</th><th ' + td + '>Cl.</th><th ' + td + '>Studente</th><th ' + td + '>Allora</th><th ' + td + '>Ora</th><th ' + td + '></th></tr>' + items.map(row).join('') + '</table>'
        + '<div class="bar" style="margin-top:8px"><button class="pri" data-rv="apply">✅ Salva le righe spuntate</button><button data-rv="all">tutte</button><button data-rv="none">nessuna</button><button data-rv="close">Chiudi</button></div>');
    }
    function refresh(k) {
      var d = doc(), it = items[k]; if (!d || !it) return;
      var sc = d.getElementById('rv-sc-' + k); if (sc) sc.innerHTML = scores(it, k);
      var nv = d.getElementById('rv-nv-' + k); if (nv) nv.innerHTML = '<b style="color:#ffb547">' + esc(votoTxt(it.neu)) + '</b> <small>(' + it.neu.join('-') + ')' + (it.note !== it.note0 ? '<br>nota corretta' : '') + '</small>';
      var cb = d.querySelector('[data-rvsel="' + k + '"]'); if (cb) cb.checked = true;
    }
    function apply() {
      var sel = items.filter(function (it) { return it.sel; });
      var x = box(); if (!x) return;
      if (!sel.length) { x.querySelector('[data-rv="apply"]').textContent = '✅ Salva (nessuna riga spuntata)'; return; }
      var today = new Date().toLocaleDateString('it-IT'), g = opts.loadGrades() || [];
      sel.forEach(function (it) {
        var y = it.li >= 0 && g[it.li]; if (!y) return;
        if (!y.prima) y.prima = y.voto + ' (' + y.det + ')';
        y.det = it.neu.join('-'); y.punti = sum(it.neu); y.voto = votoTxt(it.neu); y.note = it.note; y.riv = today;
      });
      opts.storeGrades(g); if (opts.onLocalSaved) opts.onLocalSaved();
      var mc = sel.filter(function (it) { return it.src === 'mc'; }), nLoc = sel.filter(function (it) { return it.li >= 0; }).length;
      var done = function (r) {
        var b2 = box(); if (!b2) return;
        b2.innerHTML = wrap((mc.length ? (r && r.ok ? '💾 MyClass: ' + r.n + ' promemoria aggiornati (stessa data; il voto di prima resta annotato)' + (r.miss && r.miss.length ? ' · ⚠️ non trovati: ' + esc(r.miss.join(', ')) : '') + '.' : '⚠️ MyClass non ha aggiornato i promemoria' + (r && r.msg ? ': ' + esc(r.msg) : ' (non risponde)') + '. Riprova con MyClass aperta in questo browser.') : '')
          + (nLoc ? '<br>✅ ' + nLoc + ' voti aggiornati anche nell\'elenco qui sotto.' : '') + '<div class="bar" style="margin-top:8px"><button data-rv="open">♻️ Riapri l\'elenco</button><button data-rv="close">Chiudi</button></div>');
      };
      if (mc.length) request('prom-update', { grid: { id: opts.grid.id, nome: opts.grid.nome, aree: aree().map(function (a) { return { nome: a.nome, max: a.max }; }), conversione_voto: opts.grid.conversione_voto },
        items: mc.map(function (it) { return { cls: it.cls, student: it.student, ts: it.ts, scores: it.neu, nota: it.note }; }) }, done);
      else done(null);
    }
    return { open: open, bind: bind };
  }

  window.MyClassLive = { available: !!bc, send: send, select: select, hello: hello, request: request, follow: follow, roster: roster, review: review,
    rec: { start: recStart, stop: recStop, state: function () { return { active: rec.active, starting: rec.starting, who: rec.who }; } } };
})();

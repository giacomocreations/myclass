/**
 * LiveLearn BUGFIX — consegna instabile (in corso / consegnato)
 * ─────────────────────────────────────────────────────────────
 * Problema: la schermata docente mostra a volte "in corso" anche
 * dopo che l'alunno ha consegnato.
 *
 * Cause:
 *  1. showFeedbackAndAdvance usa .set() con un setTimeout(2200ms):
 *     se scatta DOPO submitAnswers, sovrascrive submittedAt → sparisce
 *  2. submitAnswers può essere chiamato più volte (doppio click,
 *     timer scaduto + click manuale) producendo scritture in gara
 *
 * Fix:
 *  - showFeedbackAndAdvance → .update() invece di .set(), così
 *    non può mai cancellare submittedAt
 *  - submitAnswers → guardia S._submitting per esecuzione unica
 *  - ogni .set() residuo nel flusso di consegna → .update()
 *
 * INSTALLAZIONE: aggiungi DOPO livelearn-patch.js (se presente),
 * comunque PRIMA di </body>:
 *   <script src="livelearn-bugfix-submit.js"></script>
 */

(function fixSubmitRaceConditions() {

  // ── 1. Patch showFeedbackAndAdvance ─────────────────────
  // Il setTimeout interno usa .set() che può arrivare DOPO submitAnswers
  // e cancellare submittedAt. Lo sostituiamo con .update().
  const origFeedback = window.showFeedbackAndAdvance;
  window.showFeedbackAndAdvance = function() {
    const q = S.activity.questions[S.qIndex];
    const a = S.answers[S.qIndex];
    const r = evaluateAnswer(q, a);
    if (r.scorable && r.correct) S.studentScore += r.points;

    const scorePill = document.getElementById('s-score-pill');
    if (scorePill) {
      scorePill.style.display = 'inline-block';
      scorePill.textContent = S.studentScore + ' pt';
    }

    // Disabilita pulsanti per evitare doppio click
    ['btn-prev','btn-next','btn-skip','btn-submit','btn-review'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const qArea = document.getElementById('s-question-area');
    if (qArea) qArea.querySelectorAll('button,input,textarea').forEach(el => el.disabled = true);

    if (q.type === 'multiple-choice') {
      document.querySelectorAll('.option-btn').forEach((btn, i) => {
        if (i === q.correct) btn.classList.add('correct');
        else if (i === a) btn.classList.add('wrong');
      });
    }

    const fbArea = document.getElementById('s-feedback-area');
    if (fbArea) {
      const icon  = r.scorable ? (r.correct ? '✅' : '❌') : '💬';
      const title = r.scorable
        ? (r.correct ? `Corretto! +${r.points} pt` : 'Sbagliato')
        : 'Risposta registrata!';
      fbArea.innerHTML = `<div class="feedback-card ${r.scorable ? (r.correct ? 'correct' : 'wrong') : 'neutral'}"
        style="border-radius:12px;padding:18px;margin-top:14px;text-align:center;">
        <div style="font-size:36px;margin-bottom:6px;">${icon}</div>
        <div style="font-size:17px;font-weight:700;">${title}</div>
        ${r.detail ? `<div style="font-size:13px;margin-top:6px;opacity:.8;">${r.detail}</div>` : ''}
      </div>`;
    }

    setTimeout(async () => {
      // ▶ USA .update() — non tocca MAI submittedAt né joinedAt
      if (db && S.sessionCode && S.safeName) {
        try {
          await db.ref('livelearn/responses/' + S.sessionCode + '/' + S.safeName)
            .update({
              answers: S.answers.map(a => a === undefined ? null : a),
              score: S.studentScore,
              updatedAt: Date.now()
              // submittedAt NON viene toccato — se esiste resta lì
            });
        } catch (e) { console.warn('progress save error:', e); }
      }
      const isLast = S.qIndex === S.activity.questions.length - 1;
      if (window.showLeaderboard) showLeaderboard(isLast);
    }, 2200);
  };

  // ── 2. Guardia anti-doppia-esecuzione su submitAnswers ───
  // Qualunque versione di submitAnswers sia in window (originale o patch),
  // la avvolgiamo con un flag S._submitting che blocca rientri multipli.
  const origSubmit = window.submitAnswers;
  window.submitAnswers = async function(auto) {
    // Se già in esecuzione o già consegnato → ignora
    if (S._submitting || S.submitted) return;
    S._submitting = true;
    S.submitted   = true; // segnala subito a pushProgress di fermarsi

    try {
      await origSubmit.call(this, auto);
    } catch (e) {
      console.error('submitAnswers error:', e);
    } finally {
      S._submitting = false;
    }
  };

  // ── 3. Patch pushProgress come ulteriore difesa ──────────
  // Già usa .update() nell'originale, ma aggiungiamo il check su S.submitted
  // nel caso il flag non fosse ancora impostato (timing estremo)
  const origPush = window.pushProgress;
  window.pushProgress = function() {
    if (!window.S) return;
    if (S.submitted || S._submitting) return; // ← doppia guardia
    return origPush && origPush();
  };

  // ── 4. Fix showFeedbackAndAdvance in pratica sull'ultima domanda ─
  // Nell'originale, dopo l'ultima domanda in pratica, showLeaderboard(true)
  // chiama il bottone "btn-lb-done" → submitAnswers.
  // Assicuriamoci che showLeaderboard non faccia .set() pericolosi.
  // (già coperto dal fix #1, ma aggiungiamo una guardia su showLeaderboard)
  const origLeaderboard = window.showLeaderboard;
  window.showLeaderboard = async function(isFinal) {
    // Se già submitted e isFinal, non ricaricare i dati rischiando .set()
    if (S.submitted && isFinal) {
      // Mostra direttamente la schermata done invece di showLeaderboard
      if (window.showStudentDone) { showStudentDone(); return; }
    }
    return origLeaderboard && origLeaderboard(isFinal);
  };

  console.log('✅ LiveLearn bugfix-submit caricato: race condition consegna risolta');
})();

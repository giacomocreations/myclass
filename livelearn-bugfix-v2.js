/**
 * LiveLearn BUGFIX v2 — fix chirurgico consegna instabile
 * ─────────────────────────────────────────────────────────
 * RIMUOVI livelearn-bugfix-submit.js se presente.
 * Usa solo questo file.
 *
 * Fix unico e mirato: showFeedbackAndAdvance usa .set() con un
 * setTimeout(2200ms). Se questo .set() arriva su Firebase DOPO
 * submitAnswers, sovrascrive il nodo cancellando submittedAt →
 * il docente vede "in corso".
 * Soluzione: sostituire quel singolo .set() con .update().
 * Nient'altro viene toccato.
 */
(function fixFeedbackSet() {
  // Aspetta che il DOM/script originale sia pronto
  function applyPatch() {
    const orig = window.showFeedbackAndAdvance;
    if (!orig) { setTimeout(applyPatch, 100); return; }

    window.showFeedbackAndAdvance = function() {
      const q = S.activity.questions[S.qIndex];
      const a = S.answers[S.qIndex];
      const r = evaluateAnswer(q, a);
      if (r.scorable && r.correct) S.studentScore += r.points;

      const scorePill = document.getElementById('s-score-pill');
      if (scorePill) { scorePill.style.display = 'inline-block'; scorePill.textContent = S.studentScore + ' pt'; }

      ['btn-prev','btn-next','btn-skip','btn-submit','btn-review'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
      });
      document.getElementById('s-question-area')?.querySelectorAll('button,input,textarea').forEach(el => el.disabled = true);

      if (q.type === 'multiple-choice') {
        document.querySelectorAll('.option-btn').forEach((btn, i) => {
          if (i === q.correct) btn.classList.add('correct');
          else if (i === a) btn.classList.add('wrong');
        });
      }

      const fbArea = document.getElementById('s-feedback-area');
      if (fbArea) {
        const icon  = r.scorable ? (r.correct ? '✅' : '❌') : '💬';
        const title = r.scorable ? (r.correct ? `Corretto! +${r.points} pt` : 'Sbagliato') : 'Risposta registrata!';
        fbArea.innerHTML = `<div class="feedback-card ${r.scorable ? (r.correct ? 'correct' : 'wrong') : 'neutral'}"
          style="border-radius:12px;padding:18px;margin-top:14px;text-align:center;">
          <div style="font-size:36px;margin-bottom:6px;">${icon}</div>
          <div style="font-size:17px;font-weight:700;">${title}</div>
          ${r.detail ? `<div style="font-size:13px;margin-top:6px;opacity:.8;">${r.detail}</div>` : ''}
        </div>`;
      }

      setTimeout(async () => {
        // ✅ .update() invece di .set() — non tocca MAI submittedAt
        if (db && S.sessionCode && S.safeName) {
          try {
            await db.ref('livelearn/responses/' + S.sessionCode + '/' + S.safeName)
              .update({
                answers: S.answers.map(a => a === undefined ? null : a),
                score: S.studentScore,
                updatedAt: Date.now()
              });
          } catch(e) { console.warn('progress save error:', e); }
        }
        const isLast = S.qIndex === S.activity.questions.length - 1;
        showLeaderboard(isLast);
      }, 2200);
    };

    console.log('✅ LiveLearn bugfix-v2: showFeedbackAndAdvance patchato (.set→.update)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPatch);
  } else {
    applyPatch();
  }
})();

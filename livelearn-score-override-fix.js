/**
 * LiveLearn — score-override-fix.js
 * ─────────────────────────────────────────────────────────────
 * Carica DOPO livelearn-patch.js e livelearn-bugfix-v2.js
 *
 * Corregge:
 *  1. Bottone "Esporta PDF" non visibile
 *  2. Pannello modifica punteggi senza campi input
 *
 * Causa: il vecchio _injectScoreOverrideUI usava setTimeout(100) +
 *  guard "if (!cards.length) return" che faceva uscire troppo presto,
 *  e appendeva il pannello DOPO il bottone esporta senza garantirne
 *  la presenza.
 *
 * Soluzione: riscrive completamente renderStudentResultsTeacher
 * includendo export + override panel direttamente nell'HTML,
 * senza setTimeout e senza dipendenze dal DOM esistente.
 */

(function fixTeacherResultsView() {

  function waitAndPatch() {
    // Aspetta che renderStudentResultsTeacher e renderAnswerCard siano definiti
    if (!window.renderStudentResultsTeacher || !window.renderAnswerCard) {
      setTimeout(waitAndPatch, 150);
      return;
    }

    // Salva la versione attuale (già patchata da livelearn-patch.js)
    const _prev = window.renderStudentResultsTeacher;

    window.renderStudentResultsTeacher = function(name, response) {
      const questions  = window.S?.liveActivity?.questions || [];
      const answers    = response.answers    || [];
      const submitted  = response.submittedAt;
      const score      = response.score      || 0;
      const displayName = response.name || name;
      const questionTimes = response.questionTimes || [];
      const joinedAt   = response.joinedAt;
      const overrides  = response.scoreOverrides || {};
      const aiGrades   = response.aiGrades   || {};
      const safeName   = (response.name || name).replace(/[.#$\[\]/]/g, '_');

      const main = document.getElementById('live-main-content');
      if (!main) return;

      if (!questions.length) {
        main.innerHTML = `<div class="empty-state"><div class="es-icon">📡</div><p>In attesa di dati attività…</p></div>`;
        return;
      }

      const answeredCount = answers.filter(a => a !== undefined && a !== null).length;
      const totalPts = questions.reduce((s, q) => s + (q.points || 10), 0);
      const totalTime = (submitted && joinedAt) ? Math.round((submitted - joinedAt) / 1000) : null;
      const fmtSecs = s => s == null ? '—' : s >= 60 ? Math.floor(s / 60) + 'm ' + (s % 60) + 's' : s + 's';

      const statusBadge = submitted
        ? `<span class="badge badge-green">✓ Consegnato ${new Date(submitted).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>`
        : `<span class="badge badge-amber">⏳ In corso…</span>`;

      // ── Header con EXPORT sempre visibile se consegnato ──
      let headerHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <div class="flex-center gap-12" style="flex-wrap:wrap;">
            <h2 style="font-size:20px;font-weight:700;">${esc(displayName)}</h2>
            ${statusBadge}
            <span class="badge badge-blue">${answeredCount}/${questions.length} risposte</span>
            ${score ? `<span class="badge badge-blue">⭐ ${score} pt</span>` : ''}
            ${totalTime != null ? `<span class="badge badge-gray">⏱ ${fmtSecs(totalTime)} totali</span>` : ''}
          </div>
          ${submitted ? `<button class="btn btn-sm btn-primary" onclick="exportStudentPDF('${esc(displayName)}')">⬇ Esporta PDF</button>` : ''}
        </div>`;

      // ── Answer cards ──
      const cardsHtml = questions.map((q, i) =>
        window.renderAnswerCard(q, i, answers[i], questionTimes[i])
      ).join('');

      // ── Pannello modifica punteggi (sempre visibile se consegnato) ──
      let overridePanel = '';
      if (submitted) {
        let gridHtml = '';
        questions.forEach((q, i) => {
          const pts       = q.points || 10;
          const a         = answers[i];
          const r         = window.evaluateAnswer ? evaluateAnswer(q, a) : { scorable: false, correct: false, points: 0 };
          const isOpen    = q.type === 'free-response';
          const aiScore   = aiGrades[i]?.score;
          const overrideVal = overrides[i] != null
            ? overrides[i]
            : (isOpen && aiScore != null ? aiScore : (r.scorable ? (r.correct ? pts : 0) : null));

          const bgColor  = isOpen ? '#fdf6e3' : 'var(--surface2)';
          const aiLabel  = isOpen && aiScore != null
            ? `<span style="font-size:10px;color:var(--primary);margin-right:4px;">🤖 AI: ${aiScore}/${pts}</span>`
            : '';
          const overrideBorder = overrides[i] != null ? 'border-color:var(--primary);' : '';
          const qPreviewText = (q.text || q.question?.text || '').substring(0, 45);

          gridHtml += `
            <div style="background:${bgColor};border-radius:10px;padding:10px 12px;border:1px solid var(--border);">
              <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px;">
                ${isOpen ? '💬 ' : ''}Dom.${i + 1} · ${esc(qPreviewText)}${qPreviewText.length >= 45 ? '…' : ''}
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                ${aiLabel}
                <input
                  type="number"
                  id="override-${i}"
                  min="0"
                  max="${pts}"
                  value="${overrideVal != null ? overrideVal : ''}"
                  placeholder="—"
                  style="width:64px;padding:5px 8px;border-radius:6px;border:1.5px solid var(--border);font-size:14px;font-weight:700;${overrideBorder}"
                >
                <span style="font-size:12px;color:var(--muted);">/ ${pts} pt</span>
              </div>
            </div>`;
        });

        overridePanel = `
          <div id="teacher-override-panel" style="margin-top:24px;background:white;border-radius:14px;border:2px solid var(--border);padding:20px;">
            <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:16px;">✏️ Modifica punteggi (docente)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
              ${gridHtml}
            </div>
            <div style="margin-top:14px;display:flex;align-items:center;gap:12px;">
              <button class="btn btn-primary" onclick="_saveTeacherOverrides('${safeName}')">💾 Salva modifiche punteggio</button>
              <span id="override-save-status" style="font-size:13px;color:var(--success);display:none;">✅ Salvato!</span>
            </div>
          </div>`;
      }

      // ── Scrivi tutto in una sola operazione ──
      main.innerHTML = headerHtml +
        `<div id="teacher-answer-cards">${cardsHtml}</div>` +
        overridePanel;
    };

    console.log('✅ score-override-fix: renderStudentResultsTeacher riparato');
  }

  // Riscrive anche _saveTeacherOverrides per sicurezza
  window._saveTeacherOverrides = async function(safeName) {
    const questions = window.S?.liveActivity?.questions || [];
    const overrides = {};
    let finalScore = 0;

    // Leggi i valori attuali da Firebase per le domande senza override
    let existingResponse = {};
    try {
      const snap = await db.ref('livelearn/responses/' + S.liveCode + '/' + safeName).get();
      existingResponse = snap.val() || {};
    } catch(e) {}
    const existingAnswers = existingResponse.answers || [];

    questions.forEach((q, i) => {
      const el = document.getElementById('override-' + i);
      if (!el) return;
      const val = el.value.trim();
      if (val !== '') {
        const n = Math.max(0, Math.min(q.points || 10, parseInt(val) || 0));
        overrides[i] = n;
        finalScore += n;
      } else {
        // Nessun override: calcola automaticamente
        const r = window.evaluateAnswer ? evaluateAnswer(q, existingAnswers[i]) : { scorable: false, correct: false, points: 0 };
        if (r.scorable && r.correct) finalScore += r.points;
      }
    });

    try {
      await db.ref('livelearn/responses/' + S.liveCode + '/' + safeName).update({
        scoreOverrides: overrides,
        score: finalScore
      });
      const statusEl = document.getElementById('override-save-status');
      if (statusEl) {
        statusEl.style.display = 'inline';
        setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 2500);
      }
      // Aggiorna il badge punteggio nell'header
      const scoreBadges = document.querySelectorAll('.badge-blue');
      scoreBadges.forEach(b => {
        if (b.textContent.includes('pt')) b.textContent = '⭐ ' + finalScore + ' pt';
      });
    } catch(e) {
      alert('Errore nel salvataggio: ' + e.message);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndPatch);
  } else {
    waitAndPatch();
  }

})();

---
name: feedback-storico
description: Scrive i feedback per gli alunni partendo dalle valutazioni che il docente ha scritto nello storico di MyClass, dal file esportato da MyClass ("feedback_per_claude_*.json", formato "myclass-feedback-export"), e produce "feedback_da_claude.json" da importare in MyClass. Usala quando il docente allega quel file o chiede di scrivere i feedback dallo storico con Claude Code.
---

# Feedback agli alunni dallo storico di MyClass

Il file esportato da MyClass (`"formato": "myclass-feedback-export"`) è autosufficiente:

1. Leggi `consegna_generale` e seguila alla lettera; `ruolo` contiene le istruzioni di ruolo del docente.
2. Per ogni elemento di `feedback` segui la sua `consegna` e scrivi il testo con il blocco `=== CLASSROOM ===` (apertura, riga `Il tuo voto:`, `Cosa è andato bene:`, `Cosa puoi migliorare:`, frase finale). Gli elementi sono indipendenti tra loro.
3. In ogni elemento l'alunno è `[A1]`: nel testo scrivi `[NOME_A1]` dove andrebbe il nome. Non inventare nomi.
4. Usa solo la valutazione del docente riportata nella consegna (voto, testo, eventuali punteggi per area): non inventare errori, esempi, risposte o punteggi. Il voto si copia, non si ricalcola.
5. Scrivi `feedback_da_claude.json` nella cartella di lavoro, nel formato indicato in `consegna_generale`, copiando `export_id` e ogni `ref`.
6. Prima di consegnare verifica con uno script (Node o Python) che il file sia JSON valido, che ci sia una voce per ogni `ref` e che ogni `testo` contenga `=== CLASSROOM ===` e `Il tuo voto:`.
7. Mostra al docente il file creato e un riepilogo (numero di feedback, eventuali dubbi).

Non salvare né committare il file esportato né quello prodotto: contengono dati scolastici.

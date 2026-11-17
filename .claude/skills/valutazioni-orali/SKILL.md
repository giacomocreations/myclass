---
name: valutazioni-orali
description: Genera le valutazioni delle verifiche orali dal file esportato da MyClass ("orali_per_claude_*.json", formato "myclass-orali-export") e produce "orali_da_claude.json" da importare in MyClass. Usala quando il docente allega quel file o chiede di valutare gli orali con Claude Code.
---

# Valutazioni orali da MyClass

Il file esportato da MyClass (`"formato": "myclass-orali-export"`) è autosufficiente:

1. Leggi `consegna_generale` e seguila alla lettera; `ruolo` contiene le istruzioni di ruolo del docente.
2. Ogni elemento di `valutazioni` è un orale indipendente (un alunno, o due-tre in un dialogo): segui la sua `consegna` (griglia, trascrizione oppure valutazione preliminare e annotazioni prese in diretta, formato della risposta) e scrivi la risposta completa con i marcatori che chiede (es. `=== VALUTAZIONE DOCENTE ===`, `=== CLASSROOM ===`).
3. Gli alunni sono codici (`[A1]`, `[A2]`…, elenco in `alunni`): dove la consegna chiede il nome scrivi il codice, nel testo rivolto all'alunno `[NOME_A1]`. I compagni citati sono `[compagno]`. Non inventare nomi.
4. Usa solo i dati della consegna: non inventare frasi dette dall'alunno, punteggi o errori.
5. Scrivi `orali_da_claude.json` nella cartella di lavoro, nel formato indicato in `consegna_generale`, copiando `export_id` e ogni `ref`, una voce per ogni orale nello stesso ordine.
6. Prima di consegnare verifica con uno script (Node o Python) che il file sia JSON valido, che ci sia una voce per ogni `ref` e che ogni `testo` contenga `VALUTAZIONE DOCENTE`.
7. Mostra al docente il file creato e un riepilogo (numero di orali, voti proposti, eventuali dubbi).

Non salvare né committare il file esportato né quello prodotto: contengono dati scolastici.

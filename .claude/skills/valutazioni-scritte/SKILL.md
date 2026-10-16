---
name: valutazioni-scritte
description: Genera le valutazioni delle verifiche scritte dal file esportato da MyClass ("valutazioni_per_claude_*.json", formato "myclass-valutazioni-export") e produce "valutazioni_da_claude.json" da importare in MyClass. Usala quando il docente allega quel file o chiede di generare le valutazioni con Claude Code.
---

# Valutazioni scritte da MyClass

Il file esportato da MyClass (`"formato": "myclass-valutazioni-export"`) è autosufficiente:

1. Leggi `consegna_generale` e seguila alla lettera; `ruolo` contiene le istruzioni di ruolo del docente.
2. Per ogni elemento di `valutazioni` segui la sua `consegna` e scrivi il testo con i blocchi `=== CLASSROOM ===` e `=== VALUTAZIONE DOCENTE ===`, in quest'ordine.
3. Gli alunni sono codici (`[A1]`, `[A2]`…, elenco in `alunni`): negli header scrivi `--- ALUNNO: [A1] ---`, nel testo `[NOME_A1]` dove andrebbe il nome. Non inventare nomi.
4. Usa solo i dati della consegna (percentuali, voti, risposte per domanda): non inventare numeri né risposte.
5. Scrivi `valutazioni_da_claude.json` nella cartella di lavoro, nel formato indicato in `consegna_generale`, copiando `export_id` e ogni `ref`.
6. Prima di consegnare verifica con uno script (Node o Python) che il file sia JSON valido e che ogni `testo` contenga i due marcatori e, in entrambi i blocchi, un header per ogni codice di `alunni`.
7. Mostra al docente il file creato e un riepilogo (numero di valutazioni, eventuali dubbi).

Non salvare né committare il file esportato né quello prodotto: contengono dati scolastici.

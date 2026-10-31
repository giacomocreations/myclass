---
name: piani-personalizzati
description: Genera i piani personalizzati (recupero, consolidamento, approfondimento) dal file esportato da MyClass ("piani_per_claude_*.json", formato "myclass-piani-export") e produce "piani_da_claude.json" da importare in MyClass. Usala quando il docente allega quel file o chiede di generare i piani personalizzati.
---

# Piani personalizzati da MyClass

Il file esportato da MyClass (`"formato": "myclass-piani-export"`) è autosufficiente:

1. Leggi `consegna_generale` e seguila alla lettera.
2. Per ogni elemento di `alunni` segui `consegna_quiz`, poi `consegna_listening` e `consegna_speaking` se non sono `null`. Se il `piano` è `ORALE` non c'è quiz: segui `consegna_testo` e restituisci `{ "ref", "testo" }`, con `[NOME]` al posto del nome.
   - Errori della verifica: se la consegna elenca errori con codice (`E1`, `E2`…), ogni domanda ha il campo `"errore"` con il codice che riprende (o `null`), e le domande esercitano davvero quella struttura con frasi nuove. Vale per tutti i piani, anche per l'approfondimento.
   - Schede "scopri la regola" (metodo induttivo, come nelle attività in classe): se `controlli.schede_regola` non è `null`, per le regole degli errori più importanti fai tra `minime` e `massime` schede. Ogni scheda è fatta di 3 domande consecutive con lo stesso `"scheda"` (`R1`, `R2`…): `"fase":"osserva"` (multiple-choice: esempi corretti con la parte chiave in grassetto, la frase sbagliata dell'alunno se c'è, domanda guida in italiano), `"fase":"regola"` (cloze in italiano dove l'alunno ricostruisce la regola cliccando le scelte `[[a|b|c]]`), `"fase":"controllo"` (multiple-choice "Avevi ragione?" con `"referenceTable"` = la regola completa). Seguono 1-3 esercizi su quella regola, con lo stesso `"scheda"` e senza `"fase"`. Le schede sono dentro il numero di domande richiesto (15), non in più. La regola deve essere corretta al 100%.
   - Versione PEI (`versione` PEI / PEI 2 / Training PEI): il piano è un **ripasso della sua verifica**, qualunque sia il voto. Stessi tipi di esercizio della verifica riportata nella consegna, stessa forma e stesso livello; niente tipi nuovi, niente testi da leggere, scrittura o "Transfer". Con l'approfondimento si può allargare un poco il lessico dello stesso tema (es. altri sport).
   - Foto: Claude non può creare immagini. Una domanda può riusare la foto di una domanda della verifica segnata `[FOTO]` (nei PEI le domande della verifica, nelle altre prove gli errori) con `"foto": <numero della domanda>`; MyClass inserisce la foto. Senza quel campo nessuna domanda deve dire "guarda la foto/immagine" o "look at the picture".
3. Per ogni elemento di `sfide` segui la sua `consegna`: genera un solo blocco per ogni chiave.
4. Scrivi `piani_da_claude.json` nella cartella di lavoro, nel formato indicato in `consegna_generale`. Copia `export_id` e ogni `ref` esattamente come sono.
5. Prima di consegnare, verifica con uno script (Node o Python) che il file sia JSON valido e controlla:
   - ogni domanda multiple-choice ha `correct` uguale all'indice di un'opzione;
   - in ogni fill-blanks e cloze il numero di spazi (`___` e scelte `[[a|b|c]]`) è uguale al numero di risposte, e per ogni `[[...]]` la risposta è una delle sue opzioni;
   - nella cloze la word bank contiene tutte le risposte degli spazi `___`;
   - nel drag-drop ogni risposta compare in `words`;
   - nella categorization `answers` ha un indice per ogni elemento di `items`;
   - ogni listening ha un `ttsText` di almeno 30 parole;
   - per ogni alunno con `controlli`: i codici diversi nel campo `errore` sono almeno `errori_minimi`; con `tipi_ammessi` nessuna domanda ha un altro tipo; con `opzioni_scelta_multipla` ogni multiple-choice ha esattamente quel numero di opzioni; ogni domanda che parla di foto/immagini ha `foto` con un numero di `foto_disponibili`; con `schede_regola` le schede complete (osserva → regola → controllo consecutive, regola con SOLO scelte `[[...]]`, controllo con `referenceTable`) sono almeno `minime` e in tutto non più di `massime`.
6. Mostra al docente il file creato e un riepilogo: numero di piani, sfide, errori ripresi per alunno (es. 5/6), schede "scopri la regola" per alunno (con le regole scelte) ed eventuali dubbi.

Non inserire mai nomi di alunni: nel file ci sono solo i `ref`. Non salvare né committare il file esportato né quello prodotto: contengono dati scolastici.

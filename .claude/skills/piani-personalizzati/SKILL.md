---
name: piani-personalizzati
description: Genera i piani personalizzati (recupero, consolidamento, approfondimento) dal file esportato da MyClass ("piani_per_claude_*.json", formato "myclass-piani-export") e produce "piani_da_claude.json" da importare in MyClass. Usala quando il docente allega quel file o chiede di generare i piani personalizzati.
---

# Piani personalizzati da MyClass

Il file esportato da MyClass (`"formato": "myclass-piani-export"`) è autosufficiente:

1. Leggi `consegna_generale` e seguila alla lettera.
2. Per ogni elemento di `alunni` segui `consegna_quiz`, poi `consegna_listening` e `consegna_speaking` se non sono `null`. Se il `piano` è `ORALE` non c'è quiz: segui `consegna_testo` e restituisci `{ "ref", "testo" }`, con `[NOME]` al posto del nome.
   - Errori della verifica: se la consegna elenca errori con codice (`E1`, `E2`…), ogni domanda ha il campo `"errore"` con il codice che riprende (o `null`), e le domande esercitano davvero quella struttura con frasi nuove. Vale per tutti i piani, anche per l'approfondimento.
   - Versione PEI (`versione` PEI / PEI 2 / Training PEI): il piano è un **ripasso della sua verifica**, qualunque sia il voto. Stessi tipi di esercizio della verifica riportata nella consegna, stessa forma e stesso livello; niente tipi nuovi, niente testi da leggere, scrittura o "Transfer". Con l'approfondimento si può allargare un poco il lessico dello stesso tema (es. altri sport).
3. Per ogni elemento di `sfide` segui la sua `consegna`: genera un solo blocco per ogni chiave.
4. Scrivi `piani_da_claude.json` nella cartella di lavoro, nel formato indicato in `consegna_generale`. Copia `export_id` e ogni `ref` esattamente come sono.
5. Prima di consegnare, verifica con uno script (Node o Python) che il file sia JSON valido e controlla:
   - ogni domanda multiple-choice ha `correct` uguale all'indice di un'opzione;
   - in ogni fill-blanks e cloze il numero di `___` è uguale al numero di risposte;
   - nella cloze la word bank contiene tutte le risposte;
   - nel drag-drop ogni risposta compare in `words`;
   - nella categorization `answers` ha un indice per ogni elemento di `items`;
   - ogni listening ha un `ttsText` di almeno 30 parole;
   - per ogni alunno con `controlli`: i codici diversi nel campo `errore` sono almeno `errori_minimi`; con `tipi_ammessi` nessuna domanda ha un altro tipo; con `opzioni_scelta_multipla` ogni multiple-choice ha esattamente quel numero di opzioni.
6. Mostra al docente il file creato e un riepilogo: numero di piani, sfide, errori ripresi per alunno (es. 5/6) ed eventuali dubbi.

Non inserire mai nomi di alunni: nel file ci sono solo i `ref`. Non salvare né committare il file esportato né quello prodotto: contengono dati scolastici.

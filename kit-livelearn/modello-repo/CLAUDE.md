# LiveLearn (solo quiz): istruzioni per Claude

Questo repository pubblica su GitHub Pages una copia di **LiveLearn**, l'app per i quiz in classe
scritta da giacomocreations (repository `giacomocreations/myclass`). La docente che lo usa ha
il **suo** progetto Firebase e il **suo** account: i suoi dati non si mescolano con quelli di
nessun altro.

## Cosa c'è qui

| File | A cosa serve |
|---|---|
| `livelearn-config.js` | Email della docente e configurazione Firebase. **È l'unico file che si modifica.** |
| `.github/workflows/pubblica-livelearn.yml` | Scarica l'ultima `LiveLearn.html` da `giacomocreations/myclass` e pubblica il sito. Parte ogni notte, a ogni modifica del repo e a mano. |
| `database.rules.json` | Le regole del Realtime Database con l'UID della docente. Si incollano in Firebase Console. |
| `index.html` | Rimanda a `LiveLearn.html`. |

`LiveLearn.html` **non** sta in questo repository e non va aggiunto: lo scarica la GitHub Action.
Non si modifica mai: le modifiche si perderebbero al primo aggiornamento.

## Regole importanti

- **Mai mettere su GitHub gli elenchi degli alunni** (nomi, cognomi, foto del registro, file Excel).
  Il repository è pubblico. I file con le classi stanno in una cartella del computer **fuori** da
  questo repository (per esempio `Documenti/LiveLearn-privato/`); il `.gitignore` è solo una rete
  di sicurezza.
- Nel repository non ci sono password e non devono esserci. La `apiKey` di Firebase in
  `livelearn-config.js` non è un segreto: identifica il progetto, la sicurezza la fanno le regole
  e il login.
- Non modificare `LiveLearn.html`. Se serve una correzione, va chiesta a chi sviluppa l'app.

## Inserire o aggiornare le classi

In LiveLearn: **Sono il docente → 👥 Classi → 📂 Carica file JSON**.

Formato (vedi anche `esempi/classi-esempio.json` nel kit):

```json
{
  "classi": [
    { "nome": "2A", "studenti": [ { "cognome": "Rossi", "nome": "Mario" }, { "cognome": "De Luca", "nome": "Anna Maria" } ] },
    { "nome": "3B", "studenti": [ { "cognome": "Verdi", "nome": "Luca" } ] }
  ]
}
```

- ⚠️ **Il file sostituisce TUTTE le classi** già presenti (si salvano solo le classi Tester).
  Deve quindi contenere sempre tutte le classi della docente, non solo quella nuova o cambiata.
  Conviene tenere un unico file `classi.json` (fuori dal repo) e aggiornarlo ogni volta.
- Cognome e nome in campi separati, come sono sul registro. Niente altri dati (date di nascita,
  note, DSA…): non servono.
- Il nome della classe diventa anche il suo identificativo (`"2A"` → `2a`, `"3 B"` → `3_b`):
  non cambiarlo durante l'anno, o le sessioni passate restano legate al nome vecchio.
- Gli alunni entrano nel quiz scrivendo nome e cognome (in qualsiasi ordine) e il codice della
  sessione: l'app li riconosce dall'elenco. Non servono codici personali.
- Se la docente fornisce una foto o un PDF del registro, trascrivi solo cognome e nome,
  ricontrolla gli accenti e gli apostrofi e mostrale l'elenco prima di creare il file.

## Creare un quiz

In LiveLearn: **Sono il docente → + Nuova attività → 📂 Importa JSON** (nel pannello dei tipi di
domanda), poi titolo e **💾 Salva attività**. Il file è un **array JSON di domande**, ognuna con `type`.
Esempio completo con tutti i tipi: `esempi/quiz-esempio.json` nel kit.

```json
{"type":"multiple-choice","text":"**Scegli l'opzione corretta.**\nYesterday I ___ to school.","options":["go","went","gone","going"],"correct":1,"points":10}
{"type":"cloze","text":"**Completa.**\nWe ___ (visit) Rome and ___ (eat) pizza.","answers":["visited","ate"],"points":10}
{"type":"fill-blanks","text":"**Completa.**\nShe ___ (write) a letter.","answers":["wrote"],"hint":"Verbo irregolare","points":10}
{"type":"matching","text":"**Abbina.**","left":["go","have","be"],"right":["went","had","was"],"points":10}
{"type":"drag-drop","text":"**Trascina la parola giusta.**","sentences":["I ___ football yesterday."],"words":["played","play","playing"],"answers":["played"],"points":10}
{"type":"reorder","text":"**Metti in ordine.**","sentences":["She has just arrived at school."],"points":10}
{"type":"categorization","text":"**Metti nella categoria giusta.**","categories":["Verb","Noun"],"items":["run","table","go","chair"],"answers":[0,1,0,1],"points":4}
{"type":"free-response","text":"**Racconta il tuo weekend in 3-4 frasi.**","hint":"Usa il Past Simple.","points":10}
{"type":"listening","text":"Listening\nAscolta e scegli.","ttsText":"Hi, I'm Zara. My bedroom is in the attic.","subtype":"multiple-choice","question":{"type":"multiple-choice","text":"Where is Zara's bedroom?","options":["ground floor","attic","basement"],"correct":1},"points":10}
```

Regole che l'app dà per scontate (se non si rispettano, il punteggio esce sbagliato):

- `text`: la consegna. `**grassetto**` e `\n` per andare a capo. Gli spazi da completare sono `___`.
- `multiple-choice`: `correct` è la **posizione** della risposta giusta, contando da 0.
- `cloze` / `fill-blanks`: un elemento di `answers` per ogni `___`, nello stesso ordine.
  Più risposte accettate per lo stesso spazio: `"he is|he's"`.
  Scelta dentro la frase: `[[Chloe|Noah|Lisa]]` conta come uno spazio; la risposta giusta va in
  `answers` ed è una delle opzioni.
- `matching`: `left[i]` e `right[i]` sono la coppia giusta. **Non mescolare** la colonna destra:
  la mescola l'app.
- `drag-drop`: `words` = risposte giuste + 2-3 distrattori; `answers` = una per ogni `___`.
- `reorder`: frasi già corrette; le parole le mescola l'app.
- `categorization`: `answers[i]` è la posizione (da 0) in `categories` della categoria di `items[i]`.
- `listening`: `ttsText` è il testo letto dalla voce sintetica (inglese). Se resta `""`, la docente
  carica un MP3 dal builder. `question` ha lo stesso formato del tipo indicato in `subtype`
  (`multiple-choice`, `fill-blanks`, `matching`, `drag-drop`, `reorder`).
- `free-response`: si corregge a mano dai risultati della sessione (oppure con l'AI di LiveLearn,
  se la docente imposta una chiave API in 🔑 API Key).
- `points`: punti della domanda (se manca vale 10).

Prima di consegnare il file: controlla che sia JSON valido, che ogni `answers` abbia tanti elementi
quanti `___`, e che `correct` punti davvero alla risposta giusta. Salva i quiz dove vuole la docente;
i quiz non contengono dati personali, quindi possono stare anche in questo repository
(per esempio in `quiz/`), ma non è necessario.

## Aggiornamenti dell'app

Arrivano da soli: ogni notte la GitHub Action scarica l'ultima `LiveLearn.html`.
Per averli subito: GitHub → questo repository → **Actions → Pubblica LiveLearn → Run workflow**.

- GitHub **sospende le esecuzioni notturne** dopo 60 giorni senza modifiche al repository.
  Se in Actions compare l'avviso, basta premere "Enable workflow" (o lanciarlo a mano).
- Se un'esecuzione fallisce, il sito resta all'ultima versione pubblicata: nessun danno.
  Apri l'esecuzione rossa e leggi il passo fallito.
- Se dopo un aggiornamento compare **"permission denied"**, probabilmente le regole del database
  sono cambiate. Le regole aggiornate sono in
  `https://raw.githubusercontent.com/giacomocreations/myclass/main/kit-livelearn/modello-repo/database.rules.json`:
  si scaricano, si sostituisce `UID-DELLA-DOCENTE` con l'UID della docente (lo stesso già presente
  nel `database.rules.json` di questo repository), si aggiorna il file qui e si incolla il testo in
  Firebase Console → Realtime Database → Regole → **Pubblica**.

## Problemi frequenti

| Sintomo | Causa probabile |
|---|---|
| "⚠️ Configurazione mancante" | `livelearn-config.js` assente o senza `databaseURL`/`teacherEmail`. |
| "Password errata" con la password giusta | `teacherEmail` diversa dall'utente creato in Firebase Authentication. |
| "Dominio non autorizzato" | Manca `<utente>.github.io` in Firebase → Authentication → Impostazioni → Domini autorizzati. |
| "permission denied" | UID sbagliato nelle regole, regole non pubblicate, o regole vecchie (vedi sopra). |
| Gli alunni non riescono a entrare | Accesso "Anonimo" non attivo in Firebase → Authentication → Metodo di accesso. |
| Il sito non si aggiorna | Settings → Pages → Source deve essere "GitHub Actions"; controlla la scheda Actions. |

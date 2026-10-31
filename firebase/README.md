# Regole del Realtime Database

- `database.rules.json`: regole da pubblicare in Firebase Console → Realtime Database → Regole
  (si sostituisce tutto il testo e si preme **Pubblica**).
- `database.rules.prima.json`: le regole in uso fino a ottobre 2026, per tornare indietro.

Le letture sono le stesse di prima. Le scritture sono ristrette:

- l'alunno (accesso anonimo, login a codice) scrive solo le proprie risposte, la classifica,
  l'avviso di quota AI esaurita, le richieste AI, il risultato dei piani di recupero,
  i segni di "letto", i propri messaggi privati, accessi, notifiche e l'autovalutazione degli obiettivi;
- lezioni, attività, sessioni, controllo live, bacheca di classe, inbox, agentDone e codici dei piani
  li scrive solo l'account docente;
- `planDrafts` (bozze dei piani aperte nell'editor di LiveLearn, con nome dell'alunno e domande)
  lo legge e lo scrive solo l'account docente; MyClass toglie ogni copia quando la bozza viene
  approvata, scartata o rigenerata.

Notifiche di QuestTown (`englishtown/push/<CLASSE>/<CODICE>`, ottobre 2026): ogni alunno che attiva
gli avvisi nel gioco installato vi scrive il proprio token; lo legge solo l'account docente, che invia
dal gioco (pannello docente → 📣 Notifiche / evento, e in automatico quando il cursore di classe apre
una unit nuova). Senza questo ramo pubblicato il gioco funziona lo stesso, ma nessun token viene salvato.

Dopo la pubblicazione conviene una prova veloce con un alunno tester (LiveLearn → Classi → ➕ Tester):
pubblicare una lezione da MyClass, avviare una sessione in LiveLearn, entrare e consegnare dal tester,
aprire la StudentApp e mandare un messaggio al prof. Se qualcosa dà "permission denied",
si ripubblica `database.rules.prima.json`.

## Copie di altri docenti (`kit-livelearn/`)

Il kit contiene le stesse regole, solo il ramo `livelearn` e con l'UID al posto del tuo.
Quando cambi `database.rules.json`, rigenera anche quelle:

```bash
python3 kit-livelearn/aggiorna-regole.py
```

Chi usa una copia le ripubblica quando LiveLearn dà "permission denied" dopo un aggiornamento.

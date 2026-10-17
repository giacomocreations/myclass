# Regole del Realtime Database

- `database.rules.json`: regole da pubblicare in Firebase Console → Realtime Database → Regole
  (si sostituisce tutto il testo e si preme **Pubblica**).
- `database.rules.prima.json`: le regole in uso fino a ottobre 2026, per tornare indietro.

Le letture sono le stesse di prima. Le scritture sono ristrette:

- l'alunno (accesso anonimo, login a codice) scrive solo le proprie risposte, la classifica,
  l'avviso di quota AI esaurita, le richieste AI, il risultato dei piani di recupero,
  i segni di "letto", i propri messaggi privati, accessi, notifiche e l'autovalutazione degli obiettivi;
- lezioni, attività, sessioni, controllo live, bacheca di classe, inbox, agentDone e codici dei piani
  li scrive solo l'account docente.

Dopo la pubblicazione conviene una prova veloce con un alunno tester (LiveLearn → Classi → ➕ Tester):
pubblicare una lezione da MyClass, avviare una sessione in LiveLearn, entrare e consegnare dal tester,
aprire la StudentApp e mandare un messaggio al prof. Se qualcosa dà "permission denied",
si ripubblica `database.rules.prima.json`.

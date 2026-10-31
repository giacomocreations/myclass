# Guida per Claude: installare LiveLearn (solo quiz) per una nuova docente

Stai aiutando una docente a usare **LiveLearn**, l'app per fare quiz in classe in tempo reale
scritta da giacomocreations (`github.com/giacomocreations/myclass`). Avrà **la sua copia**:
il suo sito su GitHub Pages, il suo database Firebase, il suo account con la sua password.
Userà solo i quiz: StudentApp, piani personalizzati e MyClass restano nascosti.

Il risultato finale:

- un repository GitHub pubblico `livelearn` della docente, con dentro solo la configurazione;
- il sito `https://<utente-github>.github.io/livelearn/`;
- una GitHub Action che **ogni notte scarica l'ultima versione di LiveLearn**. La docente non deve
  mai copiare a mano un file nuovo.

## Come lavorare con lei

- Parla in italiano, un passo alla volta. Dopo ogni passo aspetta che ti dica che è fatto
  (o che ti mandi uno screenshot) prima di passare al successivo.
- Sui siti (GitHub, Firebase) i nomi dei pulsanti possono cambiare un po' o essere in inglese:
  descrivi cosa cercare, non solo l'etichetta esatta.
- Se hai un terminale e puoi usare `git`, i passi sui file li fai tu. Altrimenti la guidi a farli
  dal sito di GitHub (sotto c'è la strada per entrambi i casi).
- **Non chiederle mai la password** e non scriverla in nessun file. Le serve solo per entrare
  in LiveLearn.
- **Gli elenchi degli alunni non vanno mai su GitHub** (il repository è pubblico).

I file del kit si trovano qui (sono testo, puoi leggerli o scaricarli):

```
https://raw.githubusercontent.com/giacomocreations/myclass/main/kit-livelearn/modello-repo/CLAUDE.md
https://raw.githubusercontent.com/giacomocreations/myclass/main/kit-livelearn/modello-repo/livelearn-config.js
https://raw.githubusercontent.com/giacomocreations/myclass/main/kit-livelearn/modello-repo/database.rules.json
https://raw.githubusercontent.com/giacomocreations/myclass/main/kit-livelearn/modello-repo/index.html
https://raw.githubusercontent.com/giacomocreations/myclass/main/kit-livelearn/modello-repo/.gitignore
https://raw.githubusercontent.com/giacomocreations/myclass/main/kit-livelearn/modello-repo/.github/workflows/pubblica-livelearn.yml
https://raw.githubusercontent.com/giacomocreations/myclass/main/kit-livelearn/esempi/classi-esempio.json
https://raw.githubusercontent.com/giacomocreations/myclass/main/kit-livelearn/esempi/quiz-esempio.json
```

Se la docente ha ricevuto il kit come cartella `kit-livelearn` (zip), sono gli stessi file.
**Leggi subito `modello-repo/CLAUDE.md`**: spiega i formati di classi e quiz e i problemi
frequenti, e ti servirà alla fine.

---

## Passo 0 — Due domande prima di cominciare

1. Ha già un **account Google**? (serve per Firebase)
2. Che **nome utente GitHub** vuole? Comparirà nell'indirizzo che danno agli alunni
   (`https://<nome>.github.io/livelearn/`): meglio qualcosa di semplice e serio, es. `prof-rossi`.

## Passo 1 — Account e repository GitHub

1. Su <https://github.com/signup> crea l'account (se non lo ha) e conferma l'email.
2. In alto a destra **+ → New repository**:
   - Repository name: `livelearn`
   - **Public** (GitHub Pages gratuito funziona solo con i repository pubblici; dentro ci sarà
     solo la configurazione, nessun dato degli alunni)
   - il resto lascialo com'è → **Create repository**.

## Passo 2 — Progetto Firebase

Tutto su <https://console.firebase.google.com> con il suo account Google. È gratuito (piano
Spark), non serve la carta di credito.

1. **Crea un progetto** (es. `livelearn-rossi`). Google Analytics: si può disattivare.
2. **Realtime Database** (menu a sinistra, sotto *Build/Crea*) → **Crea database**:
   - posizione: **Belgio (europe-west1)**;
   - **Avvia in modalità bloccata**.
   Va creato **prima** del passo 5, così la configurazione contiene già l'indirizzo del database.
3. **Authentication** → **Inizia** → scheda **Metodo di accesso** (*Sign-in method*). Attiva:
   - **Email/password** (solo la prima opzione, non il "link via email");
   - **Anonimo** (serve agli alunni: entrano senza account).
4. **Authentication → Utenti → Aggiungi utente**: la sua email e una password che sceglie lei
   (non dirla a te). Poi copia l'**UID utente** che compare nella tabella (una stringa tipo
   `8RtaYMmlVme4...`) e mandalo a te: l'UID non è un segreto.
5. **Impostazioni progetto** (ingranaggio in alto a sinistra) → **Generali** → in fondo,
   *Le tue app* → icona **`</>`** (Web) → un nome qualsiasi → **Registra app**
   (Firebase Hosting **non** serve). Ti copia/incolla il blocco `firebaseConfig = { ... }`.
   Controlla che ci sia `databaseURL`; se manca, prendilo da Realtime Database: è l'indirizzo
   in alto che finisce con `.firebasedatabase.app`.
6. **Authentication → Impostazioni → Domini autorizzati → Aggiungi dominio**:
   `<nome-utente-github>.github.io` (senza `https://` e senza `/livelearn`).

## Passo 3 — Le regole del database

1. Prendi `database.rules.json` del kit e sostituisci **tutte** le occorrenze di
   `UID-DELLA-DOCENTE` con il suo UID (passo 2.4). Controlla che non ne resti nessuna.
2. Firebase → Realtime Database → scheda **Regole**: si cancella tutto il testo, si incolla il
   file modificato, **Pubblica**.

## Passo 4 — La configurazione

Compila `livelearn-config.js` del kit:

- `teacherEmail`: l'email dell'utente creato al passo 2.4;
- `firebase`: i valori del passo 2.5 (tutti, compreso `databaseURL`);
- `soloQuiz: true`.

Non deve restare nessun `DA-COMPILARE` (la GitHub Action si rifiuta di pubblicare se lo trova).

## Passo 5 — I file nel repository

Nel repository vanno: `livelearn-config.js` (compilato), `database.rules.json` (con il suo UID),
`index.html`, `.gitignore`, `CLAUDE.md` e `.github/workflows/pubblica-livelearn.yml`.
**Non** `LiveLearn.html` (lo scarica l'Action) e **non** gli esempi o le classi.

**Se hai un terminale:**

```bash
git clone https://github.com/<nome>/livelearn.git && cd livelearn
# copia qui i file del kit (curl dagli indirizzi sopra o dalla cartella dello zip),
# poi metti la configurazione compilata e le regole con l'UID
git add -A && git commit -m "LiveLearn: configurazione" && git push
```

(Al primo `git push` GitHub chiederà di accedere: va bene il login dal browser o GitHub Desktop.)

**Senza terminale (dal sito di GitHub):**

1. Nel repository: **Add file → Upload files** e trascina `livelearn-config.js`,
   `database.rules.json`, `index.html`, `CLAUDE.md` → **Commit changes**.
2. Il file dell'Action sta in una cartella nascosta, che spesso non si vede né si trascina.
   Si crea a mano: **Add file → Create new file**, nel nome scrivi esattamente
   `.github/workflows/pubblica-livelearn.yml` (le `/` creano le cartelle), incolla il contenuto
   del file del kit → **Commit changes**.
3. Allo stesso modo crea `.gitignore` incollando il contenuto del kit.

## Passo 6 — Pubblicare il sito

1. Repository → **Settings → Pages** → *Build and deployment* → Source: **GitHub Actions**.
2. Scheda **Actions** → **Pubblica LiveLearn** → **Run workflow** (se GitHub chiede di abilitare le
   Actions, conferma). Dopo 1-2 minuti l'esecuzione diventa verde.
   Se è rossa: aprila e leggi il passo fallito (di solito `livelearn-config.js` non compilato).
3. Apri `https://<nome>.github.io/livelearn/`: deve comparire LiveLearn.

## Passo 7 — Prova completa (5 minuti)

1. **Sono il docente** → password → entra.
   - "Password errata": `teacherEmail` non coincide con l'utente Firebase.
   - "Dominio non autorizzato": rivedi il passo 2.6.
   - "Configurazione mancante": rivedi il passo 4.
2. **👥 Classi → 📂 Carica file JSON** → `esempi/classi-esempio.json`: compaiono 2A e 3B.
3. **+ Nuova attività → 📂 Importa JSON** → `esempi/quiz-esempio.json` → titolo "Prova" →
   **💾 Salva attività**.
4. Avvia una sessione dell'attività sulla classe 2A: compare un codice di 4 lettere.
5. Dal telefono (o da una finestra in incognito) apri il sito → **Sono uno studente** →
   nome "Mario Rossi" e il codice → rispondi e consegna.
6. Torna alla vista docente: il risultato di Mario Rossi deve esserci.

Se qualcosa dà **"permission denied"**: regole non pubblicate o UID sbagliato (passo 3).

Finita la prova, le classi di esempio si sostituiscono con quelle vere (passo 8): l'importazione
rimpiazza tutte le classi.

## Passo 8 — Le classi vere

Segui la sezione "Inserire o aggiornare le classi" di `CLAUDE.md`. In breve: lei ti dà gli elenchi
(foto, PDF, Excel o a voce), tu prepari **un solo** `classi.json` con **tutte** le sue classi e lo
salvi in una cartella del suo computer **fuori dal repository** (es. `Documenti/LiveLearn-privato/`).
Lei lo carica da 👥 Classi → 📂 Carica file JSON.

## Passo 9 — Spiegale come andrà d'ora in poi

- **Quiz nuovi:** te li chiede, tu prepari il JSON (formati in `CLAUDE.md`), lei lo importa con
  📂 Importa JSON nel builder.
- **Aggiornamenti dell'app:** arrivano da soli ogni notte. Per averli subito:
  Actions → Pubblica LiveLearn → Run workflow.
- **Limiti del piano gratuito Firebase:** 100 collegamenti contemporanei (una classe intera va
  benissimo), 1 GB di dati. Gli MP3 caricati nei listening occupano spazio: meglio file brevi.
- In futuro, quando lavori nel suo repository `livelearn`, le istruzioni sono in `CLAUDE.md`.

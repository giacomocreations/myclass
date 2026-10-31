// Configurazione di LiveLearn per questo sito.
// LiveLearn.html arriva da solo (lo scarica la GitHub Action ad ogni pubblicazione):
// si modifica solo QUESTO file.
window.LIVELEARN_CONFIG = {
  // Email dell'account docente creato in Firebase → Authentication → Utenti.
  // Non è un segreto: la password la controlla Firebase.
  teacherEmail: 'DA-COMPILARE@esempio.it',

  // Firebase → Impostazioni progetto → Le tue app → app web → "Configurazione".
  // Si copiano i valori così come sono. databaseURL è obbligatorio
  // (se manca: Realtime Database → in alto c'è l'indirizzo che finisce con .firebasedatabase.app).
  firebase: {
    apiKey:            'DA-COMPILARE',
    authDomain:        'DA-COMPILARE.firebaseapp.com',
    databaseURL:       'https://DA-COMPILARE-default-rtdb.europe-west1.firebasedatabase.app',
    projectId:         'DA-COMPILARE',
    storageBucket:     'DA-COMPILARE.firebasestorage.app',
    messagingSenderId: 'DA-COMPILARE',
    appId:             'DA-COMPILARE'
  },

  // true = solo quiz: nasconde StudentApp, piani personalizzati, MyClass e i drill.
  soloQuiz: true
};

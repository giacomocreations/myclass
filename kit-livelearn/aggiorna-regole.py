#!/usr/bin/env python3
"""Rigenera kit-livelearn/modello-repo/database.rules.json da firebase/database.rules.json.

Tiene solo il ramo "livelearn" (l'unico che serve a LiveLearn in modalita' solo quiz)
e mette al posto dell'UID del docente il segnaposto UID-DELLA-DOCENTE.
Da lanciare ogni volta che si cambiano le regole in firebase/database.rules.json:

    python3 kit-livelearn/aggiorna-regole.py
"""
import json, pathlib, re

QUI = pathlib.Path(__file__).resolve().parent
SORGENTE = QUI.parent / 'firebase' / 'database.rules.json'
DESTINAZIONE = QUI / 'modello-repo' / 'database.rules.json'
SEGNAPOSTO = 'UID-DELLA-DOCENTE'

regole = json.loads(SORGENTE.read_text(encoding='utf-8'))['rules']
ridotte = {'rules': {'.read': False, '.write': False, 'livelearn': regole['livelearn']}}
testo = json.dumps(ridotte, indent=2, ensure_ascii=False)
uid = set(re.findall(r"auth\.uid === '([^']+)'", testo))
for u in uid:
    testo = testo.replace(u, SEGNAPOSTO)
DESTINAZIONE.write_text(testo + '\n', encoding='utf-8')
print('Scritto', DESTINAZIONE.relative_to(QUI.parent), '- UID sostituiti:', len(uid))

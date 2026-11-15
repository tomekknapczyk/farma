# Farma

Izometryczna gra o farmie w pikselowej grafice, na iPada (Safari, dodana do ekranu głównego). TypeScript, Vite, Phaser 3.

## Uruchomienie

```
npm install
npm run dev          # tryb deweloperski
npm test             # testy
npm run build        # produkcja do dist/
npm run preview      # podgląd builda (localhost:4173)
```

Parametry w adresie: `?speed=10` (szybszy czas), `?seed=5` (stały los), `?debug=1` (1000 monet na start, „+Poziom” w menu rodzica).

## Dodanie do ekranu głównego iPada

1. Wystaw `dist/` na hostingu statycznym z HTTPS (np. Netlify, GitHub Pages) albo w tej samej sieci Wi-Fi uruchom `npm run preview -- --host` i otwórz adres komputera w Safari na iPadzie.
2. Safari: Udostępnij, potem „Dodaj do ekranu początkowego”.

Uwaga: service worker (praca offline) wymaga HTTPS albo localhost. Przez zwykłe `http://adres-w-sieci` gra działa, ale bez trybu offline, więc pełna PWA na iPadzie potrzebuje hostingu z HTTPS.

## Menu rodzica

Przytrzymaj licznik monet przez 3 sekundy (pod koniec widać zielony pasek). Menu: „Zapisz kopię” (pobiera plik JSON), „Wczytaj kopię”, „Nowa gra” (dwa potwierdzenia).

Ikony PWA: `node scripts/make-icons.mjs`.

# Farma: dokument projektowy (wersja 1)

Data: 2026-11-15
Status: zaakceptowany (2026-11-15)

Oznaczenia: **[ustalone]** to decyzja rodzica (zleceniodawcy), **[decyzja projektanta]** to propozycja z rozmowy, którą rodzic może zmienić, **[do strojenia]** to liczby startowe do poprawienia po testach z dzieckiem.

---

## 1. Po co i dla kogo

Gra przeglądarkowa dla **9-letniego dziecka**, które dobrze czyta, ale tylko po polsku. Dziecko rozbudowuje własną farmę: na kolejnych levelach dochodzą rośliny, zwierzęta, maszyny i nowe pola. Cel to zbudowanie dużej farmy. **[ustalone]**

- Najpierw gra działa na komputerze, docelowo na tablecie. **[ustalone]** Dlatego od pierwszego dnia sterowanie opiera się tylko na kliknięciu/dotyku, bez klawiatury i bez najeżdżania myszką. **[decyzja projektanta]**
- Gra ma być **szybka, żeby się nie nudziła, ale nie za szybka**. Cały czas jest coś do zrobienia, a postęp widać w jednej sesji. **[ustalone]**
- **Sesja trwa od 30 minut do 1 godziny.** Gry nie da się przejść od razu, ma starczyć na długo. Pierwsze levele idą szybko, kolejne coraz wolniej. **[ustalone]**
- **Docelowe urządzenie to iPad (Safari, gra dodana do ekranu głównego).** Na nim testujemy dotyk i wydajność. **[ustalone]**

### Cele
- Ciągła, przyjemna pętla: sadzenie → podlewanie → zbiór → sprzedaż → zakupy → level → odblokowanie.
- Poczucie, że farma rośnie i zmienia się z porami roku.
- Straty istnieją, ale zawsze da się je odrobić.

### Czego nie robimy (w wersji 1)
- Multiplayer, konta, serwer, płatności, reklamy.
- Długie teksty, dialogi, fabuła.
- Inne języki niż polski.
- Jazda konna i zawody konne (konie służą tylko do hodowli ras i sprzedaży źrebaków). **[ustalone]**

### Porażka, nawet jeśli gra technicznie działa
- Zwierzę umiera albo coś przepada bezpowrotnie. **[ustalone]**
- Dziecko musi dużo czytać albo nie wie, co zrobić dalej.
- Elementy na tablecie są za małe, żeby w nie trafić palcem.
- Gra jest frustrująca: kara za brak podlewania czy chorobę jest tak duża, że dziecko nie ma pieniędzy, żeby iść dalej (patrz zabezpieczenie w 4.6).

---

## 2. Sposób budowy

- **Platforma:** gra w przeglądarce, jedna strona, działa offline po załadowaniu. **[decyzja projektanta]** Ten sam kod działa na komputerze i tablecie.
- **Technologia:** TypeScript + Vite + Phaser 3 (silnik gier 2D: scena, kamera, wejście dotykowe, tweeny). **[decyzja projektanta]** Bez backendu.
- **Instalacja na tablecie [decyzja projektanta]:** gra jest PWA, więc można ją dodać do ekranu głównego (iPad i Android) i działa offline. Na iOS Safari dane stron, których się nie odwiedza, mogą zniknąć po ok. 7 dniach, a zainstalowana PWA tego ryzyka nie ma. Dodatkowo w ukrytym menu rodzica (przytrzymanie ikony monet przez 3 s) są przyciski „Zapisz kopię” i „Wczytaj kopię”, czyli eksport i import pliku JSON.
- **Zapis gry:** automatyczny, w `localStorage` przeglądarki, co kilka sekund i przy każdej ważnej akcji (zakup, level). Jeden slot zapisu. Gdy gra jest wyłączona, czas stoi i nic nie rośnie. **[decyzja projektanta]** Tempo jest szybkie, więc nie ma potrzeby nadrabiać czasu nieobecności, a dziecko nie zastanie zaniedbanej farmy.
- **Uruchamianie:** `npm run dev` lokalnie, `npm run build` daje statyczne pliki, które da się później wrzucić na dowolny hosting i otworzyć na tablecie.
- **Folder projektu:** `/Users/tomekknapczyk/Code/Farma`. **[ustalone]**

---

## 3. Wygląd i sterowanie

### 3.1 Widok
- **Izometryczny („z ukosa”)**: kafelki w kształcie rombu, budynki mają ściany i dach, farma wygląda jak makieta. **[ustalone]**
- **Pikselowa grafika rysowana specjalnie pod tę grę**, w jednym spójnym stylu, wyraźnie ładniejsza od prostokątów ze szkicu. **[ustalone]** Jeśli się nie spodoba, plan B to darmowe paczki (np. Kenney.nl, CC0). **[ustalone]** Dlatego grafika jest odseparowana od logiki gry: każdy obiekt ma klucz grafiki, który można podmienić na PNG z paczki bez zmian w logice.
- **Kto rysuje i kto ocenia [decyzja projektanta]:** grafikę rysuje budujący (Claude), bez osobnego grafika. Kolejność: najpierw logika gry na prostych, ale już izometrycznych sprite'ach, potem pierwsza runda właściwej grafiki (kafelki, pszenica, kura, stodoła, jeden koń, w wiośnie i zimie) do oceny przez rodzica i dziecko. Na tej podstawie rodzic decyduje: rysujemy dalej albo przechodzimy na plan B. Grafika nie blokuje prac nad logiką.
- Sposób rysowania **[decyzja projektanta]**: sprite'y jako pliki PNG w małej rozdzielczości (kafelek 32×16 px, obiekty odpowiednio większe), skalowane całkowitą wielokrotnością z wyłączonym wygładzaniem (`pixelArt: true`). Spójna, ograniczona paleta, około 32 kolorów. Każdy obiekt na mapie ma osobne warianty dla czterech pór roku (albo co najmniej tint plus nakładkę, np. śnieg na dachu).

### 3.2 Ekran
- **Góra:** monety, pasek XP z numerem levelu, ikona pogody, pora roku (ikona i krótka nazwa, np. „Późne lato”).
- **Dół:** duże przyciski narzędzi, każdy z ikoną i jednym słowem: **Sadź, Podlej, Zbierz, Sklep**. Wybierasz narzędzie i stukasz w pola. Do tego kontekstowy przycisk zwierząt, gdy stukniesz w zagrodę lub zwierzę.
- **Minimalny rozmiar celu dotykowego:** 48×48 px na ekranie. **[decyzja projektanta]**
- **Teksty:** krótkie etykiety i liczby przy ikonach, bez zdań. Komunikaty to maksymalnie kilka słów („Poziom 3!”, „Krowa jest chora”). **[ustalone: mało tekstu]**

### 3.3 Sterowanie
- Stuknięcie: akcja wybranego narzędzia na polu albo otwarcie małego panelu obiektu (zwierzę, budynek).
- Przeciąganie palcem lub myszą: przesuwanie mapy.
- Szczypanie dwoma palcami lub kółko myszy: zoom w 3 stałych krokach. **[decyzja projektanta]**
- Podświetlenie pola pod palcem lub kursorem, żeby było jasne, w co się trafiło.
- Przeciągnięcie z wybranym narzędziem (np. podlewanie) działa na kolejne pola, żeby nie stukać 20 razy. **[decyzja projektanta]**

---

## 4. Mechaniki

### 4.1 Pętla główna
Kup nasiona → posadź na zaoranym polu → podlej → poczekaj → zbierz → plony sprzedaj albo daj zwierzętom jako paszę → za monety kupuj nasiona, zwierzęta, maszyny, działki → XP z każdej akcji → level → odblokowania.

### 4.2 Uprawy
- Pole ma stany: **puste → posadzone → rośnie (2–3 etapy wizualne) → gotowe do zbioru**.
- **Podlewanie** **[ustalone]**: podlane pole daje pełny plon, niepodlane nie więdnie, tylko daje **mały plon** (około 40% pełnego, minimum 1) **[do strojenia]**. Ikona kropli nad polem przypomina o podlaniu. Jedno podlanie wystarcza na cały cykl wzrostu **[decyzja projektanta]**, żeby nie było żmudnie.
- Deszcz podlewa wszystkie pola sam (patrz 4.5).
- Każda roślina ma pory roku, w których można ją sadzić. Poza nimi przycisk sadzenia jej nie pokazuje. Posadzona roślina rośnie dalej po zmianie pory. Zimą nie sadzi się nic. **[ustalone ogólnie, szczegóły: decyzja projektanta]**

Rośliny w wersji 1 **[do strojenia]**:

| Roślina | Level | Pory sadzenia | Czas wzrostu | Cena nasion | Pełny plon | Cena sprzedaży / szt. |
|---|---|---|---|---|---|---|
| Pszenica | 1 | wiosna, lato, jesień (ozima) | 30 s | 5 | 3 | 4 |
| Marchew | 2 | wiosna, lato, jesień | 45 s | 8 | 3 | 6 |
| Kukurydza | 4 | lato | 75 s | 15 | 4 | 9 |
| Dynia | 6 | lato, jesień | 120 s | 25 | 2 | 30 |

Pszenica i kukurydza są też paszą dla zwierząt.

### 4.3 Zwierzęta
Wspólne zasady:
- Zwierzęta mieszkają w budynku lub zagrodzie o ograniczonej pojemności, którą można rozbudować. Pojemność ogranicza też przychówek. **[decyzja projektanta]**
- **Karmienie ręczne, przez koryta i paśniki [ustalone]:** każda zagroda (kurnik, obórka, stajnia) ma koryto lub paśnik. Dziecko **uzupełnia je ręcznie**: stuka w koryto, wybiera paszę i ilość z magazynu, karmi się całe stado naraz, a nie każde zwierzę osobno. **[ustalone]** Koryto ma pojemność (np. 10 porcji **[do strojenia]**) i widoczny poziom napełnienia. Każde zwierzę zjada porcję na swój cykl produkcji. Pusty lub prawie pusty paśnik pokazuje ikonkę. Głodne zwierzę nie produkuje, ale nie choruje od głodu i nie umiera. **[decyzja projektanta]**
- **Smakołyki pojedynczo [ustalone]:** w panelu zwierzęcia można dać jednemu zwierzęciu smakołyk (marchew, później jabłko). Efekt **[decyzja projektanta]**: serduszko nad zwierzęciem, następny produkt gotowy 2× szybciej, +1 XP. U koni smakołyk podnosi też szansę na źrebaka w kolejnym cyklu.
- Gotowy produkt widać jako ikonę nad zwierzęciem i zbiera się go stuknięciem (z możliwością przeciągnięcia palcem po kilku zwierzętach).
- **Choroby** **[ustalone]**: zwierzę losowo zachoruje (około 3% szans na każdy cykl produkcji **[do strojenia]**). Chore ma widoczną ikonkę (np. zielona chmurka lub termometr) i **nie produkuje**. Leczy się je przyciskiem **Weterynarz** w panelu zwierzęcia, za monety. Po wyleczeniu od razu wraca do pracy. **Zwierzęta nigdy nie umierają.**
- **Przychówek** **[ustalone]**: co jakiś czas, jeśli w zagrodzie są co najmniej 2 zwierzęta danego gatunku, jest wolne miejsce i oba są zdrowe, rodzi się młode (np. 10% szans na cykl **[do strojenia]**). Młode przez kilka minut nie produkuje, potem dorasta.

Zwierzęta w wersji 1 **[do strojenia]**:

| Zwierzę | Level | Cena | Pasza | Produkt | Czas | Cena produktu | Weterynarz |
|---|---|---|---|---|---|---|---|
| Kura | 3 | 40 | 1 pszenica | jajko | 40 s | 8 | 15 |
| Krowa | 5 | 150 | 2 pszenica lub 1 kukurydza | mleko | 90 s | 25 | 40 |

### 4.4 Konie **[ustalone: ważne]**
- Osobna hodowla w **stajni z padokiem**, odblokowana na levelu 7 **[do strojenia]**.
- **Rasy w wersji 1:** 3 rasy różniące się wyglądem i ceną, np. **Kuc (gniady), Arab (siwy), Fryz (kary)** **[decyzja projektanta: wybór ras]**. Kolejne rasy odblokowują się z levelem.
- Konie nie dają produktu. Jedzą paszę (marchew lub kukurydzę), chorują jak inne zwierzęta i rodzą źrebaki według zasad przychówku.
- **Źrebak** dziedziczy rasę rodziców. Przy dwóch różnych rasach losowo jedną z nich **[decyzja projektanta]**. Po dorośnięciu (kilka minut) zostaje w stajni albo można go **sprzedać** za dobrą cenę. Sprzedaż źrebaków to główny zarobek z koni. **[ustalone]**
- Panel stajni pokazuje kolekcję: które rasy dziecko już ma (dodatkowa motywacja, bez tekstu, same sylwetki).

### 4.5 Pory roku i pogoda **[ustalone]**
- **Jedna pora roku trwa około 60 minut gry.** Między porami jest **5-minutowe przejście** z nazwą, np. późne lato, wczesna jesień, przedzimie, roztopy. Grafika w tym czasie stopniowo się zmienia. **[ustalone]**
- Kolejność: wiosna → (przejście) → lato → (wczesna jesień) → jesień → (przedzimie) → zima → (roztopy) → wiosna. Gra zaczyna się wiosną.
- **Wygląd:** wiosna to świeża zieleń i kwiaty, lato to soczysta zieleń i złote zboża, jesień to rude drzewa, zima to śnieg na ziemi i dachach. Pola zimą są zamarznięte.
- **Postęp i możliwości:** od pory zależy, co można sadzić (patrz 4.2). Zimą trzeba żyć z zapasów i zwierząt. Jeśli rodzic chce, zwierzęta mogą zimą produkować wolniej. **[decyzja projektanta: wersja 1 bez spowolnienia]**
- **Pogoda** zmienia się co kilka minut, losowana według pory roku:
  - słońce: bez efektu,
  - deszcz: podlewa wszystkie posadzone pola (wiosną i jesienią częściej),
  - upał (tylko latem): rośliny rosną o około 20% szybciej, ale deszcz nie przychodzi **[do strojenia]**,
  - śnieg (tylko zimą): efekt wizualny.
  Pogodę widać na mapie (krople, płatki, chmury) i jako ikonę na górnym pasku.

### 4.6 Ekonomia i zabezpieczenie przed utknięciem
- Start: 50 monet, 4 pola, pszenica odblokowana.
- **Siatka bezpieczeństwa:** jeśli gracz ma mniej monet niż kosztują najtańsze nasiona i nie ma nic do sprzedania ani nic rosnącego, dostaje darmową garść nasion pszenicy, a zimą (gdy nie da się sadzić) zamiast nasion 5 pszenicy do magazynu i 20 monet. Dzięki temu zwierzęta mają paszę i jest co sprzedać. **[decyzja projektanta]** Zima nie może być godziną bez zajęcia: gracz ma zwierzęta, konie i zakupy działek, a w kolejnych etapach dojdzie szklarnia. Wynika to z wymogu „straty, ale do odrobienia”.

### 4.7 Maszyny
- Wersja 1: **jedna maszyna, traktor** (level 8 **[do strojenia]**). Podlewa i zbiera cały rząd 4 pól jednym stuknięciem. **[decyzja projektanta: wybór maszyny]**

### 4.8 Działki
- Mapa ma stały rozmiar (np. 16×16 kafelków), ale na starcie odblokowany jest tylko mały fragment. Kolejne działki (np. 4×4) **kupuje się za monety**, a część wymaga levelu. Zablokowane działki są przyciemnione i mają ikonę kłódki z ceną.
- Na działkach stawia się pola uprawne, kurnik, obórkę i stajnię (przez sklep, z wyborem miejsca na mapie).

### 4.9 Levele i XP
- XP za akcje: sadzenie 1, zbiór 2, zebranie produktu zwierzęcia 2, sprzedaż źrebaka 10, zakup budynku lub działki 5 **[do strojenia]**.
- **Krzywa postępu [ustalone: najpierw szybko, potem wolniej]:** levele 1–3 w pierwszej sesji (około 5–10 minut na level), levele 4–6 w ciągu kolejnych 2–3 sesji, levele 7–10 to po 1–2 sesje na level. Wersja 1 ma **10 leveli** i starcza na około **8–12 godzin gry**, czyli dwa do trzech tygodni przy 30–60 minutach dziennie. W tym czasie dziecko przechodzi mniej więcej cały rok w grze, łącznie z zimą. **[decyzja projektanta, do strojenia]** XP do następnego levelu rośnie mniej więcej geometrycznie (×1,6 na level).
- Awans to krótka animacja, „Poziom N!” i obrazek tego, co się odblokowało.

Plan odblokowań (wersja 1):

| Lvl | Odblokowanie |
|---|---|
| 1 | Pszenica, 4 pola |
| 2 | Marchew, możliwość kupna działek |
| 3 | Kurnik, kury |
| 4 | Kukurydza |
| 5 | Obórka, krowy |
| 6 | Dynia |
| 7 | Stajnia, konie: Kuc |
| 8 | Traktor, koń Arab |
| 9 | Rozbudowa zagród |
| 10 | Koń Fryz |

### 4.10 Cel gry
Gra jest **otwarta** (bez ekranu „koniec”). Cel „duża farma” wyrażają levele i odblokowane działki. **[decyzja projektanta]** Kolejne etapy dokładają levele powyżej 10.

---

## 5. Etapy po wersji 1 (poza zakresem, dla kierunku)
Więcej roślin (ziemniaki, rzepak, słonecznik, truskawki), owce i świnie, przetwórnie (młyn → mąka, mleczarnia → ser), więcej maszyn (siewnik, kombajn), zamówienia od klientów, więcej ras koni, dźwięki i muzyka, ewentualne opcje dla rodzica.

---

## 6. Do decyzji budującego
- Struktura kodu, podział na sceny i moduły, format zapisu (z numerem wersji na przyszłe migracje).
- Dokładne rozmiary sprite'ów i paleta (w ramach 3.1).
- Algorytm losowania pogody i chorób (w ramach podanych częstotliwości).
- Animacje i drobne efekty („+3” wylatujące nad polem, podskok przy zbiorze).
- Testy: logikę gry (wzrost, plony, choroby, ekonomia, pory roku) trzymać poza Phaserem, żeby dało się ją testować jednostkowo, np. Vitest. Do testów i podglądu potrzebny jest tryb przyspieszonego czasu.

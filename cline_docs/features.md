# Funkciók és Parancsok (Részletes)

## Szolgálatkezelés

### `/szolgalat`
- Szolgálati irányítópult gombokkal:  
  - Szolgálat kezdése  
  - Szolgálat befejezése  
  - Saját statisztikák megtekintése  
- Jogosultság: Adminisztrátor vagy szolgálati szerep

---

## Adminisztráció

### `/szolgadmin`
- **add**: Szolgálati idő hozzáadása felhasználónak (admin)
- **edit**: Szolgálati idő szerkesztése (admin)
- **delete**: Szolgálati idő törlése (admin)
- **permission_role**: Jogosultsági szerep beállítása (admin)
- **status_role**: Aktív szolgálati szerep beállítása (admin) 
- **requirement**: Kötelező szolgálati idő/hét beállítása (admin)
- **notification**: E-mail/csatorna értesítések beállítása (admin)
- **settings**: Beállítások lekérdezése (admin)
- **find**: Felhasználó szolgálati időinek keresése (admin)
- **export**: Szolgálati idők exportálása CSV-be (admin)

---

## Szolgálati Figyelmeztetések

### `/szolgfigyelo`
- **config**: Figyelmeztetés beállítása (admin)
- **status**: Figyelmeztetés beállításainak lekérdezése (admin)
- **disable**: Figyelmeztetések kikapcsolása (admin)
- **reminder**: Felhasználói emlékeztetők beállítása

---

## Jelentések

### `/dutyreport`
- **schedule**: Automatikus jelentés ütemezése (admin)
- **list**: Ütemezett jelentések listázása (admin)
- **remove**: Ütemezett jelentés törlése (admin)

---

## Szolgálati Beosztás

### `/beosztas`
- **create**: Új beosztás létrehozása (admin)
- **list**: Elérhető beosztások listázása
- **view**: Beosztás részleteinek megtekintése
- **signup**: Jelentkezés beosztásra
- **cancel**: Jelentkezés visszavonása
- **delete**: Beosztás törlése (admin)

---

## Névsor / Roster

### `/dutyregisztracio`
- Saját szolgálati profil regisztrációja (név, fedőnév, jelvényszám, telefonszám)

### `/roster`
- **list**: Az összes regisztrált felhasználó listázása, táblázatos formában
- **search**: Keresés név, fedőnév vagy jelvényszám alapján a névsorban
- **remove**: Felhasználó regisztrációjának törlése (admin)

---

## Szabadság / Elfoglaltság

### `/vakacio`
- **hozzaad**: Új szabadság vagy elfoglaltság rögzítése saját magadnak
- **listaz**: Saját szabadságok/elfoglaltságok listázása
- **torol**: Saját szabadság/elfoglaltság törlése azonosító alapján
- **admin-listaz**: Minden felhasználó szabadságának/elfoglaltságának listázása (admin)
- **admin-torol**: Bármely szabadság/elfoglaltság törlése azonosító alapján (admin)

---

## Statisztikák és megfelelőség

### `/szolgstat`
- **summary**: Összesített szolgálati statisztikák (időkeret, felhasználó szerint)
- **leaderboard**: Toplista a legtöbb szolgálati idővel
- **metrics**: Részletes szolgálati metrikák (átlag, medián, csúcsidők)
- **compliance**: Követelményeknek való megfelelés ellenőrzése

---

## Személyes szolgálati adatok

### `/szemelyiszolgalat`
- **history**: Saját szolgálati előzmények megtekintése
- **export**: Saját szolgálati idő exportálása CSV-be
- **rank**: Saját helyezés megtekintése a toplistán
- **requirements**: Elvárt szolgálati idő követelmények ellenőrzése

---

## Súgó

### `/segitseg`
- A bot összes parancsának és jogosultságainak rövid áttekintése, magyar nyelvű leírással

---

## Egyéb

- Admin parancsok csak rendszergazdai jogosultsággal érhetőek el.

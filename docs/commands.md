# Parancsok Részletes Leírása

Ez a dokumentum részletezi a Duty Bort parancsait és alparancsait. A legtöbb parancs használatához adminisztrátori jogosultság vagy a szerver beállításaiban megadott szolgálati szerepkör (`dutyRoleId`) szükséges.

## `/duty`

Alapvető szolgálatkezelési parancs. Gombokat jelenít meg a szolgálat indításához, leállításához és az aktuális szolgálati idő lekérdezéséhez.

*   **Jogosultság:** Adminisztrátor vagy szolgálati szerepkör.
*   **Gombok:**
    *   `Szolgálat kezdése`: Elindítja a szolgálati idő mérését.
    *   `Szolgálat befejezése`: Leállítja az aktuális szolgálati idő mérést.
    *   `Szolgálati idő`: Megjeleníti az aktuális, folyamatban lévő szolgálat idejét.

## `/dutyadmin`

Adminisztratív parancsok a szolgálatkezeléshez.

*   **Jogosultság:** Csak adminisztrátor.
*   **Alparancsok:**
    *   `add`: Manuálisan hozzáad egy befejezett szolgálati időszakot egy felhasználóhoz (felhasználó, kezdés YYYY-MM-DD HH:MM, befejezés YYYY-MM-DD HH:MM megadásával).
    *   `edit`: Meglévő szolgálati időszak kezdő vagy befejező időpontját módosítja (szolgálati időszak ID alapján).
    *   `delete`: Töröl egy szolgálati időszakot (szolgálati időszak ID és megerősítés alapján).
    *   `role`: Beállítja azt a szerepet, amely szükséges a `/duty` és más szolgálati parancsok használatához.
    *   `status_role`: Beállítja azt a szerepet, amelyet a bot automatikusan hozzáad/eltávolít a szolgálatban lévő felhasználóktól.
    *   `requirements`: Beállítja a heti/havi minimális szolgálati idő követelményeket (órában) és az értesítési csatornát, valamint be/ki kapcsolja a követelmények figyelését.
    *   `find`: Kilistázza egy adott felhasználó legutóbbi szolgálati időszakait (ID, kezdés, befejezés, időtartam).

## `/dutyalarm`

Szolgálati idő figyelmeztetések és emlékeztetők beállítása.

*   **Jogosultság:** Adminisztrátor vagy szolgálati szerepkör.
*   **Alparancsok:**
    *   `config`: Beállítja, hány óra folyamatos szolgálat után küldjön a bot figyelmeztetést egy megadott csatornára (adminoknak).
    *   `status`: Megjeleníti az admin figyelmeztetések és a felhasználói emlékeztetők jelenlegi beállításait (aktív/inaktív, időkorlát, csatorna).
    *   `disable`: Kikapcsolja az admin figyelmeztetéseket.
    *   `reminder`: Beállítja, hány óra folyamatos szolgálat után küldjön a bot privát üzenetben emlékeztetőt a szolgálatban lévő felhasználónak, és be/ki kapcsolja ezt a funkciót.

## `/dutyshift`

Szolgálati beosztások kezelése.

*   **Jogosultság:** Adminisztrátor vagy szolgálati szerepkör (kivéve `create` és `delete`, ami csak admin).
*   **Alparancsok:**
    *   `create` (csak admin): Új beosztást hoz létre címmel, kezdő és befejező időponttal, valamint maximális létszámmal. Gombot is megjelenít a könnyű jelentkezéshez.
    *   `list`: Kilistázza az összes jövőbeli, elérhető beosztást a szerveren (ID, cím, időpont, időtartam, létszám, és hogy a felhasználó jelentkezett-e).
    *   `view`: Megjeleníti egy adott beosztás részleteit (ID alapján), beleértve a jelentkezők listáját. Gombokat is mutat a jelentkezéshez/visszavonáshoz.
    *   `signup`: Lehetővé teszi a felhasználónak, hogy jelentkezzen egy beosztásra (ID alapján).
    *   `cancel`: Lehetővé teszi a felhasználónak, hogy visszavonja a jelentkezését egy beosztásról (ID alapján).
    *   `delete` (csak admin): Töröl egy beosztást (ID és megerősítés alapján).

## `/dutystats`

Szolgálati idő statisztikák lekérdezése.

*   **Jogosultság:** Adminisztrátor vagy szolgálati szerepkör.
*   **Alparancsok:**
    *   `summary`: Összesített statisztikákat mutat (összes idő, felhasználók száma, szolgálatok száma, aktív szolgálatban lévők) egy adott időkeretre (napi, heti, havi, összes, egyéni dátumokkal). Opcionálisan szűrhető egy adott felhasználóra.
    *   `leaderboard`: Ranglistát készít a legtöbb szolgálati idővel rendelkező felhasználókról a megadott időkeretben. Megadható a megjelenítendő felhasználók száma.
    *   `metrics`: Részletesebb metrikákat jelenít meg (átlagos/medián szolgálati idő, legnépszerűbb napok/órák) a megadott időkeretben.

## `/dutyuser`

Felhasználóspecifikus szolgálati információk és műveletek.

*   **Jogosultság:** Adminisztrátor vagy szolgálati szerepkör.
*   **Alparancsok:**
    *   `history`: Megjeleníti a felhasználó saját legutóbbi befejezett szolgálatait, az összesített idejét és az esetlegesen folyamatban lévő szolgálatát. Megadható a listázandó előzmények száma.
    *   `export`: A felhasználó szolgálati időszakait exportálja CSV fájlba egy megadott időkeretre (heti, havi, éves, összes). A fájlt privát üzenetben küldi el.
    *   `rank`: Megjeleníti a felhasználó helyezését a szolgálati idő toplistán a megadott időkeretben, valamint a környező helyezetteket.
    *   `requirements`: Ellenőrzi és megjeleníti, hogy a felhasználó hogyan áll a szerveren beállított heti és havi szolgálati idő követelmények teljesítésével (ha be vannak kapcsolva).

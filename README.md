# Duty Bort

Egy Discord bot szolgálatok és kapcsolódó feladatok kezelésére.

## Leírás

Ez a projekt egy TypeScript és Node.js segítségével készült Discord bot ("Duty Bort") szolgálatok, műszakok, riasztások, statisztikák és kapcsolódó adminisztratív feladatok kezelésére Discord szervereken. A Discord.js v14 könyvtárat és a Prisma ORM-et használja PostgreSQL adatbázissal.

## Telepítés

1.  **Klónozd a tárolót:**
    ```bash
    git clone <repository-url> # Cseréld le a tényleges URL-re
    cd duty-bort
    ```
2.  **Telepítsd a függőségeket:**
    ```bash
    npm install
    ```
3.  **Állítsd be a környezeti változókat:**
    Hozz létre egy `.env` fájlt a gyökérkönyvtárban a `.env.example` alapján. Add meg a szükséges értékeket:
    *   `DISCORD_TOKEN`: A Discord botod tokenje.
    *   `DATABASE_URL`: A PostgreSQL adatbázisod kapcsolati URL-je (pl. `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`).
    *   `DUTY_ROLE_ID`: Annak a Discord szerepnek az ID-ja, amely alapértelmezetten jogosult a szolgálati parancsok használatára (az adminisztrátorok mindig jogosultak). Ezt a `/dutyadmin permission_role` paranccsal felül lehet bírálni szerverenként.
    *   `ALLOWED_SERVER_IDS` (Opcionális): Vesszővel elválasztott lista azokról a Discord szerver ID-król, ahol a bot működhet. Hagyd üresen vagy állítsd `*`-ra, hogy minden szerveren engedélyezett legyen.
    ```bash
    cp .env.example .env
    # Szerkeszd a .env fájlt a saját adataiddal
    ```
4.  **Állítsd be az adatbázist:**
    Futtasd a Prisma migrációkat az adatbázis séma létrehozásához/frissítéséhez, majd generáld a Prisma Clientet.
    ```bash
    npx prisma migrate dev
    npx prisma generate
    ```
    *Megjegyzés: Produkciós környezetben használd a `npx prisma migrate deploy` parancsot.*

## Használat

1.  **Parancsok telepítése (deploy):**
    Regisztráld a slash parancsokat a Discorddal azokon a szervereken, ahol használni szeretnéd a botot. Ezt általában egyszer kell megtenni, vagy amikor a parancsdefiníciók megváltoznak.
    ```bash
    npm run deploy
    ```
2.  **A bot indítása:**
    *   **Fejlesztéshez (automatikus újraindítással):**
        ```bash
        npm run dev
        ```
    *   **Produkcióhoz:**
        Először buildeld a TypeScript kódot:
        ```bash
        npm run build
        ```
        Majd indítsd el a lefordított kódot:
        ```bash
        npm start
        ```

## Parancsok

A bot a következő fő parancsokat és alparancsokat tartalmazza:

*   **/duty**: Szolgálati irányítópult megjelenítése gombokkal (Start/End/Show Time).
    *   *Jogosultság:* Adminisztrátor vagy a beállított `permission_role`.
*   **/dutyadmin**: Adminisztratív parancsok.
    *   `add`: Szolgálati idő manuális hozzáadása.
    *   `edit`: Szolgálati idő szerkesztése ID alapján.
    *   `delete`: Szolgálati idő törlése ID alapján.
    *   `permission_role`: A szolgálati parancsok használatához szükséges szerep beállítása.
    *   `status_role`: Az aktív szolgálat alatt automatikusan adott/elvett szerep beállítása.
    *   `check`: Jelenlegi szerep, csatorna és bot jogosultság beállítások ellenőrzése.
    *   `requirements`: Heti/havi szolgálati idő követelmények beállítása.
    *   `find`: Szolgálati időszakok keresése felhasználónként.
    *   `notifications_channel`: Szolgálati értesítések (start/stop) csatornájának beállítása.
    *   `export`: Szolgálati idők exportálása adott időszakra (opcionális törléssel).
    *   *Jogosultság:* Adminisztrátor.
*   **/dutyalarm**: Figyelmeztetések és emlékeztetők kezelése.
    *   `config`: Hosszú szolgálati idő figyelmeztetés beállítása (idő, csatorna).
    *   `status`: Jelenlegi figyelmeztetés/emlékeztető beállítások megtekintése.
    *   `disable`: Figyelmeztetések kikapcsolása.
    *   `reminder`: Felhasználói DM emlékeztető beállítása (idő, engedélyezés).
    *   *Jogosultság:* Adminisztrátor vagy a beállított `permission_role`.
*   **/dutyshift**: Szolgálati műszakok kezelése.
    *   `create`: Új műszak létrehozása (admin only).
    *   `list`: Közelgő műszakok listázása.
    *   `view`: Egy műszak részleteinek és jelentkezőinek megtekintése.
    *   `signup`: Jelentkezés egy műszakra.
    *   `cancel`: Jelentkezés visszavonása.
    *   `delete`: Műszak törlése (admin only).
    *   *Jogosultság:* `create`/`delete`: Adminisztrátor; `list`/`view`/`signup`/`cancel`: Adminisztrátor vagy a beállított `permission_role`.
*   **/dutystats**: Adminisztratív statisztikák.
    *   `summary`: Összesített statisztikák adott időszakra (opcionálisan felhasználóra szűrve).
    *   `leaderboard`: Toplista adott időszakra.
    *   `metrics`: Részletes metrikák (átlag, medián, csúcsidők) adott időszakra.
    *   *Jogosultság:* Adminisztrátor vagy a beállított `permission_role`.
*   **/dutyuser**: Személyes szolgálati információk.
    *   `history`: Saját szolgálati előzmények listázása.
    *   `export`: Saját szolgálati idők exportálása CSV-be.
    *   `rank`: Saját helyezés megtekintése a toplistán.
    *   `requirements`: Saját haladás ellenőrzése a követelményekhez képest.
    *   *Jogosultság:* Adminisztrátor vagy a beállított `permission_role`.
*   **/help**: Súgó megjelenítése a parancsokról.
    *   *Jogosultság:* Bárki.

*(Részletesebb parancsdokumentációért lásd: `docs/commands.md` - ha létezik)*

## Hozzájárulás

Szívesen fogadjuk a hozzájárulásokat! Kérjük, kövesd a standard fork & pull request munkafolyamatokat. Győződj meg róla, hogy a kód megfelel a projekt stílusútmutatóinak (ESLint/Prettier), tartalmaz JSDoc kommenteket, és ahol szükséges, tartalmaz teszteket (Jest).

## Licenc

MIT Licenc

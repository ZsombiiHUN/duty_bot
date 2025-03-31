# Duty Bort

Egy Discord bot szolgálatok és kapcsolódó feladatok kezelésére.

## Leírás

Ez a projekt egy TypeScript és Node.js segítségével készült Discord botnak tűnik. Parancsokat tartalmaz szolgálatok, műszakok, riasztások, felhasználói adminisztráció és statisztikák kezelésére. Valószínűleg a Discord.js-t és a Prismát használja adatbázis-interakciókhoz.

## Telepítés

1.  **Klónozd a tárolót:**
    ```bash
    git clone <repository-url>
    cd duty-bort
    ```
2.  **Telepítsd a függőségeket:**
    ```bash
    npm install
    ```
3.  **Állítsd be a környezeti változókat:**
    Hozz létre egy `.env` fájlt a `.env.example` alapján vagy a szükséges változókkal (pl. `DISCORD_TOKEN`, `DATABASE_URL`).
    ```bash
    cp .env.example .env
    # Szerkeszd a .env fájlt a saját adataiddal
    ```
4.  **Állítsd be az adatbázist:**
    Futtasd a Prisma migrációkat az adatbázis séma beállításához.
    ```bash
    npx prisma migrate dev
    ```

## Használat

1.  **Parancsok telepítése (deploy):**
    Regisztráld a slash parancsokat a Discorddal.
    ```bash
    npm run deploy # Feltételezve, hogy létezik egy script a package.json-ben
    # vagy
    # node build/deploy-commands.js # Szükség esetén módosítsd az elérési utat
    ```
2.  **Indítsd el a botot:**
    ```bash
    npm start # Feltételezve, hogy létezik egy start script a package.json-ben
    # vagy
    # node build/index.js # Szükség esetén módosítsd az elérési utat
    ```

## Parancsok

A bot a következő parancskategóriákat tartalmazza (a fájlstruktúra alapján):

*   `/duty`: Alapvető szolgálatkezelési parancsok.
*   `/dutyadmin`: Adminisztratív parancsok a szolgálatkezeléshez.
*   `/dutyalarm`: Szolgálati riasztásokkal vagy értesítésekkel kapcsolatos parancsok.
*   `/dutyshift`: Konkrét műszakok kezelésére szolgáló parancsok.
*   `/dutystats`: Szolgálati statisztikák megtekintésére szolgáló parancsok.
*   `/dutyuser`: Felhasználóspecifikus szolgálati parancsok.

*(Részletesebb parancsdokumentáció itt vagy a `docs` könyvtárban adható hozzá.)*

## Hozzájárulás

Szívesen fogadjuk a hozzájárulásokat! Kérjük, kövesd a standard fork & pull request munkafolyamatokat. Győződj meg róla, hogy a kód megfelel a projekt szabványainak, és ahol szükséges, tartalmaz teszteket.

## Licenc

(Itt add meg a licencet, pl. MIT, Apache 2.0, stb.)

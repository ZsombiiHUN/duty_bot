# Duty Bot Discord Bot

[![License](https://img.shields.io/github/license/ZsombiiHUN/duty_bot)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/ZsombiiHUN/duty_bot)](https://github.com/ZsombiiHUN/duty_bot/issues)
[![GitHub stars](https://img.shields.io/github/stars/ZsombiiHUN/duty_bot)](https://github.com/ZsombiiHUN/duty_bot/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ZsombiiHUN/duty_bot)](https://github.com/ZsombiiHUN/duty_bot/network)
[![GitHub last commit](https://img.shields.io/github/last-commit/ZsombiiHUN/duty_bot)](https://github.com/ZsombiiHUN/duty_bot/commits/main)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/ZsombiiHUN/duty_bot)](https://github.com/ZsombiiHUN/duty_bot/pulls)
[![GitHub contributors](https://img.shields.io/github/contributors/ZsombiiHUN/duty_bot)](https://github.com/ZsombiiHUN/duty_bot/graphs/contributors)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/ZsombiiHUN/duty_bot/graphs/commit-activity)

> **A professional, feature-rich, and fully customizable Discord bot for managing duty rosters, compliance, statistics, and more.**

---

## Features

- **Interactive Duty Management**: Start, end, and review duty sessions with intuitive buttons and rich Discord embeds.
- **Advanced Admin Controls**: Add, edit, delete duty sessions, configure roles, set requirements, and export data with fine-grained permissions.
- **Automated Reporting**: Schedule compliance and leaderboard reports directly to your channels.
- **Comprehensive Statistics**: View summaries, leaderboards, compliance, and detailed metrics for individuals or the whole server.
- **Shift Scheduling**: Create, list, sign up for, and manage duty shifts with capacity controls.
- **Personal Insights**: Export your own duty history, check your rank, and monitor your compliance.
- **Vacation & Unavailability**: Manage personal or server-wide vacation periods with admin and user commands.
- **Registration Roster**: Register, search, and manage user profiles for duty tracking.
- **Multi-language Support**: Hungarian and English documentation, commands, and responses.
- **Secure & Scalable**: Built with Discord.js, Prisma, and PostgreSQL for reliability and performance.

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database
- A Discord bot token ([guide](https://discordjs.guide/preparations/setting-up-a-bot-application.html))

### 1. Clone & Install
```bash
git clone https://github.com/ZsombiiHUN/duty_bot.git
cd duty_bot
npm install
```

### 2. Configure Environment
Create a `.env` file (see `.env.example`) and set:
- `DISCORD_TOKEN` = your Discord bot token
- `DATABASE_URL` = your PostgreSQL connection string
- `DUTY_ROLE_ID` = the role ID for duty eligibility
- *(Optional: `ALLOWED_SERVER_IDS`, `CLIENT_ID`, etc.)*

### 3. Database Setup
```bash
npx prisma migrate deploy
```

### 4. Deploy Commands to Discord
```bash
npm run deploy-commands
```

### 5. Start the Bot
```bash
npm start
```

### 6. First-Time Setup (Discord)
Use `/setup` as an admin to configure roles, channels, requirements, and notifications interactively.

---

## Usage Overview

### Main Commands

| Command                | Description                                                      | Permissions                  |
|------------------------|------------------------------------------------------------------|------------------------------|
| `/szolgalat`           | Duty dashboard (start/end/show time)                             | Duty role or Admin           |
| `/szolgadmin`          | Admin: manage sessions, roles, requirements, export, etc.        | Admin                        |
| `/szolgfigyelo`        | Configure alarms, reminders                                      | Duty role or Admin           |
| `/dutyreport`          | Schedule/list/remove automated reports                          | Admin                        |
| `/beosztas`            | Create/list/view/sign up/cancel/delete shifts                   | Mixed (see below)            |
| `/szolgstat`           | View stats, leaderboards, compliance                            | Admin                        |
| `/szemelyiszolgalat`   | Personal duty info, export, rank, compliance                    | Duty role or Admin           |
| `/vakacio`             | Manage vacation/unavailability                                  | User/Admin                   |
| `/roster`              | Registration roster: list/search/remove users                   | Admin                        |
| `/dutyregisztracio`    | Register yourself for duty tracking                             | Anyone                       |
| `/segitseg`            | Get help and command list                                       | Anyone                       |
| `/setup`               | Interactive setup wizard                                        | Admin                        |

> **Tip:** Use `/segitseg` in Discord for a full, always-up-to-date command and permission list in Hungarian.

#### Permissions Breakdown
- **Admin**: Full access to all commands and settings
- **Duty Role**: Access to duty management, shifts, and personal info
- **Anyone**: Registration and help

---

## Hungarian (Magyar) Leírás

### Duty Bot – Magyar Leírás

[![License](https://img.shields.io/github/license/ZsombiiHUN/duty_bot)](LICENSE)

> **Professzionális, funkciógazdag és teljesen testreszabható Discord bot szolgálati idő, beosztások, megfelelőség, statisztikák és közösségi adminisztráció kezelésére.**

### Főbb Funkciók

- **Interaktív szolgálatkezelés**: Szolgálat indítása, befejezése, aktuális idő megtekintése gombokkal, modern Discord embedekkel.
- **Haladó adminisztráció**: Szolgálati idők hozzáadása, szerkesztése, törlése, szerepkörök és követelmények beállítása, exportálás, teljes körű jogosultságkezelés.
- **Automatikus jelentések**: Compliance/toplista/összesítő jelentések ütemezése és automatikus küldése csatornákra.
- **Részletes statisztikák**: Összesítés, toplista, megfelelőség, részletes metrikák személyre vagy szerverre szabva.
- **Beosztáskezelés**: Műszakok létrehozása, listázása, jelentkezés, lemondás, kapacitáskezelés.
- **Személyes statisztikák**: Saját szolgálati előzmények exportja, toplista helyezés, megfelelőség követése.
- **Szabadság/elfoglaltság**: Személyes vagy szerver szintű szabadságok kezelése, admin és felhasználói parancsokkal.
- **Regisztrációs névsor**: Felhasználók regisztrációja, keresése, törlése, adminisztrációja.
- **Többnyelvű támogatás**: Magyar és angol dokumentáció, parancsok és válaszok.
- **Biztonságos és skálázható**: Discord.js, Prisma és PostgreSQL alapokon, stabil működésre tervezve.

### Telepítés & Beállítás

#### Előfeltételek
- Node.js 18+
- PostgreSQL adatbázis
- Discord bot token ([útmutató](https://discordjs.guide/preparations/setting-up-a-bot-application.html))

#### 1. Klónozás & Telepítés
```bash
git clone https://github.com/ZsombiiHUN/duty_bot.git
cd duty_bot
npm install
```

#### 2. Környezeti változók beállítása
Hozz létre egy `.env` fájlt (lásd: `.env.example`) és töltsd ki:
- `DISCORD_TOKEN` = a bot tokened
- `DATABASE_URL` = PostgreSQL kapcsolat string
- `DUTY_ROLE_ID` = szolgálati jogosultság szerep ID-ja
- *(Opcionális: `ALLOWED_SERVER_IDS`, `CLIENT_ID`)*

#### 3. Adatbázis migráció
```bash
npx prisma migrate deploy
```

#### 4. Parancsok regisztrálása Discordon
```bash
npm run deploy-commands
```

#### 5. Bot indítása
```bash
npm start
```

#### 6. Első beállítás Discordon
Adminisztrátorként használd a `/setup` parancsot a szerepek, csatornák, követelmények és értesítések interaktív beállításához.

### Parancsok & Jogosultságok

| Parancs                 | Leírás                                                      | Jogosultság                 |
|-------------------------|-------------------------------------------------------------|-----------------------------|
| `/szolgalat`            | Szolgálati irányítópult (indítás/befejezés/idő megtekintés) | Szolgálati szerep vagy Admin|
| `/szolgadmin`           | Admin: szolgálati idők, szerepek, követelmények, export      | Admin                       |
| `/szolgfigyelo`         | Figyelmeztetések, emlékeztetők beállítása                   | Szolgálati szerep vagy Admin|
| `/dutyreport`           | Automatikus jelentések ütemezése/listázása/törlése          | Admin                       |
| `/beosztas`             | Műszakok létrehozása, listázása, jelentkezés, törlés         | Vegyes (lásd lent)          |
| `/szolgstat`            | Statisztikák, toplisták, megfelelőség                       | Admin                       |
| `/szemelyiszolgalat`    | Személyes szolgálati adatok, export, helyezés, megfelelőség  | Szolgálati szerep vagy Admin|
| `/vakacio`              | Szabadság/elfoglaltság kezelése                             | Felhasználó/Admin           |
| `/roster`               | Névsor: listázás, keresés, törlés                           | Admin                       |
| `/dutyregisztracio`     | Saját regisztráció szolgálathoz                             | Bárki                       |
| `/segitseg`             | Súgó, parancslista                                          | Bárki                       |
| `/setup`                | Interaktív beállítás varázsló                               | Admin                       |

> **Tipp:** A `/segitseg` parancs mindig naprakész, részletes parancs- és jogosultságlistát ad magyarul.

#### Jogosultsági szintek
- **Admin**: Teljes hozzáférés minden parancshoz és beállításhoz
- **Szolgálati szerep**: Szolgálatkezelés, műszakok, saját adatok
- **Bárki**: Regisztráció, súgó

### Hozzájárulás & Közösség

Szívesen fogadjuk a pull requesteket, hibajelentéseket, ötleteket és fordításokat! Lásd a [CONTRIBUTING.md](CONTRIBUTING.md) fájlt.

### Licenc
MIT License. Copyright (c) ZsombiiHUN

### Támogatás / Kapcsolat
- [GitHub Issues](https://github.com/ZsombiiHUN/duty_bot/issues)
---

## Contributing
Pull request-ek, hibajelentések, ötletek és fordítások szívesen fogadva! Lásd a [CONTRIBUTING.md](CONTRIBUTING.md) fájlt.

## License
MIT License. Copyright (c) ZsombiiHUN

## Support / Contact
- [GitHub Issues](https://github.com/ZsombiiHUN/duty_bot/issues)
---

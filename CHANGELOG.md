# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Duty Requirements Reminders: Sends DMs to users and optionally a summary to a configured channel if they are below weekly/monthly duty hour requirements near the end of the period. Runs daily. (`src/tasks/requirementChecker.ts`)
- `/dutyadmin log_channel` subcommand to set/clear a channel for duty start/end logs.
- Automatic logging of duty start/end events to the configured log channel (`dutyLogChannelId` in `GuildSettings`).
- `/dutystats compliance` subcommand to view user compliance with weekly/monthly duty requirements.
- JSDoc comments to utility functions (`dateTimeUtils.ts`), component handlers (`dutyButtons.ts`, `dutyshiftButtons.ts`), and all command files (`duty.ts`, `dutyadmin.ts`, `dutyalarm.ts`, `dutyshift.ts`, `dutystats.ts`, `dutyuser.ts`, `help.ts`).
- Created `CHANGELOG.md`.

### Changed
- Refactored command files (`dutyadmin.ts`, `dutyalarm.ts`, `dutystats.ts`, `dutyuser.ts`) to use the shared Prisma client instance from `src/db.ts`.
- Consolidated duplicated date/time utility functions into `src/utils/dateTimeUtils.ts`.
- Updated `README.md` with more accurate installation, configuration, usage instructions, and a detailed command list.
- Renamed `/dutyadmin role` subcommand to `/dutyadmin permission_role` for clarity and updated descriptions.

### Fixed
- Corrected regular expressions in `parseDateTime` and `parseDate` in `src/utils/dateTimeUtils.ts` to strictly enforce zero-padding.
- Optimized `/dutystats compliance` command by fetching role members via cache instead of fetching all guild members, resolving potential timeouts.
- Removed unused `activeSessionInfo` variable in `handleShowTime` function (`src/components/dutyButtons.ts`).

## [1.0.0] - YYYY-MM-DD
### Added
- Initial project structure.
- Core commands: `/duty`, `/dutyadmin`, `/dutyalarm`, `/dutyshift`, `/dutystats`, `/dutyuser`, `/help`.
- Prisma schema and database setup.
- Basic button handlers for `/duty` and `/dutyshift`.
- Logging setup with Winston.
- Environment variable handling with dotenv.
- Basic README and `.env.example`.
- Cline memory bank files in `cline_docs/`.
- `.clinerules` for project standards.

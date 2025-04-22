# System Patterns

*   **Architecture:** Discord Bot built using the Discord.js library for interaction with the Discord API.
*   **Data Management:** Prisma ORM is used for database interactions, connecting to a PostgreSQL database (as defined in `prisma/schema.prisma`). Data models include `DutySession`, `GuildSettings`, `Shift`, and `Signup`.
*   **Modularity:**
    *   Slash commands are organized into individual files within the `src/commands/` directory.
    *   Interactive components (like buttons) are handled in `src/components/`.
    *   Reusable utility functions (e.g., date/time, logging) are located in `src/utils/`.
*   **Configuration:**
    *   Server-specific (guild) settings are stored in the `GuildSettings` database model, allowing customization per Discord server.
    *   Sensitive configuration (Discord token, database URL) is managed via environment variables loaded from an `.env` file (using `dotenv`).
*   **State Management:**
    *   Active duty periods are tracked using the `DutySession` model.
    *   User participation in scheduled shifts is managed through the `Shift` and `Signup` models.
*   **Background Processing (Inferred):** The system likely requires background tasks (e.g., using `setInterval` or a dedicated scheduler) to periodically check `DutySession` records against `GuildSettings` thresholds for triggering alarms and reminders.
*   **Logging:** Uses the Winston library for application logging (configured in `src/utils/logger.ts`).

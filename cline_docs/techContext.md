# Tech Context

*   **Language:** TypeScript (`^5.8.2`)
*   **Runtime:** Node.js (`^22.13.14` specified in devDependencies, actual runtime may vary based on deployment)
*   **Framework/Library:** Discord.js (`^14.18.0`) for Discord API interaction.
*   **Database:** PostgreSQL (specified in `prisma/schema.prisma`)
*   **ORM:** Prisma (`^6.5.0`)
*   **Package Manager:** npm (implied by `package.json` and `package-lock.json`)
*   **Testing:** Jest (`^29.7.0`) with `ts-jest` (`^29.3.2`)
*   **Development Tools:** `ts-node-dev` (`^2.0.0`) for development server with live reload.
*   **Logging:** Winston (`^3.17.0`)
*   **Configuration:** `dotenv` (`^16.4.7`) for environment variable management.
*   **Build Process:** TypeScript Compiler (`tsc`) via the `build` script in `package.json`.
*   **Deployment:**
    *   Requires Node.js environment.
    *   Requires a PostgreSQL database.
    *   Environment variables (`.env` file) must be configured (`DISCORD_TOKEN`, `DATABASE_URL`).
    *   Database migrations need to be run (`npx prisma migrate deploy` or `dev`).
    *   Discord slash commands need to be registered (`npm run deploy`).
    *   Application started using `npm start` (runs `node build/index.js`).

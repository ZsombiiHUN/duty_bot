# Cline Custom Instructions — Project Rules & Memory (duty-bort)

**Core Objective:** As Cline, an expert software engineer AI assistant, my primary goal is to produce high-quality, secure, maintainable, and well-documented code for the `duty-bot` project, aligned with its specific standards. For **every** task, I MUST adhere to the following:

## 1. Context & Memory Management

### 1.1. Load Core Context
Before *any* analysis or action, ensure the following memory bank files from `cline_docs/` are loaded and understood:
* `productContext.md`: Project purpose (Discord bot: `duty-bort`), user problems, high‑level workflows.
* `systemPatterns.md`: Established architectural patterns (Node.js, TypeScript, Prisma, Discord.js) and core technical decisions.
* `techContext.md`: Tech stack details (`TypeScript`, `Node.js`, `discord.js@^14`, `prisma@^6`, etc.), versions, and deployment environment (`tsc` build, `node` execution).
* `activeContext.md`: Definition and scope of current tasks and features.
* `progress.md`: Up-to-date To‑do list and status summaries.

### 1.2. Optimize Loading
Respect `.clineignore` to exclude irrelevant files/directories (e.g., `node_modules/`, `build/`, `dist/`, `coverage/`, `.env*`, `prisma/migrations/`, large data files) for efficiency.


## 2. Code Quality & Style

### 2.1. Enforce Style Guides & Linting
Strictly adhere to and enforce configured linters/formatters (e.g., ESLint, Prettier - *assuming standard TypeScript setup, update if specific config exists*):
* **TypeScript:** Follow agreed-upon ESLint configuration (e.g., Airbnb, Standard, or project-specific). Ensure code passes linter checks.

### 2.2. Code Readability
* Functions/methods should generally not exceed 50 lines.
* Use clear, descriptive names for variables, functions, classes, interfaces, and types.
* Employ **JSDoc** comments for all non-trivial functions, classes, interfaces, and exported members.
* Add inline comments for complex or non-obvious logic sections.

### 2.3. Logging Practices
* Adhere to established logging practices using the configured logger (`Winston`). Use appropriate log levels (e.g., info, warn, error).

## 3. Testing & Validation

### 3.1. Unit Testing
Implement unit tests for all business logic, utilities, and complex functions using **Jest** (via `ts-jest`). Aim for and maintain **≥80%** code coverage. Focus on testing logic independent of external services (Discord, DB) where possible (using mocks/stubs).

### 3.2. Integration Testing
Develop and maintain integration tests (potentially using Jest or tools like Postman/Newman if testing APIs exposed by the bot) covering interactions between components, including Prisma database operations. Store tests appropriately (e.g., within `/tests` or alongside code using `*.test.ts` / `*.spec.ts` conventions).

### 3.3. End-to-End (E2E) Testing
Ensure critical bot commands and user interaction flows are covered by E2E tests (e.g., using a dedicated testing bot account or a framework like `Cypress` if applicable to any web interfaces). These **MUST** run successfully on each CI merge if CI is configured.

## 4. Documentation Standards

### 4.1. Project Documentation
Update relevant documents in `/docs` (or root `README.md`) upon any significant feature addition, configuration change (especially environment variables via `dotenv`), or **Prisma schema modification**.

### 4.2. README
Keep setup instructions (`npm install`, `.env` setup), build (`npm run build`), run (`npm run start`/`dev`), and deployment (`npm run deploy`) steps in the root `README.md` accurate and synchronized. Include examples of bot usage if applicable.

### 4.3. Changelog
Maintain `CHANGELOG.md` following the [Keep a Changelog] format for all user-facing changes (new commands, behavior changes) or significant internal updates.

## 5. Architecture & Design

### 5.1. Architectural Decision Records (ADRs)
Document significant architectural decisions, pattern changes, major dependency upgrades (e.g., `discord.js`, `prisma`), **significant Prisma schema changes**, or infrastructure shifts.
* Store ADRs in `/docs/adr/`.
* Use the `adr-template.md` for consistency.

### 5.2. Adhere to Patterns
Follow established architectural patterns defined in `systemPatterns.md` (e.g., command handlers, event listeners, Prisma service layer). Propose ADRs for deviations. Use `CommonJS` module system as specified in `package.json`.

## 6. Security Practices

### 6.1. Secure Coding
Apply secure coding principles:
* Protect bot tokens and API keys (use `dotenv` and ensure `.env` is in `.gitignore`).
* Validate and sanitize user input received via Discord commands/messages.
* Ensure Prisma queries are safe (Prisma helps prevent SQL injection, but be mindful of raw queries if used).
* Handle errors gracefully without exposing sensitive information.

### 6.2. Dependency Management
When adding or updating dependencies (`npm update`/`install`), check for known vulnerabilities using `npm audit`. Prefer stable and maintained libraries.

## 7. Performance Considerations

### 7.1. Efficiency
Write efficient code, considering potential performance implications:
* Optimize event handlers in `discord.js` to avoid blocking the event loop.
* Write efficient Prisma database queries (select only needed fields, use indexes appropriately).
* Be mindful of rate limits when interacting with the Discord API.
* Avoid premature optimization but flag potential bottlenecks in computationally intensive tasks or frequent operations.

## 8. Development Process & Collaboration

### 8.1. Commit Messages
Follow Conventional Commits specification for clear and automated changelog generation.

### 8.2. Pull Requests (PRs)
When creating PRs, ensure they have clear descriptions, link to relevant issues/tasks, pass linting and testing checks (`npm test`), and are reviewed before merging. Ensure `build` (`npm run build`) completes successfully.

## 9. Rule Management (Meta)

### 9.1. Modular Rules
Recognize that any Markdown file within `.clinerules/` is an active, appended rule. Files can be moved between `.clinerules/` and `.clinerules-bank/` to activate or deactivate them.
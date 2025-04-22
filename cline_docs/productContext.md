# Product Context

*   **Why this project exists:** To provide a Discord bot ("Duty Bort") for managing on-duty personnel, shifts, and related administrative tasks within Discord servers.
*   **User problems:**
    *   Tracking who is currently on duty.
    *   Managing scheduled shifts and signups.
    *   Notifying users or channels about long duty sessions (alarms).
    *   Reminding users about upcoming duty requirements.
    *   Calculating and reporting duty statistics.
    *   Administering duty-related roles and settings per server.
*   **High-level workflows:**
    *   Users start/end duty sessions (`/duty start`, `/duty end`).
    *   Admins configure server-specific settings (roles, channels, thresholds) (`/dutyadmin`).
    *   Admins create scheduled shifts (`/dutyshift create`).
    *   Users sign up for shifts (`/dutyshift signup`).
    *   The bot automatically sends alarms/reminders based on configured thresholds.
    *   Users/Admins view duty statistics (`/dutystats`).

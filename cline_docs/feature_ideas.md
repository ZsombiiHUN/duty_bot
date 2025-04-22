# New Feature Ideas for Duty Bort

## 1. Duty Swap Requests
Allow users to request a shift swap with another user. The bot can facilitate approval and update the schedule. Adds flexibility for users who can't make a shift. Includes interactive buttons for "accept/decline swap".

## 2. On-Call Escalation System
If a duty session is missed or a shift is left unfilled, the bot escalates by notifying backup users or admins. Ensures coverage and accountability. Integrates with role priorities or escalation lists.

## 3. Duty Leaderboard & Gamification ✅ Done
Introduce a leaderboard showing top contributors (e.g., most hours, most shifts, best compliance). Adds motivation and recognition. `/dutyleaderboard` command and periodic summary posts.

## 4. Customizable Automated Reports ✅ Done
Allow admins to schedule automated duty/compliance reports to be posted in a channel (weekly, monthly, etc). Reduces manual checking and keeps teams informed. Uses Discord embeds for rich formatting.

## 5. Mobile-Friendly Reminders (DM Opt-In) 
Let users opt in to receive direct message reminders for their shifts or duty requirements, with snooze options. Improves user experience for mobile users. Adds a `/dutyreminders` or `/dutyoptin` command.

## 6. Integration with External Calendars
Export duty schedules to Google Calendar or iCal, or allow users to subscribe to a calendar feed. Helps users manage their time and avoid conflicts. Could be a `/dutyschedule export` command.

## 7. Anonymous Feedback for Admins
Add a `/dutyfeedback` command for users to send anonymous suggestions or concerns to admins. Improves community engagement and bot improvement.

## 8. Emergency Broadcast Feature
Admins can trigger an "emergency" message to all on-duty or on-call users (e.g., urgent coverage needed). Ensures rapid response in critical situations.

## 9. Multi-Language (Hungarian) Support ✅ Done
All user-facing commands, responses, and help texts are now available in Hungarian. Improves accessibility for Hungarian-speaking teams.

## 10. Vacation/Unavailable Tracking ✅ Done
Users can mark themselves as unavailable for certain dates, and the bot will avoid assigning or reminding them for those periods. Reduces scheduling conflicts.

## 11. Unavailability Integration in Reports ✅ Done
Leaderboard, compliance, and all automated reports now automatically ignore users who are marked as unavailable during the report period. Ensures fairness and accurate statistics.

## 12. Enhanced Vacation Command ✅ Done
A `/vakacio` command (Hungarian) allows users to add, list, and remove their own unavailable periods, with ephemeral and privacy-respecting feedback.

## 13. Future Ideas
- **Custom Duty Types:** Allow admins to define different types of duties (e.g., on-call, standby, remote), each with unique requirements or reminders.
- **Shift Sign-Up Limits:** Limit how many shifts a user can sign up for in a given period, to ensure fair distribution.
- **Overtime Alerts:** Notify users/admins if someone is approaching overtime or exceeding healthy limits.
- **Role-Based Reminders:** Allow certain reminders or requirements to only apply to specific Discord roles.
- **Admin Analytics Dashboard:** Web-based dashboard for admins to view stats, trends, and export data.
- **API/Webhooks:** Allow external systems to query duty status or push events (e.g., via REST API or Discord webhooks).

---

*Last updated: 2025-04-22*

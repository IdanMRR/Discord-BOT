**Project Design Requirements (PDR): Unified Discord Bot Dashboard System**

---

**1. Overview:**
This document outlines the requirements for building a unified dashboard system for a Discord bot. The system will consolidate all bot features—analytics, logs, warnings, tickets, level system, settings, and more—under a structured, server-specific user interface. The design should prioritize simplicity, clarity, and efficient management of multiple servers.

> 📌 **Note to Reader:**
> You are assumed to be familiar with the bot and dashboard project. Still, it's highly recommended to read through this document carefully from the beginning to ensure alignment with the final implementation.

> 🔧 **Current Bot Stack:**
> - The bot is currently powered by **SQLite** as its primary database.
> - The dashboard communicates with the bot backend via a secure **API Key system**.

---

**2. Core Features:**

### 2.1 Server Selection Logic:
- When a user logs in, the dashboard will detect which servers they share with the bot.
- If the user is in **one** shared server with the bot → auto-redirect to that server’s dashboard.
- If the user is in **multiple** servers → show a server selection screen.
- The system uses an **existing Admin Panel** that allows the bot owner to manually assign dashboard access rights. This grants full flexibility beyond standard Discord permissions.

### 2.2 Modular Categories (All Nested Under Server Context):
Each module listed below is scoped to a specific selected server and presented through a **dynamic interface** based on the server selected by the user.

#### A. Analytics:
- Member join/leave graph.
- Message activity graph.
- Ticket usage stats.
- Warning history stats.
- Level distribution graph.

#### B. Logs:
- **Message logs**: edited, deleted messages.
- **Member logs**: joins, leaves, kicks, bans.
- **Role logs**: added, removed roles.
- **Channel logs**: created, deleted, edited channels.
- Ability to **view logs both on dashboard and in Discord**, including logs of any changes made via dashboard (synced and recorded via the bot).

> ⚠️ Logs should include unified controls for:
> - Enable/disable specific log types.
> - Set log channels.
> - Purge logs.

#### C. Warnings:
- Issue warnings from dashboard.
- View full warning history by user.
- Edit or delete warnings.
- DM sent by default; server owners may override this in settings.

#### D. Ticket System:
- Enable/disable ticket system.
- Customize categories, labels, responses.
- Tickets can be opened both via bot and dashboard.
- All actions are synced in real time and logged both in dashboard and in Discord.
- DM messages are sent by default; customizable in settings.

#### E. Level System:
- Toggle system per server.
- Customize XP gain rates.
- View leaderboard.
- Reset/modify user XP.

#### F. Settings:
- General bot settings (prefix, timezone, etc.).
- DM settings (enable/disable user notifications).
- Admin roles management.
- Log channel assignment.
- Language selection.
- Full customization of UI text, embeds, visuals, and automation triggers.

---

**3. Technical Considerations:**

### 3.1 Authentication & Permissions:
- OAuth2 login (Discord).
- Admin Panel defines who has access to what server.
- Permissions are decoupled from Discord roles—assigned manually in the backend.

### 3.2 Backend:
- Server-specific endpoints.
- SQLite/PostgreSQL/Prisma support.
- Secure API Key system for communication between dashboard and bot backend.
- Secure access tokens + rate-limiting.
- Logs from dashboard changes pushed back to Discord channels via bot.

### 3.3 Frontend:
- React (preferred) with modern UI/UX.
- Dynamic content per selected server.
- Real-time feedback for ticket creation, edits, and warnings.
- Design based on a **dynamic, permission-aware layout**.

---

**4. UX Flow Summary:**
1. User logs in via Discord.
2. System fetches mutual servers.
3. User picks server (if more than one).
4. User sees a dynamic layout adjusted to their permission scope, with tabs: Analytics, Logs, Warnings, Tickets, Level, Settings.
5. All actions (edit/delete/view/add) stay within the server scope.
6. Ticket system and warnings both send DMs by default, but this can be modified in server settings.
7. Logs of any interaction or change from the dashboard are **synced in Discord**.

---

**5. Additional Notes:**
- All DM messages (such as from ticket system or warnings) are enabled by default and can be modified by server admins.
- Server category acts as the top-layer anchor for all features.
- Avoid duplication of settings; unify similar actions under same pages/modules.
- Prioritize **stability and performance** over real-time sync. Use the most stable and reliable sync method even at the cost of minor delay.

---

**6. AI Agent TODO List – Implementation Checklist**

#### 📦 BACKEND TASKS
- [ ] Create endpoint: `GET /servers` to fetch mutual servers via Discord API
- [ ] Verify server admin rights using stored Admin Panel assignments
- [ ] Create endpoints for:
  - [ ] `/logs`, `/warnings`, `/tickets`, `/levels`, `/settings`
  - [ ] Dashboard logs: POST changes back to Discord (via bot)
- [ ] Secure API using:
  - [ ] API Key authentication
  - [ ] Rate-limiting middleware
- [ ] Integrate SQLite database layer (existing) via ORM (e.g. Prisma)

#### 🎨 FRONTEND TASKS (React Preferred)
- [ ] Implement login flow using Discord OAuth2
- [ ] Build dynamic server selection screen:
  - [ ] Auto-select if only one server
  - [ ] List all mutual servers if more than one
- [ ] Construct main layout (responsive):
  - [ ] Tabs: Analytics, Logs, Warnings, Tickets, Level, Settings
  - [ ] Load data per selected server
- [ ] Add real-time UI feedback on actions (ticket updates, warnings, etc.)
- [ ] Implement DM toggle and customization settings

#### 🔗 INTEGRATION TASKS
- [ ] Sync all edits (warnings, settings, tickets) with Discord via bot logs
- [ ] Ticket creation/edit logs should appear both in dashboard and Discord channel
- [ ] Ensure dashboard respects Admin Panel access control

#### 🧪 TESTING & VALIDATION
- [ ] Test login/session flow across single/multiple server cases
- [ ] Confirm that only authorized users access server-specific content
- [ ] Validate that actions from dashboard reflect in Discord (and vice versa)
- [ ] Test ticket and warning DM delivery + override settings

#### 📝 CONFIGURATION & CUSTOMIZATION
- [ ] DM behavior: Default ON, allow per-server override
- [ ] Log types: Toggleable with channel assignment
- [ ] Level system: XP gain customization, leaderboard logic
- [ ] Settings UI: Prefix, timezone, admin roles, language, UI text

#### 🔄 DEPLOYMENT & STABILITY
- [ ] Choose sync method: prioritize **stability** over real-time speed
- [ ] Monitor for failed API key access or data mismatch between bot and dashboard
- [ ] Log all dashboard actions via bot channel for traceability

---

**End of PDR Document**


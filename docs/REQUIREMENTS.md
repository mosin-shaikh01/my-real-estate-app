# Requirements

---

## Roles

### Super Admin
Unrestricted. Manages properties, agents, clients; assigns properties→clients and
clients→agents; controls permissions; views all reports and activity.

### Agent
Logs in. Sees **only** assigned clients and assigned properties, and **only**
permitted fields. Adds notes, updates follow-up status, schedules meetings,
contacts assigned clients.

**Cannot:** delete anything · access another agent's clients · see budget,
commission or internal notes · modify permissions · export data.

### Client
**Not a user.** Records created by admins. No login in v1.

---

## Modules

| Module | v1 scope |
|---|---|
| **Auth** | Login, forgot password, change password, session list + revoke |
| **Dashboard** | Tiles: total/active/sold/available properties, total clients, total agents. Recent activity. Follow-up reminders. |
| **Property** | CRUD, archive, mark sold/rented, media upload, assign agent, amenities |
| **Client** | CRUD, requirements, interactions, assign agent |
| **Agent** | CRUD, activate/deactivate, assign clients/properties, set permissions |
| **Requirement + Match** | **The core feature.** See below. |
| **Assignment** | Bulk-assign properties to a client, with status |
| **Activity log** | Every significant mutation |
| **Search** | Properties + clients, by name/code/normalized phone |
| **Reports** | Agent performance, client conversion, property sales, inventory, follow-up status, monthly revenue |

### "Active property"
`status = AVAILABLE AND archived_at IS NULL AND deleted_at IS NULL`.
Defined because the dashboard tile was otherwise ambiguous.

---

## The Property Requirement flow (core feature)

One screen:

1. Admin enters client info + requirements (budget range, type, bedrooms,
   bathrooms, area, city, locality, amenities, parking, furnished,
   ready-to-move/under-construction).
2. Below, a property search filtered by budget / location / area / bedrooms /
   bathrooms / type / status.
3. Results in a table, each row with a checkbox.
4. Admin ticks rows → **Assign Selected Properties** → properties link to the
   client.

### Decisions that make or break it

**The search prefills from the requirement form** via RHF `watch()` (budget,
city, bedrooms). This is the entire point of putting them on one screen — without
it, it's two widgets stacked and the feature feels dumb.

**The search is a SEPARATE form** from the requirement. Nesting them means Enter
in a filter field submits the wrong form.

**Creation is atomic.** A brand-new client has no `clientId` to assign against
until saved, so it's one `POST /api/clients` carrying
`{ client, requirement, propertyIds }` in a transaction. Edits use separate
endpoints.

**One ActivityLog row per assignment**, not a batched row with a count —
otherwise "which properties did we show this client, and when?" is unanswerable.

---

## Permissions

Ten field-level permissions, curated (not a generic engine):
view client phone · view client email · view budget · view internal notes ·
view property price · edit follow-up · upload documents · download files ·
export data · view commission.

Plus resource-level gates and two **scope-widening** permissions
(`client.list.all`, `property.list.all`) that turn an agent into an admin for
listing purposes.

Roles and mappings are **data** — a new role needs no deploy. New permissions
need code, because a permission only does something when code checks it. See
[RBAC.md](./RBAC.md).

---

## Explicitly out of scope for v1

Each of these was cut deliberately, with a reason. They are not oversights.

| Cut | Why | v1 instead |
|---|---|---|
| **Notifications** (email/WhatsApp/SMS/browser) | WhatsApp Business API alone is a multi-week compliance and onboarding project, not a feature | `Mailer` interface exists as the seam |
| **Video upload** | Encoding, 100MB+ payloads, range streaming, storage — days of work | `videoUrl` field (YouTube/Vimeo). Demos identically. |
| **Radius / map search** | No PostGIS. Haversine in SQL is unindexed. | City/locality filters |
| **Calendar UI** | "Schedule meetings" doesn't require one | `scheduledAt` + a list |
| **Outbound messaging** | The app sends nothing in v1 | `tel:` / `wa.me` links |
| **Editable permission matrix** | Roles × ~43 permissions is a genuinely fiddly screen | Role assignment + read-only matrix |
| **Per-agent access overrides** | ~~UI later~~ **DELIVERED** — Super Admin edits any agent's access (ALLOW/DENY per permission) from the Agents page | Effective on the agent's next request |
| **Dark mode** | Re-reviewing 40 screens twice, for an office CRM used in daylight | Token layer ready; ships later |
| **Global search across 5 entity types** | ILIKE uses no btree; this is a day of work people budget an hour for | Properties + clients |
| **Public listing site** | Needs SSR/SEO, anonymous auth, marketing design | Structured as additive: `apps/public-web` later, same API |
| **Table density toggle** | Tokens exist | 40px rows |

---

## Non-functional

| Area | Target |
|---|---|
| Performance | LCP < 2.0s · CLS < 0.1 · INP < 200ms · initial JS < 250 kB gzip |
| Accessibility | WCAG 2.1 AA · Lighthouse ≥ 95 · zero axe violations · keyboard-complete |
| Responsive | 375 / 768 / 1024 / 1440 · body never scrolls horizontally |
| Security | httpOnly cookies · argon2 · refresh rotation with reuse detection · no PII in logs |
| Data | Money as `Decimal(14,2)` → string in DTOs · soft delete · full activity audit |

---

## Demo success criteria

1. Admin logs in, sees a dashboard with real counts.
2. Admin creates a client with requirements, matches inventory, assigns
   properties in one flow.
3. Agent logs in and sees **only** their assigned clients.
4. Agent's API response has **`budget` absent from the JSON payload** — not
   merely hidden in the UI.
5. Deactivating an agent locks them out on their **next request**, not in 15
   minutes.

Criteria 3–5 are the ones that prove the architecture. They're also the ones a
mock-data demo could never have honestly shown.

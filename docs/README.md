# Documentation

`../CLAUDE.md` is the primary context file and the source of truth for rules.
These documents go deeper on the *why*.

| Document | Read it when |
|---|---|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | You're new. Start here. |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | You need to know what's in scope — and what deliberately isn't. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | You're adding a module or wondering why the repo is shaped like this. |
| [RBAC.md](./RBAC.md) | **Before touching auth, scoping, or any field-level permission.** |
| [DATABASE.md](./DATABASE.md) | You're changing the schema or writing a migration. |
| [API.md](./API.md) | You're adding an endpoint. |
| [UI_UX_GUIDELINES.md](./UI_UX_GUIDELINES.md) | You're designing a screen or reaching for a colour. |
| [COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md) | You're writing a component. |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | You want the naming/style rules. |
| [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) | You're setting up, or about to run a git command. |
| [ROADMAP.md](./ROADMAP.md) | You're deciding what to build next. |
| [CHANGELOG.md](./CHANGELOG.md) | You want to know what shipped. |

## Rules for these docs

1. **Record the *why*.** What the code does is readable from the code. Why it
   does it that way is not, and it's the part that decays.
2. **Update docs in the same change that alters behaviour.** A doc that lies is
   worse than no doc.
3. **Contradictions get resolved, not accumulated.** If a doc disagrees with
   `CLAUDE.md`, one of them is wrong — fix it.
4. **Write down the decisions you had to argue about.** Those are the ones that
   get silently reverted six weeks later.

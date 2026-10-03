# Dig-To-Hell

Browser idle/clicker: dig a mine, haul the rubble up, press it into blocks at the Recycling Yard, truck them to the construction site and sell the houses you build. Three sites (MINE / YARD / BUILD), a physical material chain, and an economy where the value of what you dig follows the material all the way into the building.

Docs: `Spec.md` (design), `claude.md` (status), `AGENT_CONTEXT.md` (how the economy works in code), `playtest-captures/economy-audit.md` (economy audit, before/after).

```
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build to dist/
```

Tuning numbers live in `src/config.ts`; economy formulas in `src/economy.ts`. `dig-to-hell.html` is the original single-file prototype (reference only).

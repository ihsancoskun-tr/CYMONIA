# NOV / N-007 isolated runtime

This Worker is isolated from CYMONIA's production world. It imports the existing causal world engine from `world/`, but uses its own Worker name, Durable Object class, SQLite-backed Durable Object storage and migration record.

## Runtime state

- Preserves the last confirmed N-007 migration index: year 30, estimated population approximately 383, and confirmed social/cultural observations.
- Exposes read-only `/health`, `/state` and `/history` endpoints.
- Stores imported snapshots as versioned chunks so a single Durable Object value does not need to contain the whole world.
- Advances the imported world through the existing `advanceWorldTo` engine function, one bounded alarm cycle at a time.
- Provides authenticated `POST /admin/import`, `POST /admin/start` and `POST /admin/pause` endpoints.
- Does not generate Genesis, invent citizens, or start automatically after import.

## Historical migration boundary

The earlier `nov_claude_v0.1.zip` prototype was a separate five-year experiment with 24 founders. It is not the canonical N-007 year-30 world. The year-30 record currently available is an aggregate migration index, not a complete citizen-level save.

The importer therefore accepts only a complete version-2 engine snapshot with stable citizen IDs, biological and cognitive state, relationships, knowledge, memories, world objects, resources and canonical ledger. A partial history or the five-year prototype cannot pass this gate. The current migration index must not be mistaken for an importable world snapshot.

## Deploy

From the repository root:

```sh
npx wrangler deploy --config wrangler.nov.toml
```

Set `NOV_ADMIN_TOKEN` as a Worker secret before importing. The deployment workflow also requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Never commit credentials or a private snapshot.

## Snapshot contract

```json
{
  "schemaVersion": 1,
  "simulationId": "N-007",
  "worldYear": 30,
  "population": { "count": 383 },
  "worldState": {
    "version": 2,
    "worldId": "n007",
    "seed": 1,
    "clock": { "realEpochMs": 0, "worldMinute": 15242400 },
    "citizens": [],
    "objects": [],
    "resourceDeposits": [],
    "actions": [],
    "projects": [],
    "designs": [],
    "buildings": [],
    "organizations": [],
    "claims": [],
    "commitments": [],
    "grievances": [],
    "currencySystems": [],
    "relationships": [],
    "languages": [],
    "experiments": [],
    "cognitionQueue": [],
    "ledger": [],
    "ledgerHead": "..."
  }
}
```

This is a shape illustration, not a valid snapshot. Every citizen must include the full engine state and a unique stable ID. The count must match the citizen array. The complete world must also include environment, reserves, observer, living-world state and other required fields. The snapshot must reach year 30 or later.

## Start and pause

Importing leaves the world paused. Only an explicit authenticated `POST /admin/start` starts time. The Worker then advances the world through the existing engine on scheduled Durable Object alarms. An authenticated `POST /admin/pause` stops the alarm. No start request is issued by deployment.

## Non-negotiable world rules

No outside contact, imported objects or materials, observer intervention, reset, or silent rewriting of history. Natural phenomena remain possible. Unknown history is kept unknown rather than fabricated.

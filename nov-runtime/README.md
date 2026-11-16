# NOV / N-007 isolated runtime

This Worker is deliberately separate from CYMONIA's production world. It uses its own Worker name, Durable Object namespace and SQLite-backed Durable Object storage.

## Current behavior

- Preserves the last confirmed N-007 migration record: year 30, population estimate 383 (±15), and the confirmed social/cultural observations.
- Exposes read-only `/health`, `/state` and `/history` endpoints.
- Does not create a new Genesis, simulate citizens, advance the clock, or schedule alarms.
- Accepts a complete legacy snapshot only through the authenticated `POST /admin/import` endpoint.
- A successful import remains paused as `snapshot_imported_waiting_engine_validation`. It does not start the simulation.

## Why it starts paused

The prior N-007 world has confirmed aggregate records, but the complete individual citizen records and canonical event history are not present in the repository. Creating 383 invented personal histories would overwrite uncertainty with fabricated continuity. The migration record therefore preserves known facts and explicitly marks unknowns.

## Deployment

From the repository root:

```sh
npx wrangler deploy --config wrangler.nov.toml
```

Set `NOV_ADMIN_TOKEN` as a Worker secret before importing a snapshot. Never commit the token or a private snapshot to Git.

## Import format

The authenticated import accepts JSON with:

```json
{
  "schemaVersion": 1,
  "simulationId": "N-007",
  "worldYear": 30,
  "population": { "count": 383 },
  "citizens": [{ "id": "stable-citizen-id" }],
  "worldState": {},
  "history": []
}
```

The example is a schema outline, not a valid substitute for the complete historical records. Each citizen must have a unique stable ID, and the population count must match the citizen array.

## Non-negotiable world rules

No outside contact, imported objects or materials, observer intervention, reset, or silent rewriting of history. Natural phenomena remain possible. Simulation advancement remains disabled until the legacy state has been validated and the user explicitly starts it.

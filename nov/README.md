# NOV Independent World

NOV is a separate world instance. It is not the production CYMONIA civilization and does not share its canonical state, identities, event history, snapshots or inhabitants.

## Genesis contract

- 100 independently initialized adult inhabitants, with individual biological and psychological variation.
- A closed island environment with natural weather, water, food, timber, stone, clay and ore deposits.
- No imported objects, manufactured tools, shelters, stored food, clothing, written records or cultural instructions.
- Natural resources physically exist but are not initially known to inhabitants.
- No pre-created family structure, hierarchy, religion, government, currency, school, law or company.
- No previous NOV run's individuals, events, beliefs or chronology are imported.
- Citizens learn only through their own perception, memory, experience and social transmission.
- The observer records causes and outcomes but does not issue instructions to inhabitants.

## Current implementation boundary

`nov/genesis.js` creates an isolated canonical state using the shared deterministic life-and-society kernel. `world.nov` identifies the independent world and its closed-island boundary.

This branch is a development artifact. It has **not** been deployed, and it does not claim that a persistent NOV runtime is already running. The island boundary must be enforced by the movement/terrain kernel and covered by tests before a production run. The research protocol's comparative conditions and logging schema also remain to be integrated.

## Start locally

From the repository root:

```js
import {createNovGenesis} from './nov/genesis.js';
const world = createNovGenesis({seed: 20261119, realEpochMs: Date.now()});
```

Use a new seed for an independent replicate. Never reuse the same world state or seed across supposedly independent replicates.

## Independence rule

CYMONIA's production world and NOV are separate. This directory must not read or write the production Durable Object, production snapshots, production event ledger, or human-linked identities.

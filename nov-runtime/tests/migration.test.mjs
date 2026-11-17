import test from "node:test";
import assert from "node:assert/strict";
import { createMigrationRecord, validateLegacySnapshot } from "../src/index.js";
import { validateEngineWorld } from "../src/engine-adapter.js";
import { createSovereignGenesis } from "../../world/index.js";

function engineWorld(overrides = {}) {
  const citizen = {
    id: "n-001",
    alive: true,
    body: { ageMinutes: 30 * 525600 },
    genome: {},
    psychology: {},
    position: { x: 1, y: 1 },
    language: {},
    skills: {},
    relationships: {},
    cognition: {},
    knowledge: [],
    memories: [],
    knownEntityIds: ["n-001"],
    beliefs: [],
    possessions: [],
    goals: [],
    plans: [],
    commitments: [],
    programs: []
  };
  const arrays = [
    "citizens", "objects", "resourceDeposits", "actions", "projects", "designs",
    "buildings", "organizations", "claims", "commitments", "grievances",
    "currencySystems", "relationships", "languages", "experiments",
    "cognitionQueue", "ledger"
  ];
  const world = {
    version: 2,
    worldId: "n007-test",
    seed: 7,
    clock: { realEpochMs: 1, worldMinute: 29 * 525600 },
    environment: {},
    reserves: {},
    privateHumanIntents: {},
    observer: {},
    livingWorld: {},
    ledgerHead: "GENESIS",
    ...Object.fromEntries(arrays.map(key => [key, key === "citizens" ? [citizen] : []])),
    ...overrides
  };
  return world;
}

function snapshot(world = engineWorld()) {
  return {
    schemaVersion: 1,
    simulationId: "N-007",
    worldYear: 30,
    population: { count: world.citizens.filter(citizen => citizen.alive).length },
    worldState: world
  };
}

test("migration record preserves the known N-007 baseline and remains paused", () => {
  const record = createMigrationRecord();
  assert.equal(record.simulationId, "N-007");
  assert.equal(record.worldYear, 30);
  assert.equal(record.population.estimate, 383);
  assert.equal(record.status, "awaiting_individual_state_import");
  assert.equal(record.worldRules.importedMaterialsOrObjects, false);
  assert.equal(record.worldRules.observerIntervention, false);
  assert.ok(record.unknownsThatMustNotBeInvented.length > 0);
});

test("migration record is isolated from accidental mutation", () => {
  const a = createMigrationRecord();
  a.population.estimate = 1;
  assert.equal(createMigrationRecord().population.estimate, 383);
});

test("rejects snapshots that would reset or misidentify N-007", () => {
  assert.equal(validateLegacySnapshot({}).reason, "unsupported_schema_version");
  assert.equal(validateLegacySnapshot({
    schemaVersion: 1, simulationId: "CYMONIA", worldYear: 30,
    population: { count: 1 }, worldState: engineWorld()
  }).reason, "simulation_id_mismatch");
  const tooYoung = snapshot(engineWorld({ clock: { realEpochMs: 1, worldMinute: 28 * 525600 } }));
  assert.equal(validateLegacySnapshot(tooYoung).reason, "snapshot_does_not_reach_n007_year_30");
  const wrongYear = snapshot();
  wrongYear.worldYear = 31;
  assert.equal(validateLegacySnapshot(wrongYear).reason, "snapshot_year_does_not_match_engine_clock");
});

test("requires a complete engine world and individual citizen records", () => {
  assert.equal(validateLegacySnapshot(snapshot(engineWorld({ version: 1 }))).reason, "unsupported_engine_world_version");
  const incomplete = snapshot(engineWorld({ citizens: [] }));
  assert.equal(validateLegacySnapshot(incomplete).reason, "population_count_missing");
});

test("accepts a structurally complete N-007 engine snapshot", () => {
  assert.deepEqual(validateLegacySnapshot(snapshot()), {
    ok: true, population: 1, totalCitizenRecords: 1, worldMinute: 29 * 525600
  });
});

test("rejects population mismatch and duplicate citizen identifiers", () => {
  const mismatch = snapshot();
  mismatch.population.count = 2;
  assert.equal(validateLegacySnapshot(mismatch).reason, "population_count_must_match_living_citizens");

  const duplicateWorld = engineWorld();
  duplicateWorld.citizens.push(structuredClone(duplicateWorld.citizens[0]));
  const duplicate = snapshot(duplicateWorld);
  assert.equal(validateLegacySnapshot(duplicate).reason, "duplicate_citizen_id");
});

test("keeps deceased citizens in history without counting them as living population", () => {
  const world = engineWorld();
  const deceased = structuredClone(world.citizens[0]);
  deceased.id = "n-002";
  deceased.alive = false;
  world.citizens.push(deceased);
  const migrated = snapshot(world);
  assert.equal(validateLegacySnapshot(migrated).ok, true);
  assert.equal(validateLegacySnapshot(migrated).population, 1);
  assert.equal(validateLegacySnapshot(migrated).totalCitizenRecords, 2);
});

test("rejects a corrupted causal ledger", () => {
  const corrupted = snapshot();
  corrupted.worldState.ledger.push({
    id: "broken", seq: 0, worldMinute: 0, type: "BROKEN", actorId: "world",
    payload: {}, causes: [], previousHash: "GENESIS", hash: "00000000"
  });
  corrupted.worldState.ledgerHead = "00000000";
  assert.equal(validateLegacySnapshot(corrupted).reason, "canonical_ledger_integrity_failed");
});

test("rejects citizen records that do not contain engine state", () => {
  const invalidWorld = engineWorld();
  invalidWorld.citizens[0].body = null;
  assert.match(validateEngineWorld(invalidWorld).reason, /citizen_engine_state_incomplete/);
});


test("accepts the actual engine-generated schema without treating it as N-007 history", () => {
  const worldState = createSovereignGenesis({ seed: 7, realEpochMs: 0 });
  worldState.clock.worldMinute = 29 * 525600;
  worldState.clock.realEpochMs = Date.now() - worldState.clock.worldMinute * 1000;
  const importedShape = {
    schemaVersion: 1,
    simulationId: "N-007",
    worldYear: 30,
    population: { count: worldState.citizens.filter(citizen => citizen.alive).length },
    worldState
  };
  assert.equal(validateLegacySnapshot(importedShape).ok, true);
  assert.equal(worldState.citizens.length, 100);
});

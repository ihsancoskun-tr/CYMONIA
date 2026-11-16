import test from "node:test";
import assert from "node:assert/strict";
import { createMigrationRecord, validateLegacySnapshot } from "../src/index.js";

test("migration record preserves confirmed N-007 baseline without starting time", () => {
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
  const b = createMigrationRecord();
  assert.equal(b.population.estimate, 383);
});

test("rejects snapshots that would reset or misidentify N-007", () => {
  assert.equal(validateLegacySnapshot({}).reason, "unsupported_schema_version");
  assert.equal(validateLegacySnapshot({
    schemaVersion: 1, simulationId: "CYMONIA", worldYear: 30
  }).reason, "simulation_id_mismatch");
  assert.equal(validateLegacySnapshot({
    schemaVersion: 1, simulationId: "N-007", worldYear: 29
  }).reason, "world_year_must_preserve_year_30_or_later");
});

test("requires complete individual records and matching population count", () => {
  const incomplete = {
    schemaVersion: 1,
    simulationId: "N-007",
    worldYear: 30,
    population: { count: 383 },
    citizens: [],
    worldState: {},
    history: []
  };
  assert.equal(validateLegacySnapshot(incomplete).reason, "individual_citizen_records_required");
});

test("accepts a structurally complete snapshot without starting it", () => {
  const snapshot = {
    schemaVersion: 1,
    simulationId: "N-007",
    worldYear: 30,
    population: { count: 2 },
    citizens: [{ id: "n-001" }, { id: "n-002" }],
    worldState: {},
    history: []
  };
  assert.deepEqual(validateLegacySnapshot(snapshot), { ok: true });
});

test("rejects duplicate citizen identifiers", () => {
  const snapshot = {
    schemaVersion: 1,
    simulationId: "N-007",
    worldYear: 30,
    population: { count: 2 },
    citizens: [{ id: "n-001" }, { id: "n-001" }],
    worldState: {},
    history: []
  };
  assert.equal(validateLegacySnapshot(snapshot).reason, "duplicate_citizen_id");
});

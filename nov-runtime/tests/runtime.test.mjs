import test from "node:test";
import assert from "node:assert/strict";
import { NovWorld } from "../src/index.js";

function makeSnapshot() {
  const citizen = {
    id: "n-001", alive: true,
    body: { ageMinutes: 30 * 525600 },
    genome: {}, psychology: {}, position: { x: 1, y: 1 },
    language: {}, skills: {}, relationships: {}, cognition: {},
    knowledge: [], memories: [], knownEntityIds: ["n-001"],
    beliefs: [], possessions: [], goals: [], plans: [],
    commitments: [], programs: []
  };
  const arrays = [
    "objects", "resourceDeposits", "actions", "projects", "designs",
    "buildings", "organizations", "claims", "commitments", "grievances",
    "currencySystems", "relationships", "languages", "experiments",
    "cognitionQueue", "ledger"
  ];
  const worldState = {
    version: 2, worldId: "n007-runtime-test", seed: 7,
    clock: { realEpochMs: 0, worldMinute: 29 * 525600 },
    environment: {}, reserves: {}, privateHumanIntents: {},
    observer: {}, livingWorld: {}, citizens: [citizen],
    ...Object.fromEntries(arrays.map(key => [key, []])),
    ledgerHead: "GENESIS"
  };
  return {
    schemaVersion: 1, simulationId: "N-007", worldYear: 30,
    population: { count: 1 }, worldState
  };
}

function harness() {
  const values = new Map();
  let alarmAt = null;
  const storage = {
    async get(key) { return values.get(key); },
    async put(key, value) { values.set(key, structuredClone(value)); },
    async delete(key) { return values.delete(key); },
    async setAlarm(value) { alarmAt = value; },
    async deleteAlarm() { alarmAt = null; }
  };
  const world = new NovWorld({ storage }, { NOV_ADMIN_TOKEN: "test-secret" });
  return { world, storage, values, get alarmAt() { return alarmAt; } };
}

function adminRequest(path, body) {
  return new Request("https://nov.test" + path, {
    method: "POST",
    headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

test("runtime refuses to start before a validated N-007 snapshot is imported", async () => {
  const h = harness();
  const response = await h.world.fetch(adminRequest("/admin/start"));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "validated_snapshot_required_before_start");
  assert.equal(h.alarmAt, null);
});

test("runtime imports, starts, reports and pauses a validated snapshot", async () => {
  const h = harness();
  const imported = await h.world.fetch(adminRequest("/admin/import", makeSnapshot()));
  assert.equal(imported.status, 200);
  assert.equal((await imported.json()).status, "snapshot_imported_paused");

  const started = await h.world.fetch(adminRequest("/admin/start"));
  assert.equal(started.status, 200);
  assert.equal((await started.json()).simulationAdvancing, true);
  assert.ok(Number.isFinite(h.alarmAt));

  const health = await h.world.fetch(new Request("https://nov.test/health"));
  const state = await health.json();
  assert.equal(state.status, "running");
  assert.equal(state.worldYear, 30);
  assert.equal(state.population, 1);

  const paused = await h.world.fetch(adminRequest("/admin/pause"));
  assert.equal(paused.status, 200);
  assert.equal((await paused.json()).simulationAdvancing, false);
  assert.equal(h.alarmAt, null);
});

test("runtime rejects unauthorized imports and preserves paused state", async () => {
  const h = harness();
  const response = await h.world.fetch(new Request("https://nov.test/admin/import", {
    method: "POST",
    headers: { authorization: "Bearer wrong-token", "content-type": "application/json" },
    body: JSON.stringify(makeSnapshot())
  }));
  assert.equal(response.status, 401);
  const state = await h.world.fetch(new Request("https://nov.test/state"));
  assert.equal((await state.json()).status, "awaiting_individual_state_import");
});

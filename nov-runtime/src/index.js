import { advanceN007World, validateEngineWorld } from "./engine-adapter.js";

const RECORD_KEY = "nov:n007:migration-record:v1";
const SNAPSHOT_MANIFEST_KEY = "nov:n007:snapshot:manifest:v1";
const SNAPSHOT_PART_PREFIX = "nov:n007:snapshot:part:";
const SNAPSHOT_PART_CODE_UNITS = 90000;
const ALARM_INTERVAL_MS = 60_000;

export const N007_MIGRATION_RECORD = Object.freeze({
  schemaVersion: 1,
  simulationId: "N-007",
  status: "awaiting_individual_state_import",
  worldYear: 30,
  population: {
    estimate: 383,
    precision: "approximate",
    localClusters: null,
    localClusterCountNote: "Earlier six-community wording remains ambiguous; do not interpret as confirmed lineage or ideological groups."
  },
  confirmedState: {
    socialConflict: "observed",
    writing: "no confirmed writing system; the healer's death caused panic and was treated as evidence that writing may not yet exist",
    language: "under observation; a complete language record is unavailable",
    clothing: "under observation; no canonical clothing inventory is available",
    spirituality: "not yet a focus of the simulation; no shared religious system is confirmed"
  },
  confirmedEvents: [
    { period: "by year 30; exact date unavailable", event: "A healer died; the resulting panic raised questions about how medical knowledge was preserved and whether writing existed." },
    { period: "by year 30; exact date unavailable", event: "Social conflict was observed, but the full chronology and participants are not preserved in the available migration record." }
  ],
  unknownsThatMustNotBeInvented: [
    "individual citizen identities and personal histories",
    "exact population count and individual ages",
    "exact locations and membership of the six local clusters",
    "kinship and relationship graph",
    "individual memories, beliefs, knowledge and language lexicons",
    "subsistence balance, health records and full environmental/resource map",
    "complete event chronology and exact dates",
    "the presence or absence of formal writing, religion or central authority"
  ],
  worldRules: {
    isolatedFromHumanity: true,
    outsideContact: false,
    importedMaterialsOrObjects: false,
    naturalPhenomenaAllowed: true,
    observerIntervention: false,
    preserveExistingHistory: true
  },
  unknownsThatMustNotBeInvented: [
    "individual citizen identities and personal histories",
    "exact population count and individual ages",
    "exact locations and membership of the six local clusters",
    "kinship and relationship graph",
    "individual memories, beliefs, knowledge and language lexicons",
    "complete event chronology and environmental/resource map"
  ],
  source: {
    type: "reconstructed_from_confirmed_conversation_records",
    lastConfirmedDate: "2026-11-13",
    confidence: "partial",
    note: "This record is a partial migration index reconstructed from conversation records, not a complete canonical world snapshot. Unverified details are deliberately left unknown."
  }
});

export function createMigrationRecord() {
  return structuredClone(N007_MIGRATION_RECORD);
}

export function validateLegacySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return { ok: false, reason: "snapshot_must_be_an_object" };
  }
  if (snapshot.schemaVersion !== 1) return { ok: false, reason: "unsupported_schema_version" };
  if (snapshot.simulationId !== "N-007") return { ok: false, reason: "simulation_id_mismatch" };
  if (!Number.isInteger(snapshot.worldYear) || snapshot.worldYear < 30) {
    return { ok: false, reason: "world_year_must_preserve_year_30_or_later" };
  }
  if (!snapshot.population || !Number.isInteger(snapshot.population.count) || snapshot.population.count < 1) {
    return { ok: false, reason: "population_count_missing" };
  }
  const engine = validateEngineWorld(snapshot.worldState, snapshot.population.count);
  if (!engine.ok) return engine;
  return { ok: true, population: engine.population, worldMinute: engine.worldMinute };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function sameToken(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  let mismatch = a.length ^ b.length;
  const size = Math.max(a.length, b.length);
  for (let i = 0; i < size; i++) mismatch |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
  return mismatch === 0;
}

function splitSnapshot(serialized) {
  const parts = [];
  for (let start = 0; start < serialized.length;) {
    let end = Math.min(serialized.length, start + SNAPSHOT_PART_CODE_UNITS);
    if (end < serialized.length) {
      const before = serialized.charCodeAt(end - 1), after = serialized.charCodeAt(end);
      if (before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF) end--;
    }
    parts.push(serialized.slice(start, end));
    start = end;
  }
  return parts.length ? parts : [""];
}

export class NovWorld {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.ready = this.initialize();
  }

  async initialize() {
    const existing = await this.ctx.storage.get(RECORD_KEY);
    if (!existing) await this.ctx.storage.put(RECORD_KEY, createMigrationRecord());
  }

  async loadSnapshot() {
    const manifest = await this.ctx.storage.get(SNAPSHOT_MANIFEST_KEY);
    if (!manifest || !Number.isInteger(manifest.partCount) || !manifest.generation) return null;
    const parts = await Promise.all(Array.from({ length: manifest.partCount }, (_, index) =>
      this.ctx.storage.get(SNAPSHOT_PART_PREFIX + manifest.generation + ":" + index)
    ));
    if (parts.some(part => typeof part !== "string")) throw new Error("snapshot_part_missing");
    return JSON.parse(parts.join(""));
  }

  async storeSnapshot(snapshot) {
    const serialized = JSON.stringify(snapshot);
    const parts = splitSnapshot(serialized);
    const generation = crypto.randomUUID();
    const previous = await this.ctx.storage.get(SNAPSHOT_MANIFEST_KEY);
    for (let index = 0; index < parts.length; index++) {
      await this.ctx.storage.put(SNAPSHOT_PART_PREFIX + generation + ":" + index, parts[index]);
    }
    await this.ctx.storage.put(SNAPSHOT_MANIFEST_KEY, {
      generation,
      partCount: parts.length,
      serializedLength: serialized.length,
      storedAt: Date.now()
    });
    if (previous?.generation && Number.isInteger(previous.partCount)) {
      for (let index = 0; index < previous.partCount; index++) {
        await this.ctx.storage.delete(SNAPSHOT_PART_PREFIX + previous.generation + ":" + index);
      }
    }
  }

  async requireAdmin(request) {
    const expected = this.env.NOV_ADMIN_TOKEN;
    if (!expected) return json({ ok: false, error: "admin_import_not_configured" }, 503);
    const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    return sameToken(supplied, expected) ? null : json({ ok: false, error: "unauthorized" }, 401);
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const record = await this.ctx.storage.get(RECORD_KEY);

    if (request.method === "GET" && (path === "/" || path === "/health")) {
      const snapshot = await this.loadSnapshot();
      const world = snapshot?.worldState;
      return json({
        ok: true,
        service: "nov-sovereign-world",
        simulationId: record.simulationId,
        status: record.status,
        worldYear: world ? Math.floor(world.clock.worldMinute / 525600) + 1 : record.worldYear,
        worldMinute: world?.clock.worldMinute ?? null,
        population: world?.citizens?.filter(citizen => citizen.alive).length ?? record.population.estimate,
        simulationAdvancing: record.status === "running"
      });
    }

    if (request.method === "GET" && path === "/state") return json(record);

    if (request.method === "GET" && path === "/history") {
      const snapshot = await this.loadSnapshot();
      return json({
        simulationId: record.simulationId,
        confirmedEvents: record.confirmedEvents,
        engineLedger: snapshot?.worldState?.ledger?.slice(-100) ?? [],
        source: record.source
      });
    }

    if (request.method === "POST" && path === "/admin/import") {
      const denied = await this.requireAdmin(request);
      if (denied) return denied;
      if (record.status === "running") return json({ ok: false, error: "pause_before_import" }, 409);

      const length = Number(request.headers.get("content-length") || 0);
      if (length > 25 * 1024 * 1024) return json({ ok: false, error: "snapshot_too_large" }, 413);
      let snapshot;
      try { snapshot = await request.json(); }
      catch { return json({ ok: false, error: "invalid_json" }, 400); }

      const validation = validateLegacySnapshot(snapshot);
      if (!validation.ok) return json({ ok: false, error: validation.reason }, 422);

      await this.storeSnapshot(snapshot);
      record.status = "snapshot_imported_paused";
      record.worldYear = snapshot.worldYear;
      record.population = { estimate: snapshot.population.count, uncertainty: 0 };
      record.source = { type: "canonical_engine_snapshot_import", importedAt: new Date().toISOString() };
      await this.ctx.storage.put(RECORD_KEY, record);
      return json({ ok: true, status: record.status, worldMinute: validation.worldMinute, simulationAdvancing: false });
    }

    if (request.method === "POST" && path === "/admin/start") {
      const denied = await this.requireAdmin(request);
      if (denied) return denied;
      if (record.status === "running") return json({ ok: true, status: "running", simulationAdvancing: true });
      if (record.status !== "snapshot_imported_paused") {
        return json({ ok: false, error: "validated_snapshot_required_before_start" }, 409);
      }
      const snapshot = await this.loadSnapshot();
      const validation = validateLegacySnapshot(snapshot);
      if (!validation.ok) return json({ ok: false, error: validation.reason }, 422);

      snapshot.worldState.clock.realEpochMs = Date.now() - snapshot.worldState.clock.worldMinute * 1000;
      await this.storeSnapshot(snapshot);
      record.status = "running";
      record.startedAt = new Date().toISOString();
      record.source = { ...record.source, clockAnchoredAt: record.startedAt };
      await this.ctx.storage.put(RECORD_KEY, record);
      await this.ctx.storage.setAlarm(Date.now() + (result.catchingUp ? 1_000 : ALARM_INTERVAL_MS));
      return json({ ok: true, status: "running", worldMinute: validation.worldMinute, simulationAdvancing: true });
    }

    if (request.method === "POST" && path === "/admin/pause") {
      const denied = await this.requireAdmin(request);
      if (denied) return denied;
      record.status = "paused_by_operator";
      record.pausedAt = new Date().toISOString();
      await this.ctx.storage.put(RECORD_KEY, record);
      await this.ctx.storage.deleteAlarm();
      return json({ ok: true, status: record.status, simulationAdvancing: false });
    }

    return json({ ok: false, error: "not_found" }, 404);
  }

  async alarm() {
    await this.ready;
    const record = await this.ctx.storage.get(RECORD_KEY);
    if (record.status !== "running") return;
    try {
      const snapshot = await this.loadSnapshot();
      if (!snapshot) throw new Error("canonical_snapshot_missing");
      const validation = validateLegacySnapshot(snapshot);
      if (!validation.ok) throw new Error(validation.reason);
      const result = advanceN007World(snapshot.worldState, Date.now());
      await this.storeSnapshot(snapshot);
      record.worldYear = result.worldYear;
      record.population = { estimate: result.livingPopulation, uncertainty: 0 };
      record.lastTickAt = new Date().toISOString();
      record.lastWorldMinute = result.worldMinute;
      await this.ctx.storage.put(RECORD_KEY, record);
      await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    } catch (error) {
      record.status = "paused_runtime_error";
      record.runtimeError = String(error?.message || error).slice(0, 240);
      record.pausedAt = new Date().toISOString();
      await this.ctx.storage.put(RECORD_KEY, record);
      await this.ctx.storage.deleteAlarm();
      console.error("NOV_RUNTIME_PAUSED", record.runtimeError);
    }
  }
}

export default {
  async fetch(request, env) {
    if (!env.NOV_WORLD) return json({ ok: false, error: "NOV_WORLD binding missing" }, 503);
    const id = env.NOV_WORLD.idFromName("N-007");
    return env.NOV_WORLD.get(id).fetch(request);
  }
};

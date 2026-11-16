const RECORD_KEY = "nov:n007:migration-record:v1";
const SNAPSHOT_KEY = "nov:n007:legacy-snapshot:v1";

export const N007_MIGRATION_RECORD = Object.freeze({
  schemaVersion: 1,
  simulationId: "N-007",
  status: "awaiting_individual_state_import",
  worldYear: 30,
  population: {
    estimate: 383,
    uncertainty: 15,
    birthsRecordedForYears25To30: 70,
    deathsRecordedForYears25To30: 67,
    ageDistributionPercent: { "0-14": 33, "15-49": 51, "50+": 16 },
    localClusters: 6
  },
  confirmedState: {
    subsistence: "hunter_fisher_gatherer",
    health: "local_infections_observed_no_epidemic_recorded",
    language: "independent_oral_language_no_writing_evidence",
    authority: "local_experience_and_mediation_no_central_authority",
    knowledgeTransmission: ["memory", "observation", "imitation", "oral_transmission"],
    customs: ["repeated_mourning_and_burial_behaviors"],
    beliefState: "divergent_interpretations_of_dreams_and_the_dead_no_shared_religious_system"
  },
  confirmedEvents: [
    {
      period: "years 25-30",
      event: "A healer died; treatment knowledge fragmented and people began comparing accounts from multiple practitioners."
    },
    {
      period: "years 25-30",
      event: "A fishing dispute was resolved through a temporary rotation arrangement."
    },
    {
      period: "years 25-30",
      event: "Practical expertise and mediation gained local status without forming a coercive office."
    }
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
    lastConfirmedDate: "2026-11-06",
    confidence: "partial",
    note: "This record is a migration index, not a complete canonical world snapshot."
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
  if (!snapshot.worldState || typeof snapshot.worldState !== "object" || Array.isArray(snapshot.worldState)) {
    return { ok: false, reason: "world_state_missing" };
  }
  if (!Array.isArray(snapshot.citizens) || snapshot.citizens.length === 0) {
    return { ok: false, reason: "individual_citizen_records_required" };
  }
  if (!snapshot.population || snapshot.population.count !== snapshot.citizens.length) {
    return { ok: false, reason: "population_count_must_match_citizen_records" };
  }
  const ids = new Set();
  for (const citizen of snapshot.citizens) {
    if (!citizen || typeof citizen.id !== "string" || !citizen.id.trim()) {
      return { ok: false, reason: "every_citizen_requires_a_stable_id" };
    }
    if (ids.has(citizen.id)) return { ok: false, reason: "duplicate_citizen_id" };
    ids.add(citizen.id);
  }
  if (!Array.isArray(snapshot.history)) return { ok: false, reason: "canonical_history_array_required" };
  return { ok: true };
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

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (request.method === "GET" && (path === "/" || path === "/health")) {
      const record = await this.ctx.storage.get(RECORD_KEY);
      return json({
        ok: true,
        service: "nov-sovereign-world",
        simulationId: record.simulationId,
        status: record.status,
        worldYear: record.worldYear,
        populationEstimate: record.population.estimate,
        simulationAdvancing: false
      });
    }

    if (request.method === "GET" && path === "/state") {
      return json(await this.ctx.storage.get(RECORD_KEY));
    }

    if (request.method === "GET" && path === "/history") {
      const record = await this.ctx.storage.get(RECORD_KEY);
      return json({ simulationId: record.simulationId, events: record.confirmedEvents, source: record.source });
    }

    if (request.method === "POST" && path === "/admin/import") {
      const expected = this.env.NOV_ADMIN_TOKEN;
      if (!expected) return json({ ok: false, error: "admin_import_not_configured" }, 503);
      const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (!sameToken(supplied, expected)) return json({ ok: false, error: "unauthorized" }, 401);

      const length = Number(request.headers.get("content-length") || 0);
      if (length > 25 * 1024 * 1024) return json({ ok: false, error: "snapshot_too_large" }, 413);

      let snapshot;
      try { snapshot = await request.json(); }
      catch { return json({ ok: false, error: "invalid_json" }, 400); }

      const validation = validateLegacySnapshot(snapshot);
      if (!validation.ok) return json({ ok: false, error: validation.reason }, 422);

      await this.ctx.storage.put(SNAPSHOT_KEY, snapshot);
      const record = await this.ctx.storage.get(RECORD_KEY);
      record.status = "snapshot_imported_waiting_engine_validation";
      record.worldYear = snapshot.worldYear;
      record.population = { estimate: snapshot.population.count, uncertainty: 0 };
      record.source = { type: "canonical_snapshot_import", importedAt: new Date().toISOString() };
      await this.ctx.storage.put(RECORD_KEY, record);
      return json({ ok: true, status: record.status, simulationAdvancing: false });
    }

    return json({ ok: false, error: "not_found" }, 404);
  }
}

export default {
  async fetch(request, env) {
    if (!env.NOV_WORLD) return json({ ok: false, error: "NOV_WORLD binding missing" }, 503);
    const id = env.NOV_WORLD.idFromName("N-007");
    return env.NOV_WORLD.get(id).fetch(request);
  }
};

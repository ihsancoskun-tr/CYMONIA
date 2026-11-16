import { advanceWorldTo, WORLD_MINUTES_PER_YEAR } from "../../world/index.js";

const WORLD_ARRAYS = [
  "citizens", "objects", "resourceDeposits", "actions", "projects", "designs",
  "buildings", "organizations", "claims", "commitments", "grievances",
  "currencySystems", "relationships", "languages", "experiments",
  "cognitionQueue", "ledger"
];
const CITIZEN_ARRAYS = [
  "knowledge", "memories", "knownEntityIds", "beliefs", "possessions",
  "goals", "plans", "commitments", "programs"
];
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function validateEngineWorld(world, expectedPopulation = null) {
  if (!isObject(world)) return { ok: false, reason: "engine_world_missing" };
  if (world.version !== 2) return { ok: false, reason: "unsupported_engine_world_version" };
  if (typeof world.worldId !== "string" || !world.worldId) return { ok: false, reason: "world_id_missing" };
  if (!Number.isFinite(world.seed)) return { ok: false, reason: "world_seed_missing" };
  if (!isObject(world.clock) || !Number.isFinite(world.clock.worldMinute) ||
      !Number.isFinite(world.clock.realEpochMs)) return { ok: false, reason: "canonical_clock_missing" };
  if (world.clock.worldMinute < 29 * WORLD_MINUTES_PER_YEAR) {
    return { ok: false, reason: "snapshot_does_not_reach_n007_year_30" };
  }
  if (!isObject(world.environment) || !isObject(world.reserves) ||
      !isObject(world.privateHumanIntents) || !isObject(world.observer) ||
      !isObject(world.livingWorld)) return { ok: false, reason: "engine_world_state_incomplete" };

  for (const key of WORLD_ARRAYS) {
    if (!Array.isArray(world[key])) return { ok: false, reason: `engine_world_array_missing:${key}` };
  }
  if (!world.citizens.length) return { ok: false, reason: "individual_citizen_records_required" };
  if (expectedPopulation !== null && world.citizens.length !== expectedPopulation) {
    return { ok: false, reason: "population_count_must_match_engine_citizens" };
  }

  const ids = new Set();
  for (const citizen of world.citizens) {
    if (!isObject(citizen) || typeof citizen.id !== "string" || !citizen.id.trim()) {
      return { ok: false, reason: "citizen_stable_id_missing" };
    }
    if (ids.has(citizen.id)) return { ok: false, reason: "duplicate_citizen_id" };
    ids.add(citizen.id);
    if (!isObject(citizen.body) || !isObject(citizen.genome) ||
        !isObject(citizen.psychology) || !isObject(citizen.position) ||
        !isObject(citizen.language) || !isObject(citizen.skills) ||
        !isObject(citizen.relationships) || !isObject(citizen.cognition)) {
      return { ok: false, reason: `citizen_engine_state_incomplete:${citizen.id}` };
    }
    for (const key of CITIZEN_ARRAYS) {
      if (!Array.isArray(citizen[key])) return { ok: false, reason: `citizen_array_missing:${citizen.id}:${key}` };
    }
    if (typeof citizen.alive !== "boolean" || !Number.isFinite(citizen.body.ageMinutes) ||
        !Number.isFinite(citizen.position.x) || !Number.isFinite(citizen.position.y)) {
      return { ok: false, reason: `citizen_biology_or_position_invalid:${citizen.id}` };
    }
  }
  if (typeof world.ledgerHead !== "string" || !world.ledgerHead) {
    return { ok: false, reason: "canonical_ledger_head_missing" };
  }
  return { ok: true, population: world.citizens.length, worldMinute: world.clock.worldMinute };
}

export function advanceN007World(world, nowMs = Date.now()) {
  const validation = validateEngineWorld(world);
  if (!validation.ok) throw new Error(validation.reason);
  advanceWorldTo(world, nowMs, { maxSegments: 64 });
  return {
    worldMinute: world.clock.worldMinute,
    worldYear: Math.floor(world.clock.worldMinute / WORLD_MINUTES_PER_YEAR) + 1,
    livingPopulation: world.citizens.filter(citizen => citizen.alive).length
  };
}

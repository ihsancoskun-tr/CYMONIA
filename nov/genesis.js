import {createSovereignGenesis} from '../world/genesis.js';
import {appendEvent} from '../world/ledger.js';

/**
 * Independent NOV genesis.
 * Reuses CYMONIA's deterministic life/cognition kernel, but creates a separate
 * world state with no imported objects, tools, shelters, stored food or history.
 */
export function createNovGenesis({seed=20261119,realEpochMs=Date.now()}={}){
  const world=createSovereignGenesis({seed,realEpochMs});

  // Remove every manufactured or provisioned item from the CYMONIA starter set.
  world.objects=[];
  world.buildings=[];
  world.projects=[];
  world.designs=[];
  world.organizations=[];
  world.claims=[];
  world.commitments=[];
  world.grievances=[];
  world.currencySystems=[];
  world.relationships=[];
  world.languages=[];
  world.experiments=[];
  world.reserves={observerEmbodimentKg:0,observerEmbodimentEnergyUnits:0};

  // Natural deposits only. No one owns or initially knows these locations.
  world.resourceDeposits=[
    {id:'nov:water:north',type:'water',quantity:1_200_000,renewPerDay:14_000,position:{x:48,y:17},accessDifficulty:.08},
    {id:'nov:water:south',type:'water',quantity:900_000,renewPerDay:10_000,position:{x:54,y:79},accessDifficulty:.1},
    {id:'nov:food:west',type:'food',quantity:3_000,renewPerDay:95,position:{x:24,y:43},accessDifficulty:.14},
    {id:'nov:food:east',type:'food',quantity:2_600,renewPerDay:82,position:{x:75,y:57},accessDifficulty:.16},
    {id:'nov:food:upland',type:'food',quantity:1_700,renewPerDay:48,position:{x:43,y:28},accessDifficulty:.22},
    {id:'nov:timber:west',type:'timber',quantity:28_000,renewPerDay:24,position:{x:20,y:61},accessDifficulty:.25},
    {id:'nov:timber:east',type:'timber',quantity:24_000,renewPerDay:21,position:{x:79,y:36},accessDifficulty:.28},
    {id:'nov:stone:northwest',type:'stone',quantity:55_000,renewPerDay:0,position:{x:29,y:22},accessDifficulty:.42},
    {id:'nov:stone:southeast',type:'stone',quantity:42_000,renewPerDay:0,position:{x:69,y:74},accessDifficulty:.48},
    {id:'nov:clay:central',type:'clay',quantity:18_000,renewPerDay:.25,position:{x:58,y:48},accessDifficulty:.2},
    {id:'nov:ore:highland',type:'ore',quantity:9_000,renewPerDay:0,position:{x:37,y:69},accessDifficulty:.72}
  ];

  // The island is a closed, convex landmass. The sea is outside the ellipse.
  world.nov={
    protocolVersion:'1.0',
    runId:`nov-${seed}`,
    phase:'genesis',
    researchMode:'independent_observation',
    island:{centerX:50,centerY:50,radiusX:44,radiusY:42},
    materialClosure:true,
    externalContact:false,
    importedObjects:false,
    importedKnowledge:false,
    scriptedInstitutions:false,
    previousRunStateImported:false,
    populationAtGenesis:world.citizens.length,
    genesisWorldMinute:0,
    notes:[
      'All inhabitants begin with individual biological and psychological variation.',
      'No manufactured objects, shelters, stored provisions or cultural records exist at Genesis.',
      'Natural resource deposits exist physically but are not initially known to inhabitants.',
      'No government, religion, currency, school, family system or social hierarchy is pre-created.'
    ]
  };

  // Replace the base-world genesis event so its starter-endowment history cannot leak in.
  world.ledger=[];
  world.ledgerHead='NOV_GENESIS';
  world.worldId=world.nov.runId;
  appendEvent(world,'NOV_WORLD_GENESIS','world',{
    seed,
    population:world.citizens.length,
    island:world.nov.island,
    materialClosure:true,
    externalContact:false,
    importedObjects:false,
    importedKnowledge:false,
    previousRunStateImported:false
  },[],0);

  world.clock.worldMinute=0;
  return world;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {createNovGenesis} from '../nov/genesis.js';
import {startAction} from '../world/actions.js';
import {verifyLedger} from '../world/ledger.js';

test('NOV Genesis is independent, closed and has no imported starter objects',()=>{
  const world=createNovGenesis({seed:17,realEpochMs:1000});
  assert.equal(world.nov.runId,'nov-17');
  assert.equal(world.worldId,'nov-17');
  assert.equal(world.citizens.length,100);
  assert.equal(world.objects.length,0);
  assert.equal(world.buildings.length,0);
  assert.equal(world.projects.length,0);
  assert.equal(world.organizations.length,0);
  assert.equal(world.claims.length,0);
  assert.equal(world.currencySystems.length,0);
  assert.equal(world.reserves.observerEmbodimentKg,0);
  assert.equal(world.nov.externalContact,false);
  assert.equal(world.nov.materialClosure,true);
  assert.equal(world.nov.previousRunStateImported,false);
  assert.ok(world.resourceDeposits.length>0);
  assert.ok(world.citizens.every(c=>c.knowledge.length===0));
  assert.ok(world.ledger.every(e=>e.type==='NOV_WORLD_GENESIS'));
  assert.equal(verifyLedger(world),true);
});

test('NOV inhabitants cannot move beyond the island boundary',()=>{
  const world=createNovGenesis({seed:18,realEpochMs:1000});
  const citizen=world.citizens[0];
  assert.throws(()=>startAction(world,citizen,{
    type:'MOVE',
    targetPosition:{x:99,y:99},
    durationMinutes:1
  }),/nov_island_boundary/);
});

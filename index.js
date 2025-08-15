// index.js — stable, low-lag mineflayer bot (set DEBUG=true for verbose logs)
const DEBUG = false;

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalBlock } = goals;
const mcDataLoader = require('minecraft-data');
const express = require('express');

// ====== State ======
let bot = null;
let mcData = null;
let botSpawned = false;
let followTarget = null;
let defaultMove = null;
let currentTarget = null;
let fatalError = false;
let messageInterval = null;
let lastHitPlayer = null;

const RESCAN_RADIUS = 16;       // how far to search for hostiles
const DROP_TARGET_RANGE = 40;   // stop chasing beyond this
const ATTACK_RANGE = 2.2;       // swing distance
const REPLAN_COOLDOWN = 250;    // ms between path re-plans
let lastReplanAt = 0;

// ====== Hostiles (lowercase short ids) ======
const hostileMobs = new Set([
  'zombie','drowned','skeleton','creeper','spider','cave_spider','husk',
  'witch','piglin','zoglin','phantom','vex',
  'pillager','evoker','vindicator','ravager',
  'enderman','blaze','ghast','magma_cube','slime',
  'warden','silverfish','stray','guardian','elder_guardian',
  'shulker','hoglin','baby_zombie'
]);

// ====== Helpers ======
const logd = (...a) => { if (DEBUG) console.log('[DEBUG]', ...a); };
const safeEntities = () => Object.values(bot?.entities || {});
const normalizeName = (n='') => String(n||'').toLowerCase().replace(/^minecraft:/,'');

// Robust name extraction (no mobType getter spam)
function entityNameSafe(e){
  if (!e) return '';
  try { if (e.displayName) return normalizeName(String(e.displayName)); } catch {}
  if (e.name) return normalizeName(String(e.name));
  return '';
}

function isHostileEntity(e){
  const n = entityNameSafe(e);
  if (!n) return false;
  const simple = n.split(' ').pop().split(':').pop();
  return hostileMobs.has(simple) || hostileMobs.has(n);
}

function distanceToEntity(e){
  if (!e || !bot?.entity) return Infinity;
  try { return bot.entity.position.distanceTo(e.position); } catch { return Infinity; }
}

function getNearestEntity(filter){
  const ents = safeEntities().filter(filter);
  if (!bot || !bot.entity || ents.length === 0) return undefined;
  ents.sort((a,b)=>{
    try { return a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position); }
    catch { return 0; }
  });
  return ents[0];
}

function equipWeapon(){
  if (!bot || !bot.inventory) return Promise.resolve();
  const items = bot.inventory.items();
  const preferred = items.find(i => i.name?.includes('netherite_sword'));
  const fallback = items.find(i => i.name && (i.name.includes('sword') || i.name.includes('axe')));
  const weapon = preferred || fallback;
  if (!weapon) { logd('No weapon found'); return Promise.resolve(); }
  return bot.equip(weapon, 'hand')
    .then(() => logd('Equipped', weapon.name))
    .catch(err => logd('Equip failed:', err?.message));
}

function isWaterBlock(block){
  if (!block) return false;
  const nm = normalizeName(block.name || '');
  return nm.includes('water') || nm.includes('kelp') || nm.includes('seagrass');
}

function clearTarget(){
  currentTarget = null;
  try { bot?.pathfinder?.setGoal(null); } catch {}
}

function maybeReplanFollow(target){
  const now = Date.now();
  if (now - lastReplanAt < REPLAN_COOLDOWN) return;
  lastReplanAt = now;
  try { bot.pathfinder.setGoal(new GoalFollow(target, 1), true); } catch {}
}

// ====== Core combat loop: event-driven on physics ticks ======
function handleCombatTick(){
  if (!botSpawned || bot.health <= 0) return;

  // keep following requested player when idle
  if (!currentTarget && followTarget?.isValid) {
    maybeReplanFollow(followTarget);
  }

  // if we have a target, manage chase/attack
  if (currentTarget && currentTarget.isValid !== false) {
    const dist = distanceToEntity(currentTarget);

    // drop if too far / vanished
    if (dist === Infinity || dist > DROP_TARGET_RANGE || currentTarget.isValid === false) {
      clearTarget();
      return;
    }

    // skip targets standing on water
    try {
      const below = bot.blockAt(currentTarget.position.offset(0, -1, 0));
      if (isWaterBlock(below)) { logd('Target on water, drop', entityNameSafe(currentTarget)); clearTarget(); return; }
    } catch {}

    // chase if far
    if (dist > ATTACK_RANGE) {
      maybeReplanFollow(currentTarget);
      return;
    }

    // close enough: stop pathing & swing
    try { bot.pathfinder.setGoal(null); } catch {}
    try { bot.lookAt(currentTarget.position.offset(0, currentTarget.height || 1.6, 0)); } catch {}
    try { bot.attack(currentTarget); } catch (e) { logd('attack err', e?.message); }
    return;
  }

  // no target: scan for nearest hostile (avoid scanning in water)
  if (!bot.entity?.isInWater) {
    const mob = getNearestEntity(ent =>
      ent && ent.position && isHostileEntity(ent) &&
      ent.position.distanceTo(bot.entity.position) < RESCAN_RADIUS
    );
    if (mob) {
      // avoid mobs standing on water
      try {
        const below = bot.blockAt(mob.position.offset(0,-1,0));
        if (isWaterBlock(below)) return;
      } catch {}
      currentTarget = mob;
      equipWeapon().finally(()=> maybeReplanFollow(mob));
    }
  }
}

// ====== Bot lifecycle ======
function createBot(){
  if (fatalError) return;

  bot = mineflayer.createBot({
    host: 'neymar.aternos.me',
    port: 48991,
    username: 'ronaldinho',
    version: '1.21.1',          // IMPORTANT: match your server version exactly
    // small receive buffer protection
    // client options are inherited from minecraft-protocol; leave defaults
  });

  bot.loadPlugin(pathfinder);

  // extra safety logging around protocol errors (helps with PartialReadError)
  bot._client.on('error', (e)=> console.warn('⚠ protocol error:', e?.message || e));
  bot._client.on('end', ()=> logd('protocol end'));
  bot._client.on('disconnect', (p)=> logd('protocol disconnect', p));

  bot.once('spawn', () => {
    botSpawned = true;
    mcData = mcDataLoader(bot.version);
    
// Movements tuned for low lag & no digging/swimming
    defaultMove = new Movements(bot, mcData);
    defaultMove.allowSprinting = true;
    defaultMove.canDig = false;
    defaultMove.canSwim = true;

    // lower view distance to reduce bandwidth/packet load (tiny|short|normal|far)
    try { bot.settings.viewDistance = 'short'; } catch {}

    equipWeapon();
    console.log('✅ Bot spawned and equipped.');

    // drive combat from physics ticks (20/s), naturally rate-limited by server tick
    bot.on('physicsTick', handleCombatTick);
  });

  function checkDisconnect(reason){
    const msg = String(reason || '').toLowerCase();
    const isFatal = ["kicked","banned","another location","duplicate","connection reset","read error"]
      .some(k => msg.includes(k));
    if (isFatal) {
      fatalError = true;
      console.log('🛑 Fatal disconnect:', reason);
      process.exit(1);
    } else {
      console.log('Disconnect / error:', reason);
    }
  }

  bot.on('login', () => console.log('✅ Logged in.'));
  bot.on('kicked', checkDisconnect);
  bot.on('error', err => { console.warn('⚠ Bot error:', err?.message || err); checkDisconnect(err?.message || err); });
  bot.on('end', () => {
    botSpawned = false;
    clearTarget();
    clearInterval(messageInterval);
    try { bot.removeListener('physicsTick', handleCombatTick); } catch {}
    if (!fatalError) setTimeout(createBot, 5000);
  });
  bot.on('respawn', equipWeapon);
  bot.on('death', clearTarget);

  // Clear target when entity disappears (prevents “chase ghosts”)
  bot.on('entityGone', (e) => {
    if (currentTarget && e && currentTarget.id === e.id) clearTarget();
    if (followTarget && e && followTarget.id === e.id) followTarget = null;
  });

  // ====== Chat commands ======
  bot.on('chat', (username, message) => {
    const msg = String(message||'').toLowerCase();
    const player = bot.players[username]?.entity;
    if (msg === 'woi ikut aq' && player) {
      followTarget = player;
      try { bot.chat('sat'); } catch {}
      maybeReplanFollow(player);
    } else if (msg === 'stop ikut') {
      followTarget = null;
      try { bot.pathfinder.setGoal(null); } catch {}
      try { bot.chat('ok aq stop ikut'); } catch {}
    }
  });

  // ====== Retaliate when hurt ======
  bot.on('entityHurt', (entity) => {
    if (!botSpawned || !entity) return;
    if (entity.uuid === bot.uuid) {
      const attacker = getNearestEntity(e =>
        e && e.position && isHostileEntity(e) && e.position.distanceTo(bot.entity.position) < 6
      );
      if (attacker) {
        logd('Retaliating vs', entityNameSafe(attacker));
        currentTarget = attacker;
        equipWeapon().finally(()=> maybeReplanFollow(attacker));
      }

      // light player retaliation
      const player = getNearestEntity(e => e && e.type === 'player' && e.username !== bot.username && e.position.distanceTo(bot.entity.position) < 4);
      if (player && (!lastHitPlayer || lastHitPlayer.uuid !== player.uuid)) {
        lastHitPlayer = player;
        try { bot.chat('ambik ko'); } catch {}
        try { bot.lookAt(player.position.offset(0, player.height, 0)).then(()=>bot.attack(player)).catch(()=>{}); } catch {}
        setTimeout(()=>{ lastHitPlayer = null; }, 9000);
      }
    }
  });

  // ====== Optional periodic chat ======
  const messages = [
    "mne iman my love","keje koloh dh siapka","bising bdo karina","mne iqbal",
    "amirul hadif x nurul iman very very sweet good","gpp jadi sok asik asalkan aq tolong on kan server ni 24 jam",
    "duatiga duatiga dua empat","boikot perempuan nme sofea pantek jubo lahanat","if u wana kno spe sofea hmm i dono",
    "bising do bal","ko un sme je man","apa ko bob","okok ma bad ma fault gng🥀",
    "sat berak sat","sunyi siak","MUSTARRRRRRRDDDDDDDD","ok aq ulang blik dri awal"
  ];
  let chatIndex = 0;
  messageInterval = setInterval(() => {
    if (botSpawned && bot.health > 0) {
      try { bot.chat(messages[chatIndex]); chatIndex = (chatIndex + 1) % messages.length; } catch {}
    }
  }, 90000);
}

createBot();

// ====== Keep-alive HTTP ======
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('Mineflayer bot is running!'));
app.listen(port, () => console.log(`🌐 Server running on port ${port}`));

// ====== Global error traps (don’t crash on async) ======
process.on('uncaughtException', err => console.error('❌ Uncaught Exception:', err));
process.on('unhandledRejection', err => console.error('❌ Unhandled Rejection:', err));

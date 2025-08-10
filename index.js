// index.js — improved mineflayer bot (set DEBUG=true for diagnostics)
const DEBUG = true; // set true to print diagnostic logs

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalNear, GoalBlock } = goals;
const mcDataLoader = require('minecraft-data');
const express = require('express');

let bot = null;
let mcData = null;
let botSpawned = false;
let followTarget = null;
let defaultMove = null;
let currentTarget = null;
let attackInterval = null;
let fatalError = false;
let messageInterval = null;
let lastHitPlayer = null;

const hostileMobs = new Set([
  'zombie','drowned','skeleton','creeper','spider','cave_spider','husk',
  'witch','zombified_piglin','zoglin','phantom','vex',
  'pillager','evoker','vindicator','ravager',
  'enderman','blaze','ghast','magma_cube','slime',
  'warden','silverfish','stray','guardian','elder_guardian',
  'shulker','hoglin'
]);

function logd(...args){ if (DEBUG) console.log('[DEBUG]', ...args); }
function safeEntities(){ return Object.values(bot?.entities || {}); }
function normalizeName(name = ''){ return String(name || '').toLowerCase().replace(/^minecraft:/, ''); }

// Robust conversion of entity name/displayName to plain lowercase id-like text
function entityNameSafe(e){
  if (!e) return '';
  // displayName may be a ChatMessage object; String(...) yields readable text
  try {
    if (e.displayName) return normalizeName(String(e.displayName));
  } catch(_) {}
  if (e.name) return normalizeName(String(e.name));
  // older versions / some plugins use mobType (deprecated) — include as last resort
  try { if (e.mobType) return normalizeName(String(e.mobType)); } catch(_) {}
  return '';
}

function isHostileEntity(e){
  const n = entityNameSafe(e);
  if (!n) return false;
  // Some servers prefix or localize names, try to reduce: take last segment after ":" or spaces
  const simple = n.split(' ').pop().split(':').pop();
  return hostileMobs.has(simple) || hostileMobs.has(n);
}

function distanceToEntity(e){
  if (!e || !bot?.entity) return Infinity;
  try { return bot.entity.position.distanceTo(e.position); } catch(_) { return Infinity; }
}

function getNearestEntity(filter){
  const ents = safeEntities().filter(filter);
  if (!bot || !bot.entity) return undefined;
  ents.sort((a,b) => {
    try { return a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position); }
    catch(_) { return 0; }
  });
  return ents[0];
}

function equipWeapon(){
  if (!bot || !bot.inventory) return Promise.resolve();
  const items = bot.inventory.items();
  const preferred = items.find(i => i.name && i.name.includes('netherite_sword'));
  const fallback = items.find(i => i.name && (i.name.includes('sword') || i.name.includes('axe')));
  const weapon = preferred || fallback;
  if (!weapon) { logd('No weapon in inventory'); return Promise.resolve(); }
  return bot.equip(weapon, 'hand').then(() => logd('Equipped', weapon.name)).catch(err => logd('Equip failed', err && err.message));
}

function isWaterBlock(block){
  if (!block) return false;
  const nm = normalizeName(block.name || '');
  return nm.includes('water') || nm.includes('kelp') || nm.includes('seagrass');
}

function clearAttack(){
  if (attackInterval) { clearInterval(attackInterval); attackInterval = null; }
  currentTarget = null;
  try { bot?.pathfinder?.setGoal(null); } catch(_) {}
}

function attackEntity(entity){
  if (!botSpawned || !entity || bot.health <= 0) return;
  if (entity.isValid === false) return;
  if (currentTarget && currentTarget.uuid === entity.uuid && attackInterval) return;

  // avoid chasing mobs that are standing on water (optional)
  try {
    if (entity.position) {
      const below = bot.blockAt(entity.position.offset(0, -1, 0));
      if (isWaterBlock(below)) { logd('Skipping mob in water:', entityNameSafe(entity)); return; }
    }
  } catch(_) {}

  clearAttack();
  currentTarget = entity;

  equipWeapon().finally(() => {
    try {
      // force follow so pathfinder keeps replanning while mob moves
      bot.pathfinder.setGoal(new GoalFollow(entity, 1), true);
      logd('Chasing', entityNameSafe(entity));
    } catch(err) {
      logd('setGoal follow error:', err && err.message);
    }
  });

  attackInterval = setInterval(async () => {
    if (!entity || entity.isValid === false || bot.health <= 0) { clearAttack(); return; }

    const dist = distanceToEntity(entity);
    logd('attackLoop', entityNameSafe(entity), 'dist', dist.toFixed ? dist.toFixed(2) : dist);

    // if target disappeared or far away — drop it
    if (dist === Infinity || dist > 40) { clearAttack(); return; }

    // if still far, keep following (force)
    if (dist > 2.2) {
      try { bot.pathfinder.setGoal(new GoalFollow(entity, 1), true); } catch(_) {}
      return;
    }

    // close enough: stop pathfinder and attack directly
    try { bot.pathfinder.setGoal(null); } catch(_) {}
    try { await bot.lookAt(entity.position.offset(0, entity.height, 0)); } catch(_) {}
    try { bot.attack(entity); } catch(err) { logd('attack err', err && err.message); }
  }, 300);
}

function createBot(){
  if (fatalError) return;

  bot = mineflayer.createBot({
    host: 'neymar.aternos.me',
    port: 48991,
    username: 'ronaldinho',
    version: '1.21.1'
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    botSpawned = true;
    mcData = mcDataLoader(bot.version);

    defaultMove = new Movements(bot, mcData);
    defaultMove.allowSprinting = true;
    defaultMove.canDig = false;

    for (const nm of ['water', 'flowing_water', 'kelp', 'seagrass']) {
      const b = mcData.blocksByName?.[nm];
      if (b) defaultMove.blocksToAvoid.add(b.id);
    }
    defaultMove.canSwim = false;
    bot.pathfinder.setMovements(defaultMove);

    equipWeapon();
    console.log('✅ Bot spawned and equipped.');
  });

  function checkDisconnect(reason){
    const msg = String(reason || '').toLowerCase();
    const isFatal = ["kicked","banned","another location","duplicate","connection reset","read error"]
      .some(k => msg.includes(k));
    if (isFatal) { fatalError = true; console.log('🛑 Fatal disconnect:', reason); process.exit(1); }
    else console.log('Disconnect / error:', reason);
  }

  bot.on('login', () => console.log('✅ Logged in.'));
  bot.on('kicked', checkDisconnect);
  bot.on('error', err => checkDisconnect(err?.message || err));
  bot.on('end', () => { clearAttack(); clearInterval(messageInterval); botSpawned = false; if (!fatalError) setTimeout(createBot, 5000); });
  bot.on('respawn', equipWeapon);
  bot.on('death', clearAttack);

  // follow commands
  bot.on('chat', (username, message) => {
    const msg = String(message || '').toLowerCase();
    const player = bot.players[username]?.entity;
    if (msg === 'woi ikut aq' && player) {
      followTarget = player;
      try { bot.chat('sat'); } catch(_) {}
      try { bot.pathfinder.setGoal(new GoalFollow(player, 1), true); } catch(_) {}
    } else if (msg === 'woi stop ikut') {
      followTarget = null;
      try { bot.pathfinder.setGoal(null); } catch(_) {}
      try { bot.chat('ok aq stop ikut'); } catch(_) {}
    }
  });

  // auto-hunt loop
  setInterval(() => {
    if (!botSpawned || bot.health <= 0) return;
    if (bot.entity?.isInWater) return; // don't hunt while in water

    // drop invalid or too-far current target
    if (currentTarget && (currentTarget.isValid === false || distanceToEntity(currentTarget) > 40)) clearAttack();
    if (currentTarget && currentTarget.isValid !== false && distanceToEntity(currentTarget) <= 40) return;

    const mob = getNearestEntity(e =>
      e && e.position && isHostileEntity(e) && e.position.distanceTo(bot.entity.position) < 16
    );

    if (mob) {
      logd('Found mob', entityNameSafe(mob), 'dist', distanceToEntity(mob).toFixed(2));
      attackEntity(mob);
    } else if (followTarget && followTarget.isValid) {
      try { bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true); } catch(_) {}
    }
  }, 800);

  // silent water escape (no chat)
  setInterval(() => {
    if (!botSpawned || !bot.entity?.isInWater) return;
    const land = bot.findBlock({
      matching: b => b && b.boundingBox === 'block' && !normalizeName(b.name).includes('water'),
      maxDistance: 12,
      point: bot.entity.position
    });
    if (land) {
      try { bot.pathfinder.setGoal(new GoalBlock(land.position.x, land.position.y, land.position.z)); } catch(_) {}
    } else {
      bot.setControlState('jump', true);
      bot.setControlState('forward', true);
      setTimeout(() => { bot.setControlState('jump', false); bot.setControlState('forward', false); }, 1200);
    }
  }, 1400);

  // retaliate on hurt
  bot.on('entityHurt', (entity) => {
    if (!botSpawned || !entity) return;
    if (entity.uuid === bot.uuid) {
      const attacker = getNearestEntity(e =>
        e && e.position && isHostileEntity(e) && e.position.distanceTo(bot.entity.position) < 6
      );
      if (attacker) {
        logd('Retaliating vs', entityNameSafe(attacker));
        attackEntity(attacker);
      }

      const player = getNearestEntity(e => e && e.type === 'player' && e.username !== bot.username && e.position.distanceTo(bot.entity.position) < 4);
      if (player && (!lastHitPlayer || lastHitPlayer.uuid !== player.uuid)) {
        lastHitPlayer = player;
        try { bot.chat('ambik ko'); } catch(_) {}
        try { bot.lookAt(player.position.offset(0, player.height, 0)).then(()=>bot.attack(player)).catch(()=>{}); } catch(_) {}
        setTimeout(()=>{ lastHitPlayer = null; }, 9000);
      }
    }
  });

  // periodic chat (optional)
  const messages = [ "mne iman my love", "kaya siak server baru", "bising bdo karina", "mne iqbal", "amirul hadif x nurul iman very very sweet good", "gpp jadi sok asik asalkan aq tolong on kan server ni 24 jam", "duatiga duatiga dua empat", "boikot perempuan nme sofea pantek jubo lahanat", "if u wana kno spe sofea hmm i dono", "bising do bal", "ko un sme je man", "apa ko bob", "okok ma bad ma fault gng🥀", "sat berak sat", "sunyi siak", "MUSTARRRRRRRDDDDDDDD", "ok aq ulang blik dri awal" ];
  let chatIndex = 0;
  messageInterval = setInterval(() => {
    if (botSpawned && bot.health > 0) {
      try { bot.chat(messages[chatIndex]); chatIndex = (chatIndex + 1) % messages.length; } catch(_) {}
    }
  }, 90000);
}

createBot();

// keep-alive endpoint
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('Mineflayer bot is running!'));
app.listen(port, () => console.log(`🌐 Server running on port ${port}`));

process.on('uncaughtException', err => console.error('❌ Uncaught Exception:', err));
process.on('unhandledRejection', err => console.error('❌ Unhandled Rejection:', err));

// index.js - cleaned & improved mineflayer bot

// == CONFIG ==
const DEBUG = false; // set true to print diagnostic logs

// == IMPORTS ==
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalNear, GoalBlock } = goals;
const mcDataLoader = require('minecraft-data');
const express = require('express');

// == STATE ==
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

// == HOSTILE MOBS (lowercase simple names) ==
const hostileMobs = new Set([
  'zombie','drowned','skeleton','creeper','spider','husk',
  'witch','zombified_piglin','zoglin','phantom','vex',
  'pillager','evoker','vindicator','ravager',
  'enderman','blaze','ghast','magma_cube','slime',
  'warden','silverfish','stray','guardian','elder_guardian',
  'shulker','hoglin','cave_spider'
]);

// == HELPERS ==
function logd(...args) { if (DEBUG) console.log('[DEBUG]', ...args); }
function safeEntities() { return Object.values(bot?.entities || {}); }
function normalizeName(name = '') { return String(name || '').toLowerCase().replace(/^minecraft:/, ''); }
function isHostileEntity(e) {
  if (!e) return false;
  // Some entities expose .name, some .mobType, fallback to displayName
  const raw = e.name || e.mobType || e.displayName || '';
  const n = normalizeName(raw);
  return hostileMobs.has(n);
}
function distanceToEntity(e) {
  if (!e || !bot.entity) return Infinity;
  try { return bot.entity.position.distanceTo(e.position); } catch (_) { return Infinity; }
}
function getNearestEntity(filter) {
  const ents = safeEntities().filter(filter);
  if (!bot || !bot.entity) return undefined;
  ents.sort((a, b) => a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position));
  return ents[0];
}
function equipWeapon() {
  if (!bot || !bot.inventory) return Promise.resolve();
  // prefer netherite sword
  const items = bot.inventory.items();
  const preferred = items.find(i => i.name && i.name.includes('netherite_sword'));
  const fallback = items.find(i => i.name && (i.name.includes('sword') || i.name.includes('axe')));
  const weapon = preferred || fallback;
  if (!weapon) {
    logd('No weapon found in inventory');
    return Promise.resolve();
  }
  return bot.equip(weapon, 'hand').then(() => logd('Equipped', weapon.name)).catch(err => {
    logd('Failed to equip', err && err.message ? err.message : err);
  });
}

// Check whether a block is water-like
function isWaterBlock(block) {
  if (!block) return false;
  const nm = normalizeName(block.name || '');
  return nm.includes('water') || nm.includes('kelp') || nm.includes('seagrass');
}

// == ATTACK LOGIC ==
function clearAttack() {
  if (attackInterval) {
    clearInterval(attackInterval);
    attackInterval = null;
  }
  currentTarget = null;
  if (bot && bot.pathfinder) bot.pathfinder.setGoal(null);
}

function attackEntity(entity) {
  if (!botSpawned || !entity || bot.health <= 0) return;
  // entity validity: some mineflayer builds have entity.isValid; if missing, assume valid if has position
  if (entity.isValid === false) return;
  if (currentTarget && currentTarget.uuid === entity.uuid && attackInterval) return;

  // If mob stands on water, skip (prevent bot going into water)
  try {
    const blockBelow = bot.blockAt(entity.position.offset(0, -1, 0));
    if (isWaterBlock(blockBelow)) {
      logd('Skipping entity in water:', entity.name);
      return;
    }
  } catch (_) {}

  clearAttack();
  currentTarget = entity;

  equipWeapon().finally(() => {
    // start following (pathfinder will try to chase)
    try {
      bot.pathfinder.setGoal(new GoalFollow(entity, 1), false);
    } catch (err) {
      logd('setGoal follow error:', err && err.message ? err.message : err);
    }
  });

  attackInterval = setInterval(async () => {
    if (!entity || entity.isValid === false || bot.health <= 0) {
      clearAttack();
      return;
    }
    const dist = distanceToEntity(entity);
    logd(`attacking loop — ${entity.name} dist:${dist.toFixed(2)}`);
    if (dist > 5.0) {
      // re-follow if far
      try { bot.pathfinder.setGoal(new GoalFollow(entity, 1), false); } catch (_) {}
      return;
    }
    // fine-tune position and attack
    try {
      bot.pathfinder.setGoal(new GoalNear(entity.position.x, entity.position.y, entity.position.z, 1.2));
    } catch (_) {}
    try { await bot.lookAt(entity.position.offset(0, entity.height, 0)); } catch (_) {}
    try { bot.attack(entity); } catch (err) { logd('attack() error', err && err.message ? err.message : err); }
  }, 350);
}

// == CREATE BOT ==
function createBot() {
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

    // avoid common water blocks if present
    const waterNames = ['water', 'flowing_water', 'kelp', 'seagrass'];
    for (const name of waterNames) {
      const b = mcData.blocksByName?.[name];
      if (b) defaultMove.blocksToAvoid.add(b.id);
    }
    defaultMove.canSwim = false;
    bot.pathfinder.setMovements(defaultMove);

    equipWeapon();
    console.log('✅ Bot spawned and equipped (if possible).');
  });

  function checkDisconnect(reason) {
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
  bot.on('error', err => {
    console.warn('⚠ Bot error:', err?.message || err);
    checkDisconnect(err?.message || err);
  });

  bot.on('end', () => {
    console.log('🔌 End event - disconnected.');
    clearAttack();
    clearInterval(messageInterval);
    currentTarget = null;
    botSpawned = false;
    if (!fatalError) setTimeout(createBot, 5000);
  });

  bot.on('respawn', () => {
    equipWeapon();
  });

  bot.on('death', () => {
    logd('Bot died — clearing state');
    clearAttack();
  });

  // CHAT: follow commands
  bot.on('chat', (username, message) => {
    const msg = String(message || '').toLowerCase();
    const player = bot.players[username]?.entity;
    if (msg === 'woi ikut aq' && player) {
      followTarget = player;
      try { bot.chat('sat'); } catch (_) {}
      try { bot.pathfinder.setGoal(new GoalFollow(player, 1), true); } catch (_) {}
    } else if (msg === 'woi stop ikut') {
      followTarget = null;
      try { bot.pathfinder.setGoal(null); } catch (_) {}
      try { bot.chat('ok aq stop ikut'); } catch (_) {}
    }
  });

  // auto-hunt loop
  setInterval(() => {
    if (!botSpawned || bot.health <= 0) return;
    // don't hunt while in water
    if (bot.entity?.isInWater) return;
    // if already attacking something valid, skip search
    if (currentTarget && (currentTarget.isValid !== false)) return;

    // find nearest hostile mob within radius
    const mob = getNearestEntity(e =>
      e && e.position && isHostileEntity(e) && e.position.distanceTo(bot.entity.position) < 16
    );

    if (mob) {
      logd('Found mob to attack:', mob.name, 'dist', distanceToEntity(mob).toFixed(2));
      attackEntity(mob);
    } else if (followTarget && followTarget.isValid) {
      try { bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true); } catch (_) {}
    }
  }, 1100);

  // silent water escape
  setInterval(() => {
    if (!botSpawned) return;
    if (!bot.entity?.isInWater) return;

    const land = bot.findBlock({
      matching: b => b && b.boundingBox === 'block' && !normalizeName(b.name).includes('water'),
      maxDistance: 12,
      point: bot.entity.position
    });

    if (land) {
      try { bot.pathfinder.setGoal(new GoalBlock(land.position.x, land.position.y, land.position.z)); } catch (_) {}
    } else {
      // fallback: try move forward / jump briefly
      bot.setControlState('jump', true);
      bot.setControlState('forward', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
        bot.setControlState('forward', false);
      }, 1200);
    }
  }, 1400);

  // retaliate when hurt
  bot.on('entityHurt', (entity) => {
    if (!botSpawned || !entity) return;
    if (entity.uuid === bot.uuid) {
      // find nearby hostile mob attacker
      const attacker = getNearestEntity(e =>
        e && e.position && isHostileEntity(e) && e.position.distanceTo(bot.entity.position) < 6
      );
      if (attacker) {
        logd('Retaliating vs mob:', attacker.name);
        attackEntity(attacker);
      }
      // if a player hit us, hit them back once
      const player = getNearestEntity(e =>
        e && e.type === 'player' && e.username !== bot.username && e.position.distanceTo(bot.entity.position) < 4
      );
      if (player && (!lastHitPlayer || lastHitPlayer.uuid !== player.uuid)) {
        lastHitPlayer = player;
        try { bot.chat('ambik ko'); } catch (_) {}
        try {
          bot.lookAt(player.position.offset(0, player.height, 0))
            .then(() => bot.attack(player))
            .catch(() => {});
        } catch (_) {}
        setTimeout(() => { lastHitPlayer = null; }, 9000);
      }
    }
  });

  // optional periodic chat (unchanged)
  const messages = [
    "mne iman my love", "kaya siak server baru", "bising bdo karina", "mne iqbal",
    "amirul hadif x nurul iman very very sweet good", "gpp jadi sok asik asalkan aq tolong on kan server ni 24 jam",
    "duatiga duatiga dua empat", "boikot perempuan nme sofea pantek jubo lahanat",
    "if u wana kno spe sofea hmm i dono", "bising do bal", "ko un sme je man",
    "apa ko bob", "okok ma bad ma fault gng🥀", "sat berak sat", "sunyi siak",
    "MUSTARRRRRRRDDDDDDDD", "ok aq ulang blik dri awal"
  ];
  let chatIndex = 0;
  messageInterval = setInterval(() => {
    if (botSpawned && bot.health > 0) {
      try {
        bot.chat(messages[chatIndex]);
        chatIndex = (chatIndex + 1) % messages.length;
      } catch (_) {}
    }
  }, 90000);
}

// start
createBot();

// keep-alive web endpoint
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('Mineflayer bot is running!'));
app.listen(port, () => console.log(`🌐 Server running on port ${port}`));

// global safety
process.on('uncaughtException', err => console.error('❌ Uncaught Exception:', err));
process.on('unhandledRejection', err => console.error('❌ Unhandled Rejection:', err));

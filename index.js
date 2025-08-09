// index.js — cleaned & fixed mineflayer bot
const DEBUG = false;
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalBlock } = goals;
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

// == HOSTILE MOBS ==
const hostileMobs = new Set([
  'zombie', 'drowned', 'skeleton', 'creeper', 'spider', 'husk',
  'witch', 'zombified_piglin', 'zoglin', 'phantom', 'vex',
  'pillager', 'evoker', 'vindicator', 'ravager',
  'enderman', 'blaze', 'ghast', 'magma_cube', 'slime',
  'warden', 'silverfish', 'stray', 'guardian', 'elder_guardian',
  'shulker', 'hoglin', 'cave_spider'
]);

// == HELPERS ==
function logd(...args) { if (DEBUG) console.log('[DEBUG]', ...args); }
function safeEntities() { return Object.values(bot?.entities || {}); }
function normalizeName(name = '') { return String(name || '').toLowerCase().replace(/^minecraft:/, ''); }
function isHostileEntity(e) {
  if (!e) return false;
  const raw = e.name || e.mobType || e.displayName || '';
  return hostileMobs.has(normalizeName(raw));
}
function distanceToEntity(e) {
  if (!e || !bot.entity) return Infinity;
  try { return bot.entity.position.distanceTo(e.position); } catch { return Infinity; }
}
function getNearestEntity(filter) {
  const ents = safeEntities().filter(filter);
  if (!bot || !bot.entity) return undefined;
  ents.sort((a, b) => a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position));
  return ents[0];
}
function equipWeapon() {
  if (!bot || !bot.inventory) return Promise.resolve();
  const items = bot.inventory.items();
  const preferred = items.find(i => i.name?.includes('netherite_sword'));
  const fallback = items.find(i => i.name?.includes('sword') || i.name?.includes('axe'));
  const weapon = preferred || fallback;
  if (!weapon) return Promise.resolve();
  return bot.equip(weapon, 'hand').catch(() => {});
}
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
  bot?.pathfinder?.setGoal(null);
}

function attackEntity(entity) {
  if (!botSpawned || !entity || bot.health <= 0) return;
  if (entity.isValid === false) return;
  if (currentTarget && currentTarget.uuid === entity.uuid && attackInterval) return;

  try {
    const blockBelow = bot.blockAt(entity.position.offset(0, -1, 0));
    if (isWaterBlock(blockBelow)) {
      logd('Skipping entity in water:', entity.name);
      return;
    }
  } catch {}

  clearAttack();
  currentTarget = entity;

  equipWeapon().finally(() => {
    try { bot.pathfinder.setGoal(new GoalFollow(entity, 1), false); } catch {}
  });

  attackInterval = setInterval(async () => {
    if (!entity || entity.isValid === false || bot.health <= 0) {
      clearAttack();
      return;
    }

    const dist = distanceToEntity(entity);
    if (dist > 20) { // too far
      clearAttack();
      return;
    }

    if (dist > 1.8) {
      try { bot.pathfinder.setGoal(new GoalFollow(entity, 1), false); } catch {}
      return;
    }

    bot.pathfinder.setGoal(null);
    try { await bot.lookAt(entity.position.offset(0, entity.height, 0)); } catch {}
    try { bot.attack(entity); } catch {}
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

    for (const name of ['water', 'flowing_water', 'kelp', 'seagrass']) {
      const b = mcData.blocksByName?.[name];
      if (b) defaultMove.blocksToAvoid.add(b.id);
    }
    defaultMove.canSwim = false;
    bot.pathfinder.setMovements(defaultMove);

    equipWeapon();
    console.log('✅ Bot spawned and equipped.');
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
  bot.on('error', err => checkDisconnect(err?.message || err));
  bot.on('end', () => {
    clearAttack();
    clearInterval(messageInterval);
    botSpawned = false;
    if (!fatalError) setTimeout(createBot, 5000);
  });
  bot.on('respawn', equipWeapon);
  bot.on('death', clearAttack);

  // follow commands
  bot.on('chat', (username, message) => {
    const msg = String(message || '').toLowerCase();
    const player = bot.players[username]?.entity;
    if (msg === 'woi ikut aq' && player) {
      followTarget = player;
      bot.chat('sat');
      bot.pathfinder.setGoal(new GoalFollow(player, 1), true);
    } else if (msg === 'woi stop ikut') {
      followTarget = null;
      bot.pathfinder.setGoal(null);
      bot.chat('ok aq stop ikut');
    }
  });

  // auto-hunt loop
  setInterval(() => {
    if (!botSpawned || bot.health <= 0) return;
    if (bot.entity?.isInWater) return;

    // drop target if invalid or too far
    if (currentTarget && (currentTarget.isValid === false || distanceToEntity(currentTarget) > 20)) {
      clearAttack();
    }

    if (currentTarget && currentTarget.isValid !== false && distanceToEntity(currentTarget) <= 20) return;

    const mob = getNearestEntity(e =>
      e && e.position && isHostileEntity(e) && e.position.distanceTo(bot.entity.position) < 16
    );

    if (mob) {
      attackEntity(mob);
    } else if (followTarget && followTarget.isValid) {
      bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true);
    }
  }, 500);

  // escape water
  setInterval(() => {
    if (!botSpawned || !bot.entity?.isInWater) return;
    const land = bot.findBlock({
      matching: b => b && b.boundingBox === 'block' && !normalizeName(b.name).includes('water'),
      maxDistance: 12,
      point: bot.entity.position
    });
    if (land) {
      bot.pathfinder.setGoal(new GoalBlock(land.position.x, land.position.y, land.position.z));
    } else {
      bot.setControlState('jump', true);
      bot.setControlState('forward', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
        bot.setControlState('forward', false);
      }, 1200);
    }
  }, 1400);

  // retaliation
  bot.on('entityHurt', entity => {
    if (!botSpawned || !entity) return;
    if (entity.uuid === bot.uuid) {
      const attacker = getNearestEntity(e =>
        e && e.position && isHostileEntity(e) && e.position.distanceTo(bot.entity.position) < 6
      );
      if (attacker) attackEntity(attacker);

      const player = getNearestEntity(e =>
        e && e.type === 'player' && e.username !== bot.username && e.position.distanceTo(bot.entity.position) < 4
      );
      if (player && (!lastHitPlayer || lastHitPlayer.uuid !== player.uuid)) {
        lastHitPlayer = player;
        bot.chat('ambik ko');
        bot.lookAt(player.position.offset(0, player.height, 0))
          .then(() => bot.attack(player))
          .catch(() => {});
        setTimeout(() => { lastHitPlayer = null; }, 9000);
      }
    }
  });

  // periodic chat
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
      bot.chat(messages[chatIndex]);
      chatIndex = (chatIndex + 1) % messages.length;
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

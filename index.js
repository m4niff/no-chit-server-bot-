// == IMPORTS ==
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalNear, GoalBlock } = goals;
const mcDataLoader = require('minecraft-data');
const express = require('express');

// == STATE ==
let bot;
let mcData;
let botSpawned = false;
let followTarget = null;
let defaultMove;
let currentTarget = null;
let attackInterval = null;
let fatalError = false;
let messageInterval = null;
let lastHitPlayer = null;

// == HOSTILE MOBS (lowercase names) ==
const hostileMobs = new Set([
  'zombie','drowned','skeleton','creeper','spider','husk',
  'witch','zombified_piglin','zoglin','phantom','vex',
  'pillager','evoker','vindicator','ravager',
  'enderman','blaze','ghast','magma_cube','slime',
  'warden','silverfish','stray','guardian','elder_guardian',
  'shulker','hoglin'
]);

// == UTILITIES ==
function safeEntities() {
  return Object.values(bot?.entities || {});
}

function normalizeName(name = '') {
  return String(name).toLowerCase().replace(/^minecraft:/, '');
}

function isHostileEntity(e) {
  if (!e || e.type !== 'mob') return false;
  // entity .name or .mobType or .displayName — try these possibilities
  const name = normalizeName(e.name || e.mobType || e.displayName || '');
  return hostileMobs.has(name);
}

function getNearestEntity(filter) {
  const ents = safeEntities().filter(filter);
  if (!bot || !bot.entity) return undefined;
  ents.sort((a, b) => a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position));
  return ents[0];
}

function equipWeapon() {
  if (!bot || !bot.inventory) return Promise.resolve();
  const preferred = bot.inventory.items().find(i => i.name && i.name.includes('netherite_sword'));
  const fallback = bot.inventory.items().find(i => i.name && (i.name.includes('sword') || i.name.includes('axe')));
  const weapon = preferred || fallback;
  if (weapon) return bot.equip(weapon, 'hand').catch(() => {});
  return Promise.resolve();
}

// == ATTACK LOGIC ==
function attackEntity(entity) {
  if (!botSpawned || !entity || !entity.position || bot.health <= 0) return;
  if (!entity.isValid) return;
  if (currentTarget?.uuid === entity.uuid && attackInterval) return;

  // Skip mobs standing in water (optional)
  try {
    const blockBelow = bot.blockAt(entity.position.offset(0, -1, 0));
    if (blockBelow && normalizeName(blockBelow.name).includes('water')) {
      return;
    }
  } catch (_) {}

  clearInterval(attackInterval);
  currentTarget = entity;

  equipWeapon().finally(() => {
    // start following (non-forced, so pathfinder will pursue)
    bot.pathfinder.setGoal(new GoalFollow(entity, 1), false);
  });

  // Attack loop (keeps attempting until entity invalid or bot dead)
  attackInterval = setInterval(async () => {
    if (!entity?.isValid || bot.health <= 0) {
      clearInterval(attackInterval);
      attackInterval = null;
      currentTarget = null;
      bot.pathfinder.setGoal(null);
      return;
    }

    const dist = bot.entity.position.distanceTo(entity.position);

    // If too far, re-follow
    if (dist > 4.5) {
      bot.pathfinder.setGoal(new GoalFollow(entity, 1), false);
      return;
    }

    // close enough: fine tune position and attack
    bot.pathfinder.setGoal(new GoalNear(entity.position.x, entity.position.y, entity.position.z, 1.5));
    try { await bot.lookAt(entity.position.offset(0, entity.height, 0)); } catch (_) {}
    try { bot.attack(entity); } catch (_) {}
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

    // Avoid common water blocks
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
    clearInterval(attackInterval);
    clearInterval(messageInterval);
    currentTarget = null;
    botSpawned = false;
    if (!fatalError) setTimeout(createBot, 5000);
  });

  bot.on('respawn', equipWeapon);

  bot.on('death', () => {
    console.log('☠️ Bot died.');
    clearInterval(attackInterval);
    attackInterval = null;
    currentTarget = null;
  });

  // == CHAT COMMANDS ==
  bot.on('chat', (username, message) => {
    const msg = String(message || '').toLowerCase();
    const player = bot.players[username]?.entity;
    if (msg === 'woi ikut aq' && player) {
      followTarget = player;
      try { bot.chat('sat'); } catch (_) {}
      bot.pathfinder.setGoal(new GoalFollow(player, 1), true);
    } else if (msg === 'woi stop ikut') {
      followTarget = null;
      bot.pathfinder.setGoal(null);
      try { bot.chat('ok aq stop ikut'); } catch (_) {}
    }
  });

  // == AUTO HUNT LOOP ==
  setInterval(() => {
    if (!botSpawned || bot.health <= 0) return;
    if (bot.entity?.isInWater) return; // don't hunt in water

    // if already attacking a valid target, skip
    if (currentTarget && currentTarget.isValid) return;

    const mob = getNearestEntity(e =>
      e && e.position && isHostileEntity(e) &&
      e.position.distanceTo(bot.entity.position) < 16
    );

    if (mob) {
      attackEntity(mob);
    } else if (followTarget && followTarget.isValid) {
      bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true);
    }
  }, 1200);

  // == SILENT WATER ESCAPE ==
  setInterval(() => {
    if (!botSpawned) return;
    if (!bot.entity?.isInWater) return;

    const land = bot.findBlock({
      matching: b => b && b.boundingBox === 'block' && !normalizeName(b.name).includes('water'),
      maxDistance: 12,
      point: bot.entity.position
    });

    if (land) {
      // silent: do NOT chat
      bot.pathfinder.setGoal(new GoalBlock(land.position.x, land.position.y, land.position.z));
    } else {
      // fallback: try to move/jump forward briefly
      bot.setControlState('jump', true);
      bot.setControlState('forward', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
        bot.setControlState('forward', false);
      }, 1200);
    }
  }, 1500);

  // == RETALIATE WHEN HURT ==
  bot.on('entityHurt', (entity) => {
    if (!botSpawned || !entity) return;
    // if bot was hurt
    if (entity.uuid === bot.uuid) {
      // try find a nearby hostile mob attacker
      const attacker = getNearestEntity(e =>
        e && e.position && isHostileEntity(e) && e.position.distanceTo(bot.entity.position) < 6
      );
      if (attacker) attackEntity(attacker);

      // if a player hit us, respond once
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

  // == AUTO CHAT (optional) ==
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

// == KEEP ALIVE ==
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('Mineflayer bot is running!'));
app.listen(port, () => console.log(`🌐 Server running on port ${port}`));

// global safety
process.on('uncaughtException', err => console.error('❌ Uncaught Exception:', err));
process.on('unhandledRejection', err => console.error('❌ Unhandled Rejection:', err));

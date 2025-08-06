// == IMPORTS ==
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalBlock } = goals;
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

// == HOSTILE MOBS ==
const hostileMobs = [
  'zombie', 'drowned', 'skeleton', 'creeper', 'spider', 'husk',
  'witch', 'zombified_piglin', 'zoglin', 'phantom', 'vex',
  'pillager', 'evoker', 'vindicator', 'ravager'
];

// == UTILITIES ==
function getNearestEntity(filter) {
  return Object.values(bot.entities)
    .filter(filter)
    .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];
}

function equipWeapon() {
  const weapon = bot.inventory.items().find(item =>
    item.name.includes('netherite_sword') ||
    item.name.includes('sword') ||
    item.name.includes('axe')
  );
  if (weapon) {
    bot.equip(weapon, 'hand').catch(() => {});
  }
}

function attackEntity(entity) {
  if (!entity?.isValid || bot.health <= 0) return;
  if (currentTarget?.uuid === entity.uuid && attackInterval) return;

  clearInterval(attackInterval);
  currentTarget = entity;
  equipWeapon();

  bot.pathfinder.setGoal(new GoalFollow(entity, 1), false);

  attackInterval = setInterval(() => {
    if (!entity?.isValid || bot.health <= 0) {
      clearInterval(attackInterval);
      attackInterval = null;
      currentTarget = null;
      return;
    }

    const dist = bot.entity.position.distanceTo(entity.position);
    if (dist < 3.5) {
      bot.lookAt(entity.position.offset(0, entity.height, 0))
        .then(() => bot.attack(entity))
        .catch(() => {});
    }
  }, 500);
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
    defaultMove.canSwim = false;

    const waterBlock = mcData.blocksByName?.water;
    const flowingWaterBlock = mcData.blocksByName?.flowing_water;

    if (waterBlock) defaultMove.blocksToAvoid.add(waterBlock.id);
    if (flowingWaterBlock) defaultMove.blocksToAvoid.add(flowingWaterBlock.id);

    bot.pathfinder.setMovements(defaultMove);
    equipWeapon(); // Equip weapon after spawn
  });

  function checkDisconnect(reason) {
    const msg = String(reason).toLowerCase();
    const isFatal = ["kicked", "banned", "another location", "duplicate", "connection reset", "read error"]
      .some(k => msg.includes(k));
    if (isFatal) {
      fatalError = true;
      process.exit(1);
    }
  }

  bot.on('login', () => console.log("✅ Logged in."));
  bot.on('kicked', checkDisconnect);
  bot.on('error', err => checkDisconnect(err.message));
  bot.on('end', () => {
    clearInterval(attackInterval);
    clearInterval(messageInterval);
    currentTarget = null;
    botSpawned = false;
    if (!fatalError) setTimeout(createBot, 5000);
  });

  bot.on('death', () => {
    clearInterval(attackInterval);
    attackInterval = null;
    currentTarget = null;
    setTimeout(() => {
      if (botSpawned) bot.emit('respawn');
    }, 3000);
  });

  // == FOLLOW PLAYER ==
  bot.on('chat', (username, message) => {
    const player = bot.players[username]?.entity;
    const msg = message.toLowerCase();

    if (msg === 'woi ikut aq' && player) {
      followTarget = player;
      bot.chat("sat");
      bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true);
    }

    if (msg === 'woi stop ikut') {
      followTarget = null;
      bot.pathfinder.setGoal(null);
      bot.chat("ok aq stop ikut");
    }
  });

  // == HUNT LOOP ==
  setInterval(() => {
    if (!botSpawned || bot.health <= 0 || bot.entity?.isInWater) return;
    const mob = getNearestEntity(e =>
      e.type === 'mob' &&
      hostileMobs.includes(e.name)
    );
    if (mob) attackEntity(mob);
  }, 2000);

  // == SMART WATER ESCAPE ==
  setInterval(() => {
    if (!botSpawned || !bot.entity?.isInWater) return;

    const landBlock = bot.findBlock({
      matching: block => block.boundingBox === 'block' && !block.name.includes('water'),
      maxDistance: 10,
      point: bot.entity.position
    });

    if (landBlock) {
      bot.pathfinder.setGoal(new GoalBlock(landBlock.position.x, landBlock.position.y, landBlock.position.z));
    } else {
      bot.setControlState('jump', true);
      bot.setControlState('forward', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
        bot.setControlState('forward', false);
      }, 1000);
    }
  }, 2000);

  // == RANDOM LOOK ==
  setInterval(() => {
    if (botSpawned && bot.entity) {
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI / 4;
      bot.look(yaw, pitch, true).catch(() => {});
    }
  }, 10000);

  // == RANDOM CHAT ==
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
      } catch (err) {
        console.warn("Failed to chat:", err.message);
      }
    }
  }, 90000);

  // == DEFENSE SYSTEM ==
  bot.on('entityHurt', (entity) => {
    if (!botSpawned || !entity?.uuid) return;

    // If bot is hurt, look for nearby attackers
    if (entity.uuid === bot.uuid) {
      const attacker = getNearestEntity(e =>
        e.type === 'mob' &&
        hostileMobs.includes(e.name) &&
        e.position.distanceTo(bot.entity.position) < 6
      );
      if (attacker) attackEntity(attacker);

      const player = getNearestEntity(e =>
        e.type === 'player' &&
        e.username !== bot.username &&
        e.position.distanceTo(bot.entity.position) < 3
      );

      if (player && (!lastHitPlayer || lastHitPlayer.uuid !== player.uuid)) {
        lastHitPlayer = player;
        bot.chat("ambik ko");
        bot.lookAt(player.position.offset(0, player.height, 0))
          .then(() => bot.attack(player))
          .catch(() => {});
        setTimeout(() => { lastHitPlayer = null }, 10000);
      }
    }
  });
}

createBot();

// == KEEP ALIVE ==
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('Mineflayer bot is running!'));
app.listen(port, () => console.log(`🌐 Server running on port ${port}`));

// == GLOBAL ERROR HANDLING ==
process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
});
process.on('unhandledRejection', err => {
  console.error('❌ Unhandled Rejection:', err);
});

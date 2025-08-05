// == IMPORTS ==
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalNear, GoalBlock } = goals;
const mcDataLoader = require('minecraft-data');
const express = require('express');

// == STATE ==
let bot;
let mcData;
let followTarget = null;
let currentTarget = null;
let attackInterval = null;
let roamInterval = null;
let messageInterval = null;
let fatalError = false;

// == MOBS ==
const hostileMobs = [
  'zombie', 'drowned', 'skeleton', 'creeper', 'spider', 'husk',
  'witch', 'zombified_piglin', 'zoglin', 'phantom', 'vex',
  'pillager', 'evoker', 'vindicator', 'ravager'
];

// == UTILITIES ==
function getNearestEntity(filter) {
  return Object.values(bot.entities)
    .filter(filter)
    .sort((a, b) =>
      bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
    )[0];
}

function equipWeapon() {
  const weapon = bot.inventory.items().find(i =>
    i.name.includes('sword') || i.name.includes('axe')
  );
  if (weapon) bot.equip(weapon, 'hand').catch(() => {});
}

function attackEntity(entity) {
  if (!entity?.isValid || bot.health <= 0) return;
  if (currentTarget?.uuid === entity.uuid && attackInterval) return;

  clearInterval(attackInterval);
  currentTarget = entity;
  equipWeapon();

  bot.pathfinder.setGoal(new GoalNear(entity.position.x, entity.position.y, entity.position.z, 1));

  attackInterval = setInterval(() => {
    if (!entity?.isValid || bot.health <= 0) {
      clearInterval(attackInterval);
      attackInterval = null;
      currentTarget = null;
      return;
    }

    const dist = bot.entity.position.distanceTo(entity.position);
    if (dist < 3 && bot.canSeeEntity(entity)) {
      bot.lookAt(entity.position.offset(0, entity.height, 0)).then(() => {
        bot.attack(entity);
      }).catch(() => {});
    }
  }, 800);
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
    mcData = mcDataLoader(bot.version);
    const defaultMove = new Movements(bot, mcData);
    defaultMove.allowSprinting = true;
    defaultMove.canDig = false;
    defaultMove.blocksToAvoid.add(8); // water
    defaultMove.blocksToAvoid.add(9); // flowing water
    bot.pathfinder.setMovements(defaultMove);
    console.log("✅ Bot ready");
  });

  bot.on('chat', (username, message) => {
    const msg = message.toLowerCase();
    const player = bot.players[username]?.entity;
    if (!player) return;

    if (msg === 'woi ikut aq') {
      followTarget = player;
      bot.chat("sat");
      bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true);
    }

    if (msg === 'woi stop ikut') {
      followTarget = null;
      bot.pathfinder.setGoal(null);
      bot.chat("ok aq stop ikut");
    }

    if (msg === 'woi gi bunuh') {
      if (!roamInterval) {
        bot.chat("sigma alpha wolf activateddd");
        roamInterval = setInterval(() => {
          const mob = getNearestEntity(e =>
            e.type === 'mob' &&
            hostileMobs.includes(e.name) &&
            e.position.distanceTo(bot.entity.position) < 16
          );
          if (mob) attackEntity(mob);
          else if (!currentTarget) {
            const dx = Math.floor(Math.random() * 10 - 5);
            const dz = Math.floor(Math.random() * 10 - 5);
            const pos = bot.entity.position.offset(dx, 0, dz);
            bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
          }
        }, 3000);
      }
    }

    if (msg === 'woi stop bunuh') {
      clearInterval(roamInterval);
      roamInterval = null;
      currentTarget = null;
      bot.pathfinder.setGoal(null);
      bot.chat("ok aq stop bunuh");
    }
  });

  bot.on('health', () => {
    if (bot.health < 5 && currentTarget?.isValid) {
      bot.chat('ur goin too far dawg');
      attackEntity(currentTarget);
    }
  });

  bot.on('entityHurt', (entity) => {
    if (entity.uuid === bot.uuid) {
      const attacker = getNearestEntity(e =>
        e.type === 'mob' &&
        e.position.distanceTo(bot.entity.position) < 4
      );
      if (attacker) {
        bot.chat(`yo tf? ${attacker.name}`);
        attackEntity(attacker);
      }
    }
  });

  bot.on('end', () => {
    clearInterval(attackInterval);
    clearInterval(roamInterval);
    clearInterval(messageInterval);
    if (!fatalError) {
      console.log("🔁 Bot restarting...");
      setTimeout(createBot, 5000);
    }
  });

  bot.on('kicked', reason => handleDisconnect(reason));
  bot.on('error', err => handleDisconnect(err.message));
  bot.on('death', () => {
    clearInterval(attackInterval);
    currentTarget = null;
    setTimeout(() => bot.emit('respawn'), 3000);
  });

  function handleDisconnect(reason) {
    const msg = typeof reason === 'string' ? reason.toLowerCase() : '';
    console.log("❌ Disconnected:", msg);
    if (msg.includes("kicked") || msg.includes("banned") || msg.includes("connection reset")) {
      fatalError = true;
      console.log("🛑 Fatal disconnect. Not reconnecting.");
      process.exit(1);
    }
  }

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
    if (bot && bot.health > 0) {
      bot.chat(messages[chatIndex]);
      chatIndex = (chatIndex + 1) % messages.length;
    }
  }, 90000);

  // Anti drowning
  setInterval(() => {
    if (bot?.entity?.isInWater) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 300);
    }
  }, 1000);
}

createBot();

// == KEEP ALIVE ==
const app = express();
app.get('/', (_, res) => res.send('Mineflayer bot is running!'));
app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Web server online.");
});

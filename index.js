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
let lastAttacker = null;
let fatalError = false;
let messageInterval = null;
let roamInterval = null;

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
  const weapon = bot.inventory.items().find(i => i.name.includes('sword') || i.name.includes('axe'));
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

  console.log("🔄 Creating bot...");
  bot = mineflayer.createBot({
    host: 'neymar.aternos.me',
    port: 48991,
    username: 'ronaldinho',
    version: '1.21.1'
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log("✅ Bot spawned and ready.");
    botSpawned = true;
    mcData = mcDataLoader(bot.version);

    defaultMove = new Movements(bot, mcData);
    defaultMove.allowSprinting = true;
    defaultMove.canDig = false;
    defaultMove.blocksToAvoid.add(8);
    defaultMove.blocksToAvoid.add(9);
    bot.pathfinder.setMovements(defaultMove);
  });

  bot.on('login', () => console.log("🔓 Logged in to server."));

  function checkDisconnect(reason) {
    const msg = typeof reason === 'string' ? reason.toLowerCase() : JSON.stringify(reason).toLowerCase();
    console.log("❌ Disconnect reason:", msg);

    const isFatal = msg.includes("kicked") || msg.includes("banned") ||
      msg.includes("another location") || msg.includes("duplicate") ||
      msg.includes("connection reset") || msg.includes("read error");

    if (isFatal) {
      fatalError = true;
      console.log("🛑 Fatal disconnect. Not reconnecting.");
      process.exit(1);
    }
  }

  bot.on('kicked', checkDisconnect);
  bot.on('error', err => {
    console.log("⚠️ Bot error:", err.message);
    checkDisconnect(err.message);
  });

  bot.on('end', () => {
    console.log("🔌 Disconnected.");
    clearInterval(attackInterval);
    clearInterval(roamInterval);
    clearInterval(messageInterval);
    currentTarget = null;
    botSpawned = false;

    if (!fatalError) {
      setTimeout(createBot, 5000);
    }
  });

  bot.on('death', () => {
    console.log("☠️ Bot died. Respawning soon...");
    clearInterval(attackInterval);
    currentTarget = null;

    setTimeout(() => {
      if (botSpawned) bot.emit('respawn');
    }, 5000);
  });

  // == CHAT EVENTS ==
  bot.on('chat', (username, message) => {
    if (!botSpawned) return;
    const player = bot.players[username]?.entity;
    const msg = message.toLowerCase();

    if (msg === 'woi ikut aq' && player) {
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

  if (msg === 'woi gi bunuh') {
    if (!roamInterval) {
      bot.chat("sigma alpha wolf activateddd");
      roamInterval = setInterval(() => {
        if (!botSpawned || bot.health <= 0) return;
        const mob = getNearestEntity(e =>
          e.type === 'mob' &&
          hostileMobs.includes(e.name) &&
          e.position.distanceTo(bot.entity.position) < 16
        );

        if (mob) {
          attackEntity(mob);
        } else if (!currentTarget) {
          const dx = Math.floor(Math.random() * 10 - 5);
          const dz = Math.floor(Math.random() * 10 - 5);
          const pos = bot.entity.position.offset(dx, 0, dz);
          bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
        }
      }, 4000);
    }
  }

  if (msg === 'woi stop bunuh') {
    clearInterval(roamInterval);
    roamInterval = null;
    currentTarget = null;
    bot.pathfinder.setGoal(null);
    bot.chat("ok aq stop bunuh");
  }

  // == DETECTION / INTERVALS ==
  setInterval(() => {
    if (!botSpawned) return;

    const nearbyMob = getNearestEntity(e =>
      e.type === 'mob' &&
      hostileMobs.includes(e.name) &&
      e.position.distanceTo(bot.entity.position) < 12
    );

    if (nearbyMob) {
      attackEntity(nearbyMob);
    } else if (followTarget) {
      bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true);
    }
  }, 3000);

  setInterval(() => {
    if (botSpawned && bot.entity?.isInWater) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }
  }, 2000);

  setInterval(() => {
    if (botSpawned && bot.entity) {
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI / 4;
      bot.look(yaw, pitch, true).catch(() => {});
    }
  }, 8000);

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

  bot.on('entityHurt', (entity) => {
    if (entity.uuid === bot.uuid) {
      const attacker = getNearestEntity(e =>
        e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 4
      );
      if (attacker) {
        lastAttacker = attacker;
        bot.chat(`yo tf? ${attacker.name}`);
        attackEntity(attacker);
      }
    }
  });

  bot.on('health', () => {
    if (bot.health < 5 && lastAttacker?.isValid) {
      bot.chat('ur goin too far dawg');
      attackEntity(lastAttacker);
    }
  });
}

createBot();

// == KEEP ALIVE ==
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('Mineflayer bot is running!'));
app.listen(port, () => {
  console.log(`🌐 Server running on port ${port}`);
});

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalNear, GoalBlock } = goals;
const mcDataLoader = require('minecraft-data');
const express = require('express');

let bot;
let mcData;
let following = false;
let followTarget = null;
let defaultMove;
let botSpawned = false;
let lastAttacker = null;
let roaming = false;
let roamInterval;
let currentTarget = null;
let attackInterval = null;

const hostileMobs = [
  'zombie', 'drowned', 'skeleton', 'creeper', 'spider', 'husk',
  'witch', 'zombified_piglin', 'zoglin', 'phantom', 'vex',
  'pillager', 'evoker', 'vindication', 'ravager'
];

function getNearestEntity(filter) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const id in bot.entities) {
    const entity = bot.entities[id];
    if (!entity || !filter(entity)) continue;
    const dist = bot.entity.position.distanceTo(entity.position);
    if (dist < nearestDistance) {
      nearest = entity;
      nearestDistance = dist;
    }
  }
  return nearest;
}

function equipWeapon() {
  const sword = bot.inventory?.items()?.find(item => item.name.includes('sword'));
  if (sword) bot.equip(sword, 'hand').catch(() => {});
}

function attackEntity(entity) {
  if (!entity || !entity.isValid) return;
  if (currentTarget === entity) return;
  if (attackInterval) clearInterval(attackInterval);

  equipWeapon();
  currentTarget = entity;

  bot.pathfinder.setGoal(new GoalNear(entity.position.x, entity.position.y, entity.position.z, 1));

  attackInterval = setInterval(() => {
    if (!entity?.isValid || !bot.entity) {
      clearInterval(attackInterval);
      attackInterval = null;
      currentTarget = null;
      return;
    }

    const dist = bot.entity.position.distanceTo(entity.position);
    if (dist < 3) {
      bot.lookAt(entity.position.offset(0, entity.height, 0)).then(() => {
        bot.attack(entity);
      }).catch(() => {});
    } else {
      bot.pathfinder.setGoal(new GoalNear(entity.position.x, entity.position.y, entity.position.z, 1));
    }
  }, 500);
}

function stopBotActions() {
  try {
    if (bot?.pathfinder) bot.pathfinder.setGoal(null);
    bot.clearControlStates();
    clearInterval(roamInterval);
    if (attackInterval) clearInterval(attackInterval);
    attackInterval = null;
    currentTarget = null;
    roaming = false;
    following = false;
    followTarget = null;
    console.log("🛌 Bot actions stopped.");
  } catch (_) {}
}

function shutdownBotImmediately() {
  console.log("❌ Shutting down bot permanently.");
  stopBotActions();
  process.exit(0);
}

function createBot() {
  console.log('🔄 Creating bot...');
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

  bot.on('login', () => console.log("🔓 Logged in to Minecraft server."));

  bot.on('kicked', (reason) => {
    const message = reason?.toString().toLowerCase() || "";
    console.log(`[KICKED] Reason: ${message}`);
    if (
      message.includes("banned") ||
      message.includes("kicked by an operator") ||
      message.includes("you logged in from another location") ||
      message.includes("duplicate login")
    ) {
      shutdownBotImmediately();
    }
  });

  bot.on('error', err => {
    const msg = err.message.toLowerCase();
    console.log("❗ Bot error:", err.message);
    if (
      msg.includes("banned") ||
      msg.includes("kicked") ||
      msg.includes("duplicate") ||
      msg.includes("connection reset")
    ) {
      shutdownBotImmediately();
    }
  });

  bot.on('end', () => {
    console.log("🔌 Bot disconnected.");
    shutdownBotImmediately();
  });

  bot.on('death', () => {
    console.log("☠️ Bot died. Respawning in 5 seconds...");
    setTimeout(() => {
      bot.emit('respawn');
      console.log("🔄 Bot respawned.");
    }, 5000);
  });

  bot.on('chat', (username, message) => {
    if (!botSpawned) return;
    const player = bot.players[username];
    if (!player || !player.entity) return;
    const msg = message.toLowerCase();

    if (msg === 'woi ikut aq') {
      followTarget = player.entity;
      following = true;
      bot.chat("sat");
      bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true);
    }

    if (msg === 'stop ikut') {
      following = false;
      followTarget = null;
      bot.pathfinder.setGoal(null);
      bot.chat("yeahyeah im a goodboy");
    }

    if (msg === 'wei gi bunuh monster') {
      if (!roaming) {
        roaming = true;
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
          } else {
            const dx = Math.floor(Math.random() * 10 - 5);
            const dz = Math.floor(Math.random() * 10 - 5);
            const pos = bot.entity.position.offset(dx, 0, dz);
            bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
          }
        }, 4000);
      }
    }

    if (msg === 'stop cari monster') {
      if (roaming) {
        roaming = false;
        clearInterval(roamInterval);
        bot.pathfinder.setGoal(null);
        bot.chat("no problem, u can ask me for help anytime..");
      }
    }
  });

  setInterval(() => {
    if (following && followTarget && botSpawned) {
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
    if (!botSpawned || !bot.entity) return;
    const yaw = bot.entity.yaw + ((Math.random() - 0.5) * Math.PI / 2);
    const pitch = (Math.random() - 0.5) * Math.PI / 4;
    bot.look(yaw, pitch, true).catch(() => {});
  }, 8000);

  const messages = [
    "mne iman my love", "kaya siak server baru", "bising bdo karina", "mne iqbal",
    "amirul hadif x nurul iman very very sweet good",
    "gpp jadi sok asik asalkan aq tolong on kan server ni 24 jam",
    "duatiga duatiga dua empat", "boikot perempuan nme sofea pantek jubo lahanat",
    "if u wana kno spe sofea hmm i dono", "bising do bal", "ko un sme je man",
    "apa ko bob", "okok ma bad ma fault gng🥀", "sat berak sat", "sunyi siak",
    "MUSTARRRRRRRDDDDDDDD", "ok aq ulang blik dri awal"
  ];
  let index = 0;

  setInterval(() => {
    if (botSpawned) {
      try {
        bot.chat(messages[index]);
        index = (index + 1) % messages.length;
      } catch (_) {}
    }
  }, 90000);

  bot.on('entityHurt', (entity) => {
    if (!botSpawned || !entity) return;
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

  setInterval(() => {
    if (!botSpawned || roaming || bot.health <= 0) return;
    const target = getNearestEntity(e =>
      e.type === 'mob' &&
      hostileMobs.includes(e.name) &&
      e.position.distanceTo(bot.entity.position) < 12
    );
    if (target) {
      lastAttacker = target;
      attackEntity(target);
    }
  }, 3000);
}

createBot();

// Fake express server (optional)
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => {
  res.send('Mineflayer bot is running!');
});
app.listen(port, () => {
  console.log(`🌐 Fake server listening on port ${port}`);
});

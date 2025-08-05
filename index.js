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
    defaultMove.blocksToAvoid.add(8); // water
    defaultMove.blocksToAvoid.add(9); // flowing water

    bot.pathfinder.setMovements(defaultMove);
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

  bot.on('login', () => console.log("Logged in."));
  bot.on('kicked', checkDisconnect);
  bot.on('error', err => checkDisconnect(err.message));
  bot.on('end', () => {
    clearInterval(attackInterval);
    clearInterval(roamInterval);
    clearInterval(messageInterval);
    currentTarget = null;
    botSpawned = false;
    if (!fatalError) setTimeout(createBot, 5000);
  });

  bot.on('death', () => {
    clearInterval(attackInterval);
    currentTarget = null;
    setTimeout(() => {
      if (botSpawned) bot.emit('respawn');
    }, 5000);
  });

  // == CHAT COMMANDS ==
  bot.on('chat', (username, message) => {
    if (!botSpawned) return;
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

  // == MOBS DETECTION LOOP ==
  setInterval(() => {
    if (!botSpawned) return;
    const nearbyMob = getNearestEntity(e =>
      e.type === 'mob' &&
      hostileMobs.includes(e.name) &&
      e.position.distanceTo(bot.entity.position) < 10
    );

    if (nearbyMob) attackEntity(nearbyMob);
    else if (followTarget?.isValid) {
      bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true);
    }
  }, 3000);

  // == WATER ESCAPE ==
  setInterval(() => {
    if (botSpawned && bot.entity?.isInWater) {
      bot.setControlState('jump', true);
      bot.setControlState('forward', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
        bot.setControlState('forward', false);
      }, 1000);
    }
  }, 2500);

  // == RANDOM LOOK AROUND ==
  setInterval(() => {
    if (botSpawned && bot.entity) {
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI / 4;
      bot.look(yaw, pitch, true).catch(() => {});
    }
  }, 10000);

  // == AUTO CHAT ==
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

  // == MOB DEFENSE ==
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
app.listen(port, () => console.log(`🌐 Server running on port ${port}`));

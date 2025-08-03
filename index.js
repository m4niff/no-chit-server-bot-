const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalNear } = goals;
const mcDataLoader = require('minecraft-data');
const express = require('express');

let mcData;
let following = false;
let followTarget = null;

function createBot() {
  const bot = mineflayer.createBot({
    host: 'neymar.aternos.me',
    port: 48991,
    username: 'ronaldinho',
    version: '1.21.1',
  });

  bot.loadPlugin(pathfinder);

  let defaultMove;
  let botSpawned = false;
  let lastAttacker = null;

  const hostileMobs = ['zombie', 'drowned', 'skeleton', 'creeper', 'spider'];

  bot.once('spawn', () => {
    botSpawned = true;
    mcData = mcDataLoader(bot.version);
    defaultMove = new Movements(bot, mcData);
    defaultMove.allowSprinting = true;
    defaultMove.canDig = false;
    defaultMove.blocksToAvoid.add(8);
    defaultMove.blocksToAvoid.add(9);

    bot.pathfinder.setMovements(defaultMove);
    console.log("✅ Bot spawned and ready.");
  });

  function equipWeapon() {
    const sword = bot.inventory.items().find(item => item.name.includes('sword'));
    if (sword) {
      bot.equip(sword, 'hand').catch(() => {});
    }
  }

  // === Follow Commands ===
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
  });

  setInterval(() => {
    if (following && followTarget && botSpawned) {
      bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true);
    }
  }, 3000);

  // === Jump Randomly ===
  setInterval(() => {
    if (botSpawned && bot.setControlState) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }
  }, 10000);

  // === Random Look Around ===
  setInterval(() => {
    if (!botSpawned || !bot.entity) return;
    const yaw = bot.entity.yaw + ((Math.random() - 0.5) * Math.PI / 2);
    const pitch = (Math.random() - 0.5) * Math.PI / 4;
    bot.look(yaw, pitch, true).catch(() => {});
  }, 8000);

  // === Periodic Chat Messages ===
  const messages = [
    "mne iman my love", "kaya siak server baru", "piwit boleh bunuh zombie bagai siottt",
    "lepasni aq jdi bodygard korg yehaww", "bising bdo karina", "amirul hadif x nurul iman very very sweet good",
    "gpp jadi sok asik asalkan aq tolong on kan server ni 24 jam", "duatiga duatiga dua empat",
    "boikot perempuan nme sofea pantek jubo lahanat", "bising do bal", "sat berak sat", "sunyi siak",
    "MUSTARRRRRRRDDDDDDDD", "ok aq ulang blik dri awal"
  ];
  let index = 0;

  setInterval(() => {
    if (botSpawned) {
      try {
        bot.chat(messages[index]);
        index = (index + 1) % messages.length;
      } catch (e) {}
    }
  }, 90000);

  // === Retaliation System ===
  bot.on('entityHurt', (entity) => {
    if (!botSpawned || !entity) return;

    // If bot was attacked
    if (entity.uuid === bot.uuid) {
      const attacker = Object.values(bot.entities).find(e =>
        e.position.distanceTo(bot.entity.position) < 4 &&
        (e.type === 'mob' || e.type === 'player') &&
        hostileMobs.includes(e.name)
      );

      if (attacker) {
        lastAttacker = attacker;
        equipWeapon();
        bot.chat(`yo tf? ${attacker.name}`);
        bot.pathfinder.setGoal(new GoalNear(attacker.position.x, attacker.position.y, attacker.position.z, 1));

        const retaliate = setInterval(() => {
          if (!attacker?.isValid || !bot.entity) {
            clearInterval(retaliate);
            return;
          }

          const dist = bot.entity.position.distanceTo(attacker.position);
          if (dist < 3) {
            bot.lookAt(attacker.position.offset(0, attacker.height, 0)).then(() => {
              bot.attack(attacker);
            }).catch(() => {});
          }
        }, 500);
      }
    }
  });

  // === Berserk Mode ===
  bot.on('health', () => {
    if (bot.health < 5 && lastAttacker && lastAttacker.isValid) {
      bot.chat('ur goin too far dawg');
      equipWeapon();

      const spamAttack = setInterval(() => {
        if (!lastAttacker?.isValid || !bot.entity || bot.health <= 0) {
          clearInterval(spamAttack);
          return;
        }

        bot.lookAt(lastAttacker.position.offset(0, lastAttacker.height, 0)).then(() => {
          bot.attack(lastAttacker);
        }).catch(() => {});
      }, 200);
    }
  });
}

createBot();

// === FAKE EXPRESS SERVER FOR RENDER ===
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Mineflayer bot is running!');
});

app.listen(port, () => {
  console.log(`🌐 Fake server listening on port ${port}`);
});

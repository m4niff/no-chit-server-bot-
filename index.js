const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals, GoalNear, GoalFollow } = require('mineflayer-pathfinder');
const express = require('express');
const Vec3 = require('vec3');

const app = express();
const port = process.env.PORT || 3000;

// Web server
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(port, () => console.log(`🌐 Express server active on port ${port}`));

let defaultMove;
let following = false;

// === Bot creation ===
function createBot() {
  const bot = mineflayer.createBot({
    host: 'neymar.aternos.me',
    port: 48991,
    username: 'messi',
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    defaultMove = new Movements(bot, bot.registry);
    defaultMove.allowSprinting = true;
    defaultMove.canDig = false;
    defaultMove.blocksToAvoid.add(8);
    defaultMove.blocksToAvoid.add(9);

    bot.pathfinder.setMovements(defaultMove);
    console.log('🤖 Bot has spawned and is ready');
  });

  // === Chat commands ===
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();

    if (msg === 'woi ikut aq') {
      const player = bot.players[username]?.entity;
      if (!player) return bot.chat("wya?");
      bot.chat("oh i se i se");
      following = true;
      followPlayer(player);
    }

    if (msg === 'stop') {
      bot.chat("tf now what?");
      following = false;
      bot.pathfinder.setGoal(null);
    }
  });

  function followPlayer(player) {
    const interval = setInterval(() => {
      if (!following || !player?.isValid) return clearInterval(interval);
      const goal = new GoalFollow(player, 1);
      bot.pathfinder.setGoal(goal, true);
    }, 1000);
  }

  // === Reactive when hit ===
  let lastHealth = 20;
  let reacting = false;

  const hitMessages = ['sakit la babi', 'suda cukup cukup suda', 'AWAWAW', 'sok asik', 'weh ko ni', 'apasal pukul aku', 'ko ni bodoh ka'];
  const dangerMessages = ['OUCH', 'UDA TOLONG AQ UDA', 'AQ BUTUH MEDKIT'];

  bot.on('health', () => {
    if (bot.health < lastHealth && !reacting) {
      reacting = true;
      const attacker = bot.nearestEntity(e => e.type === 'player' || e.type === 'mob');
      const isDrowning = bot.entity.isInWater;
      const isBurning = bot.entity.onFire;

      let message = isDrowning || isBurning
        ? dangerMessages[Math.floor(Math.random() * dangerMessages.length)]
        : hitMessages[Math.floor(Math.random() * hitMessages.length)];

      bot.chat(message);

      if (attacker && attacker.position) {
        setTimeout(() => {
          bot.pathfinder.setMovements(defaultMove);
          bot.pathfinder.setGoal(new GoalNear(attacker.position.x, attacker.position.y, attacker.position.z, 1));

          setTimeout(() => {
            if (bot.entity.position.distanceTo(attacker.position) < 4) bot.attack(attacker);
            const away = attacker.position.offset(Math.random() * 4 - 2, 0, Math.random() * 4 - 2);
            bot.pathfinder.setGoal(new GoalNear(away.x, away.y, away.z, 1));
            reacting = false;
          }, 3000);
        }, 1000);
      } else {
        reacting = false;
      }
    }
    lastHealth = bot.health;
  });

  // === Random movement/look ===
  const directions = ['forward', 'back', 'left', 'right'];
  setInterval(() => {
    const dir = directions[Math.floor(Math.random() * directions.length)];
    bot.setControlState(dir, true);
    setTimeout(() => bot.setControlState(dir, false), 1000);
  }, 15000);

  setInterval(() => {
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 500);
  }, 10000);

  setInterval(() => {
    const yaw = (Math.random() - 0.5) * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * Math.PI / 2;
    bot.look(yaw, pitch, true);
  }, 8000);

  // === Attack hostile mobs ===
  setInterval(() => {
    const hostile = bot.nearestEntity(e =>
      e.type === 'mob' && e.isValid && ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'].includes(e.name)
    );
    if (hostile) {
      const dist = bot.entity.position.distanceTo(hostile.position);
      if (dist > 3) {
        bot.pathfinder.setGoal(new GoalFollow(hostile, 2));
      } else {
        bot.lookAt(hostile.position.offset(0, hostile.height, 0)).then(() => {
          bot.attack(hostile);
        });
      }
    }
  }, 2500);

  // === Auto-eat ===
  setInterval(() => {
    if (bot.food < 20 || bot.health < 20) {
      const food = bot.inventory.items().find(i => i.name.includes('cooked_beef') || i.name.includes('apple') || i.name.includes('bread'));
      if (food) {
        bot.clearControlStates();
        bot.equip(food, 'hand').then(() => bot.consume()).catch(() => {});
      }
    }
  }, 7000);

  // === Chat loop ===
  const messages = [
    "where the fuck am i tf?", "kaya siak server baru", "lepasni aq jdi bodygard korg yehaww", "sunyi siak", "sybau",
    "sat berak sat", "tkpe a tk jdi,kentut aja", "bising do bal", "SHOW ME YO WILLYYYYY", "aku selalu tersenyummmm"
  ];
  let index = 0;
  setInterval(() => {
    bot.chat(messages[index]);
    index = (index + 1) % messages.length;
  }, 90000);

  // === Reconnect handling ===
  bot.on('end', () => {
    console.log("❌ Disconnected. Reconnecting in 90 seconds...");
    setTimeout(createBot, 90000);
  });

  bot.on('error', err => {
    console.log("⚠️ Error:", err.message);
    setTimeout(createBot, 90000);
  });

  bot.on('kicked', reason => {
    console.log("🚫 Bot was kicked:", reason);
    setTimeout(createBot, 90000);
  });
}

// Start the bot
createBot();

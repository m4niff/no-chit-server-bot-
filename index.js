// ... [your existing imports and variables] ...

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
  let lastHealth = 20;

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
    const weapon = bot.inventory.items().find(item => item.name.includes('sword'));
    if (weapon) {
      bot.equip(weapon, 'hand').catch(() => {});
    }
  }

  function attackHostile() {
    if (!botSpawned || !bot.entity) return;

    const mobs = Object.values(bot.entities).filter(e =>
      e.type === 'mob' &&
      hostileMobs.includes(e.name?.toLowerCase?.()) &&
      bot.entity.position.distanceTo(e.position) < 16
    );

    if (mobs.length === 0) return;

    const target = mobs[0];
    equipWeapon();

    bot.chat(`bunuh ${target.name} jap`);
    bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, 1));

    const attackInterval = setInterval(() => {
      if (!target?.isValid || !bot.entity) {
        clearInterval(attackInterval);
        return;
      }

      const dist = bot.entity.position.distanceTo(target.position);
      if (dist < 3) {
        bot.lookAt(target.position.offset(0, target.height, 0)).then(() => {
          bot.attack(target);
        }).catch(() => {});
      }
    }, 600);
  }

  // 💥 NEW: React when attacked
  bot.on('entityHurt', (entity) => {
    if (entity.username === bot.username) return; // ignore if bot hurt itself somehow

    const attacker = Object.values(bot.entities).find(e => {
      if (!e.position || !e.metadata) return false;
      const distance = bot.entity.position.distanceTo(e.position);
      return distance < 6;
    });

    if (attacker && attacker.id !== bot.entity.id) {
      retaliate(attacker);
    }
  });

  function retaliate(attacker) {
    equipWeapon();
    bot.chat(`kau pukul aku? mari sini kau ${attacker.name || 'makhluk'}!`);
    bot.pathfinder.setGoal(new GoalNear(attacker.position.x, attacker.position.y, attacker.position.z, 1));

    const fight = setInterval(() => {
      if (!attacker?.isValid || !bot.entity) {
        clearInterval(fight);
        return;
      }

      const dist = bot.entity.position.distanceTo(attacker.position);
      if (dist < 3) {
        bot.lookAt(attacker.position.offset(0, attacker.height, 0)).then(() => {
          bot.attack(attacker);
        }).catch(() => {});
      }
    }, 600);
  }

  setInterval(attackHostile, 3000);

  bot.on('health', () => {
    if (bot.health < lastHealth) {
      bot.chat('sakitnyo');
    }
    lastHealth = bot.health;
  });

  bot.on('chat', (username, message) => {
    if (!botSpawned) return;

    const player = bot.players[username];
    if (!player || !player.entity) return;

    const msg = message.toLowerCase();

    if (msg === 'woi ikut aq') {
      followTarget = player.entity;
      following = true;
      bot.chat("woof woof");
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

  setInterval(() => {
    if (botSpawned && bot.setControlState) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }
  }, 10000);

  setInterval(() => {
    if (!botSpawned || !bot.entity) return;
    const yaw = bot.entity.yaw + ((Math.random() - 0.5) * Math.PI / 2);
    const pitch = (Math.random() - 0.5) * Math.PI / 4;
    bot.look(yaw, pitch, true).catch(() => {});
  }, 8000);

  const messages = [
    "mne iman my love", "kaya siak server baru","bising bdo karina", "iqbal dh masok ke blom", "amirul hadif x nurul iman very very sweet good",
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
}

createBot();

// === FAKE EXPRESS SERVER FOR RENDER ===
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Mineflayer bot is running!');
});

app.listen(port, () => {
  console.log(`🌐 Fake server listening on port ${port}`);
});

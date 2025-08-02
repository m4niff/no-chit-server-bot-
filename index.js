const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow } = goals;
const { plugin: pvp } = require('mineflayer-pvp');
const mcDataLoader = require('minecraft-data');

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
  bot.loadPlugin(pvp);

  let defaultMove;
  let lastHealth = 20;
  let reacting = false;
  let botSpawned = false;

  const hitMessages = [
    'suda cukup cukup suda', 'AWAWAW', 'sok asik', 'weh ko ni',
    'apasal pukul aku',
  ];

  const dangerMessages = ['sakitnyo'];

  bot.once('spawn', () => {
    botSpawned = true;

    mcData = mcDataLoader(bot.version);
    defaultMove = new Movements(bot, mcData);
    defaultMove.scafoldingBlocks = [];
    defaultMove.allowSprinting = true;
    defaultMove.canDig = false;

    defaultMove.blocksToAvoid.add(8);
    defaultMove.blocksToAvoid.add(9);

    bot.pathfinder.setMovements(defaultMove);
    console.log('✅ Bot spawned, movements ready.');
  });

  function equipWeapon() {
    const sword = bot.inventory.items().find(item => item.name.includes('sword'));
    if (sword) {
      bot.equip(sword, 'hand').catch(() => {});
    }
  }

  function attackNearbyHostiles() {
    if (!botSpawned || !bot.entity || !bot.entities) return;

    const hostiles = Object.values(bot.entities).filter(e =>
      e.type === 'mob' &&
      ['Drowned', 'Zombie', 'Skeleton', 'Creeper', 'Spider'].includes(e.mobType) &&
      bot.entity.position.distanceTo(e.position) < 16
    );

    if (hostiles.length > 0) {
      const target = hostiles[0];
      equipWeapon();

      try {
        bot.chat(`bunuh ${target.mobType} jap`);
      } catch (e) {}

      bot.pvp.attack(target);
    }
  }

  setInterval(attackNearbyHostiles, 3000);

  bot.on('health', () => {
    if (!botSpawned) return;

    if (bot.health < lastHealth && !reacting) {
      reacting = true;

      const attacker = bot.nearestEntity(e =>
        e.type === 'player' || e.type === 'mob'
      );

      const isDrowning = bot.entity.isInWater;
      const isBurning = bot.entity.onFire;

      const message = (isDrowning || isBurning)
        ? dangerMessages[Math.floor(Math.random() * dangerMessages.length)]
        : hitMessages[Math.floor(Math.random() * hitMessages.length)];

      try {
        bot.chat(message);
      } catch (e) {}

      if (attacker && attacker.position) {
        equipWeapon();
        bot.pvp.attack(attacker);

        setTimeout(() => {
          bot.pvp.stop();
          reacting = false;
        }, 5000);
      } else {
        reacting = false;
      }
    }

    lastHealth = bot.health;
  });

  bot.on('chat', (username, message) => {
    if (!botSpawned) return;

    const player = bot.players[username];
    if (!player || !player.entity) {
      return bot.chat("mana ko?");
    }

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

  const handleReconnect = () => {
    botSpawned = false;
    console.log("❌ Disconnected. Reconnecting in 90 seconds...");
    setTimeout(createBot, 90000);
  };

  bot.on('end', handleReconnect);
  bot.on('error', err => {
    console.log("⚠️ Error:", err.message);
    handleReconnect();
  });
  bot.on('kicked', reason => {
    console.log("🚫 Bot was kicked:", reason);
    handleReconnect();
  });
}

createBot();

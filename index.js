const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalNear } = goals;
const mcDataLoader = require('minecraft-data');
const { spawn } = require('child_process');

let bot;
let mcData;
let followTarget = null;
let following = false;
let lastHealth = 20;
let reacting = false;

function createBot() {
  bot = mineflayer.createBot({
    host: 'neymar.aternos.me',
    port: 48991,
    username: 'ronaldinho'
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    mcData = mcDataLoader(bot.version);

    const defaultMove = new Movements(bot, mcData);
    defaultMove.allowSprinting = true;
    defaultMove.canDig = false;
    defaultMove.blocksToAvoid.add(8); // Water
    defaultMove.blocksToAvoid.add(9); // Flowing Water

    bot.pathfinder.setMovements(defaultMove);

    console.log('✅ Bot spawned & ready.');
  });

  const hitMessages = [
    'suda cukup cukup suda', 'AWAWAW', 'sok asik', 'weh ko ni', 'apasal pukul aku',
  ];
  const dangerMessages = ['sakitnyo'];

  // Auto-equip sword
  function equipWeapon() {
    const sword = bot.inventory.items().find(item => item.name.includes('sword'));
    if (sword) {
      bot.equip(sword, 'hand').catch(() => {});
    }
  }

  // Kill all hostile mobs nearby
  function attackNearbyHostiles() {
    const hostiles = Object.values(bot.entities).filter(e =>
      e.type === 'mob' &&
      ['Drowned', 'Zombie', 'Skeleton', 'Creeper', 'Spider'].includes(e.mobType) &&
      bot.entity.position.distanceTo(e.position) < 20
    );

    if (hostiles.length === 0) return;

    const target = hostiles[0];
    equipWeapon();

    bot.chat(`bunuh ${target.mobType} jap`);
    bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, 1));

    const attackLoop = setInterval(() => {
      if (!target.isValid) {
        clearInterval(attackLoop);
        bot.pathfinder.setGoal(null);
        return;
      }

      if (bot.entity.position.distanceTo(target.position) < 3) {
        bot.attack(target);
      }
    }, 800);
  }

  setInterval(attackNearbyHostiles, 3000);

  // On hit reaction
  bot.on('health', () => {
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

      bot.chat(message);

      if (attacker && attacker.position) {
        bot.pathfinder.setGoal(new GoalNear(attacker.position.x, attacker.position.y, attacker.position.z, 1));

        setTimeout(() => {
          if (bot.entity.position.distanceTo(attacker.position) < 4) {
            bot.attack(attacker);
          }
          bot.pathfinder.setGoal(null);
          reacting = false;
        }, 4000);
      } else {
        reacting = false;
      }
    }
    lastHealth = bot.health;
  });

  // Chat commands
  bot.on('chat', (username, message) => {
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

  // Keep following if enabled
  setInterval(() => {
    if (following && followTarget) {
      bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true);
    }
  }, 3000);

  // Jump every 10s
  setInterval(() => {
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 500);
  }, 10000);

  // Random look around
  setInterval(() => {
    if (!bot.entity) return;
    const yaw = bot.entity.yaw + ((Math.random() - 0.5) * Math.PI / 2);
    const pitch = (Math.random() - 0.5) * Math.PI / 4;
    bot.look(yaw, pitch, true);
  }, 8000);

  // Random chat
  const messages = [
    "mne iman my love", "kaya siak server baru", "piwit boleh bunuh zombie bagai siottt",
    "lepasni aq jdi bodygard korg yehaww", "bising bdo karina", "amirul hadif x nurul iman very very sweet good",
    "gpp jadi sok asik asalkan aq tolong on kan server ni 24 jam", "duatiga duatiga dua empat",
    "boikot perempuan nme sofea pantek jubo lahanat", "bising do bal", "sat berak sat",
    "sunyi siak", "MUSTARRRRRRRDDDDDDDD", "ok aq ulang blik dri awal"
  ];
  let msgIndex = 0;

  setInterval(() => {
    bot.chat(messages[msgIndex]);
    msgIndex = (msgIndex + 1) % messages.length;
  }, 90000);

  // Auto reconnect
  bot.on('end', () => {
    console.log("❌ Bot disconnected. Reconnecting in 90s...");
    setTimeout(createBot, 90000);
  });

  bot.on('kicked', reason => {
    console.log("🚫 Kicked:", reason);
    setTimeout(createBot, 90000);
  });

  bot.on('error', err => {
    console.log("⚠️ Error:", err.message);
    setTimeout(createBot, 90000);
  });
}

createBot();

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow } = goals;
const mcDataLoader = require('minecraft-data');

let mcData;
let following = false;
let followTarget = null;

const bot = mineflayer.createBot({
  host: 'neymar.aternos.me',
  port: 48991,
  username: 'ronaldinho'
});

bot.loadPlugin(pathfinder);

let defaultMove;
let lastHealth = 20;
let reacting = false;

const hitMessages = [
  'suda cukup cukup suda', 'AWAWAW', 'sok asik', 'weh ko ni',
  'apasal pukul aku',
];

const dangerMessages = ['sakitnyo'];

bot.once('spawn', () => {
  mcData = mcDataLoader(bot.version);
  defaultMove = new Movements(bot, mcData);
  defaultMove.scafoldingBlocks = [];
  defaultMove.allowSprinting = true;
  defaultMove.canDig = false;

  // Avoid water blocks
  defaultMove.blocksToAvoid.add(8); // Water
  defaultMove.blocksToAvoid.add(9); // Flowing water

  bot.pathfinder.setMovements(defaultMove);
  console.log('✅ Bot spawned, movements ready.');
});

// Equip sword automatically
function equipWeapon() {
  const sword = bot.inventory.items().find(item => item.name.includes('sword'));
  if (sword) {
    bot.equip(sword, 'hand').catch(() => {});
  }
}

// Kill all hostile mobs in range
function attackNearbyHostiles() {
  const hostiles = Object.values(bot.entities).filter(e =>
    e.type === 'mob' &&
    ['Drowned', 'Zombie', 'Skeleton', 'Creeper', 'Spider'].includes(e.mobType) &&
    bot.entity.position.distanceTo(e.position) < 20
  );

  if (hostiles.length > 0) {
    const target = hostiles[0]; // attack first one found
    equipWeapon();

    bot.chat(`bunuh ${target.mobType} jap`);
    bot.pathfinder.setGoal(new goals.GoalFollow(target, 1));

    const attackLoop = setInterval(() => {
      if (!target.isValid) {
        bot.pathfinder.setGoal(null);
        clearInterval(attackLoop);
        return;
      }

      if (bot.entity.position.distanceTo(target.position) < 3) {
        bot.attack(target);
      }
    }, 800);
  }
}

// Run mob scan every 3 seconds
setInterval(attackNearbyHostiles, 3000);

// React when hit
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
      setTimeout(() => {
        bot.pathfinder.setGoal(new goals.GoalFollow(attacker, 1));

        setTimeout(() => {
          if (attacker && bot.entity.position.distanceTo(attacker.position) < 4) {
            bot.attack(attacker);
          }
          setTimeout(() => {
            bot.pathfinder.setGoal(null);
            reacting = false;
          }, 4000);
        }, 3000);
      }, 1000);
    } else {
      reacting = false;
    }
  }
  lastHealth = bot.health;
});

// Follow command system
bot.on('chat', (username, message) => {
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

// Maintain following target
setInterval(() => {
  if (following && followTarget) {
    bot.pathfinder.setGoal(new GoalFollow(followTarget, 1), true);
  }
}, 3000);

// Jump for life
setInterval(() => {
  bot.setControlState('jump', true);
  setTimeout(() => bot.setControlState('jump', false), 500);
}, 10000);

// Random look
setInterval(() => {
  if (!bot.entity) return;
  const yaw = bot.entity.yaw + ((Math.random() - 0.5) * Math.PI / 2);
  const pitch = (Math.random() - 0.5) * Math.PI / 4;
  bot.look(yaw, pitch, true);
}, 8000);

// Random chat
const messages = [
  "mne iman my love",
  "kaya siak server baru",
  "piwit boleh bunuh zombie bagai siottt",
  "lepasni aq jdi bodygard korg yehaww",
  "bising bdo karina",
  "amirul hadif x nurul iman very very sweet good",
  "gpp jadi sok asik asalkan aq tolong on kan server ni 24 jam",
  "duatiga duatiga dua empat",
  "boikot perempuan nme sofea pantek jubo lahanat",
  "bising do bal",
  "sat berak sat",
  "sunyi siak",
  "MUSTARRRRRRRDDDDDDDD",
  "ok aq ulang blik dri awal"
];
let index = 0;
setInterval(() => {
  bot.chat(messages[index]);
  index = (index + 1) % messages.length;
}, 90000);

// Auto reconnect
function createBot() {
  require('child_process').spawn('node', ['index.js'], {
    stdio: 'inherit'
  });
}

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

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const mcDataLoader = require('minecraft-data');

const bot = mineflayer.createBot({
  host: 'neymar.aternos.me',
  port: 48991,
  username: 'messi'
});

bot.loadPlugin(pathfinder);

let defaultMove;
let lastHealth = 20;
let reacting = false;

const hitMessages = [
  'suda cukup cukup suda', 'AWAWAW', 'sok asik', 'weh ko ni',
  'apasal pukul aku', 'ko ni bodoh ka'
];


// 🔁 On bot spawn
bot.once('spawn', () => {
  mcData = mcDataLoader(bot.version);
  defaultMove = new Movements(bot, mcData);
  defaultMove.scafoldingBlocks = [];
  defaultMove.allowSprinting = true;
  defaultMove.canDig = false;
  defaultMove.blocksToAvoid.add(8); // Water
  defaultMove.blocksToAvoid.add(9); // Flowing Water

  bot.pathfinder.setMovements(defaultMove);
  console.log('✅ Bot spawned, movements ready.');
});

// 👊 React to being hurt
bot.on('health', () => {
  if (bot.health < lastHealth && !reacting) {
    reacting = true;
    const attacker = bot.nearestEntity(e => e.type === 'player' || e.type === 'mob');
    const isDrowning = bot.entity.isInWater;
    const isBurning = bot.entity.onFire;

    const message = (isDrowning || isBurning)
      ? dangerMessages[Math.floor(Math.random() * dangerMessages.length)]
      : hitMessages[Math.floor(Math.random() * hitMessages.length)];

    bot.chat(message);

    if (attacker && attacker.position) {
      setTimeout(() => {
        bot.pathfinder.setGoal(new GoalNear(attacker.position.x, attacker.position.y, attacker.position.z, 1));

        setTimeout(() => {
          if (bot.entity.position.distanceTo(attacker.position) < 4) {
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

// 🎤 Follow if player says "woi ikut aq"
bot.on('chat', (username, message) => {
  if (message.toLowerCase() === 'woi ikut aq') {
    const player = bot.players[username];
    if (!player || !player.entity) {
      bot.chat("mana ko?");
      return;
    }

    const pos = player.entity.position;
    bot.chat("ight" + username);
    bot.pathfinder.setGoal(new GoalNear(pos.x, pos.y, pos.z, 1));
  }
});

// 🦶 Random idle movement
const directions = ['forward', 'back', 'left', 'right'];
setInterval(() => {
  const dir = directions[Math.floor(Math.random() * directions.length)];
  bot.setControlState(dir, true);
  setTimeout(() => bot.setControlState(dir, false), 1000);
}, 15000);

// 🦘 Jump every 10s
setInterval(() => {
  bot.setControlState('jump', true);
  setTimeout(() => bot.setControlState('jump', false), 500);
}, 10000);

// 👁️ Random look
setInterval(() => {
  if (!bot.entity) return;
  const yaw = bot.entity.yaw + ((Math.random() - 0.5) * Math.PI / 2);
  const pitch = (Math.random() - 0.5) * Math.PI / 4;
  bot.look(yaw, pitch, true);
}, 8000);

// 💬 Random chat messages
const messages = [
  "where the fuck am i tf?",
  "kaya siak server baru",
  "piwit boleh bunuh zombie bagai siottt",
  "lepasni aq jdi bodygard korg yehaww",
  "what the fuck why asal tkde zombi monster bagai???",
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

// 🔁 Reconnect
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

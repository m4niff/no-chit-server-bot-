const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const mcDataLoader = require('minecraft-data');

let mcData;

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

const dangerMessages = [
  'tolong akuh'
];

bot.once('spawn', () => {
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

// Equip weapon if available
function equipWeapon() {
  const sword = bot.inventory.items().find(item => item.name.includes('sword'));
  if (sword) {
    bot.equip(sword, 'hand', () => {});
  }
}

// Attack nearby hostile mobs
function attackNearbyHostiles() {
  const hostile = bot.nearestEntity(e =>
    e.type === 'mob' &&
    ['Drowned', 'Zombie', 'Skeleton', 'Creeper', 'Spider'].includes(e.mobType) &&
    bot.entity.position.distanceTo(e.position) < 16
  );

  if (hostile) {
    equipWeapon();
    bot.chat(`aku bunuh ${hostile.mobType} ni jap`);
    bot.pathfinder.setGoal(new GoalNear(hostile.position.x, hostile.position.y, hostile.position.z, 1));
    setTimeout(() => {
      bot.attack(hostile);
    }, 1000);
  }
}

// Scan and attack hostiles every 5 seconds
setInterval(attackNearbyHostiles, 5000);

// React to player/mob hit
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
        bot.pathfinder.setGoal(new GoalNear(
          attacker.position.x,
          attacker.position.y,
          attacker.position.z,
          1
        ));

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

// Follow player if asked
bot.on('chat', (username, message) => {
  if (message.toLowerCase() === 'woi ikut aq') {
    const player = bot.players[username];
    if (!player || !player.entity) {
      bot.chat("mana ko?");
      return;
    }

    const pos = player.entity.position;
    bot.chat("ight " + username);
    bot.pathfinder.setGoal(new GoalNear(pos.x, pos.y, pos.z, 1));
  }
});

// Random idle movement
const directions = ['forward', 'back', 'left', 'right'];
setInterval(() => {
  const dir = directions[Math.floor(Math.random() * directions.length)];
  bot.setControlState(dir, true);
  setTimeout(() => bot.setControlState(dir, false), 1000);
}, 15000);

// Jump
setInterval(() => {
  bot.setControlState('jump', true);
  setTimeout(() => bot.setControlState('jump', false), 500);
}, 10000);

// Random look
setInterval(() => {
  if (!bot.entity) return;
  const yaw = bot.entity.yaw + ((Math.random() - 0.5) * Math.PI / 2);
  const pitch = (Math.random() - 0.5) * Math.PI / 4;
  bot.look(yaw,

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalNear } = goals;
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
      hostileMobs.includes(e.displayName?.toLowerCase?.()) &&
      bot.entity.position.distanceTo(e.position) < 16
    );

    if (mobs.length === 0) return;

    const target = mobs[0];
    equipWeapon();

    bot.chat(`bunuh ${target.displayName} jap`);
    bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, 1));

    const attackInterval = setInterval(() => {
      if (!target.isValid) {
        clearInterval(attackInterval);
        return;
      }

      const dist = bot.entity.position.distanceTo(target.position);
      if (dist < 3) {
        bot.attack(target);
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
}

createBot();

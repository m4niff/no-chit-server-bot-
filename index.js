const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalFollow } } = require('mineflayer-pathfinder');
const express = require('express');

let bot;

function createBot() {
  bot = mineflayer.createBot({
    host: "neymar.aternos.me",
    port: 48991,
    username: "messi",
    version: "1.21.1",
    keepAlive: false
  });

 bot.once('spawn', () => {
  const defaultMove = new Movements(bot);
  bot.pathfinder.setMovements(defaultMove);
  console.log('🤖 Bot has spawned');
});

const { Vec3 } = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;

const avoidWaterMovements = new Movements(bot);
avoidWaterMovements.allow1by1towers = false;
avoidWaterMovements.scafoldingBlocks = [];

bot.once('spawn', () => {
  bot.pathfinder.setMovements(avoidWaterMovements);
});

const hitReplies = [
  'sakit la babi',
  'suda cukup cukup suda',
  'AWAWAW',
  'sok asik',
  'weh jgn pukul aq',
  'tak baik camni 😢',
  'weh jgn bro',
  'adui mak',
];

const damageReplies = [
  'OUCH',
  'UDA TOLONG AQ UDA',
  'AQ BUTUH MEDKIT',
  'kena bakar sial',
  'help aq lemas',
];

bot.on('entityHurt', (entity) => {
  if (entity === bot.entity) {
    const healthNow = bot.health;

    // Determine what caused the hurt
    const cause = bot.entity.metadata?.[8]?.value || ''; // usually shows damage type if supported

    const attacker = Object.values(bot.entities).find(e => e.type === 'player' || e.type === 'mob' && bot.entity.position.distanceTo(e.position) < 4);
    
    const isFireOrDrowning = bot.isBurning || bot.entity.isInWater;

    if (!reacting) {
      reacting = true;

      // Random reply
      const replyList = isFireOrDrowning ? damageReplies : hitReplies;
      const message = replyList[Math.floor(Math.random() * replyList.length)];
      bot.chat(message);

      // Look at attacker and chase a bit
      if (attacker) {
        bot.lookAt(attacker.position.offset(0, 1.6, 0), true);
        
        setTimeout(() => {
          bot.pathfinder.setGoal(new GoalNear(attacker.position.x, attacker.position.y, attacker.position.z, 1));
        }, 3000); // 3 sec delay before chasing

        // Walk away like nothing happened after 5 sec
        setTimeout(() => {
          const offset = new Vec3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
          const away = bot.entity.position.plus(offset);
          bot.pathfinder.setGoal(new GoalNear(away.x, away.y, away.z, 1));
          reacting = false;
        }, 8000);
      } else {
        reacting = false;
      }
    }
  }
});


    // 🧠 Move randomly every few seconds
    const directions = ['forward', 'back', 'left', 'right'];
    setInterval(() => {
      const dir = directions[Math.floor(Math.random() * directions.length)];
      bot.setControlState(dir, true);
      setTimeout(() => bot.setControlState(dir, false), 1000);
    }, 15000);

    // 🦘 Jump to avoid AFK
    setInterval(() => {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }, 10000);

    // 👁️ Random look
    setInterval(() => {
      const yaw = (Math.random() - 0.5) * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI / 2;
      bot.look(yaw, pitch, true);
    }, 8000);

// 🗡️ Hunt & attack hostile mobs
setInterval(() => {
  const hostile = bot.nearestEntity(e =>
    e.type === 'mob' &&
    e.isValid &&
    ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'].includes(e.name)
  );

  if (hostile) {
    const distance = bot.entity.position.distanceTo(hostile.position);
    if (distance > 3) {
      bot.pathfinder.setGoal(new GoalFollow(hostile, 2));
    } else {
      bot.lookAt(hostile.position.offset(0, hostile.height, 0)).then(() => {
        bot.attack(hostile);
        console.log(`⚔️ Attacking ${hostile.name}`);
      });
    }
  }
}, 2500);

// 🍗 Auto-heal when hungry or hurt
setInterval(() => {
  if (bot.food < 20 || bot.health < 20) {
    const food = bot.inventory.items().find(item =>
      item.name.includes('cooked_beef') || item.name.includes('apple') || item.name.includes('bread')
    );
    if (food) {
      bot.clearControlStates(); // Stop moving
      bot.equip(food, 'hand').then(() => {
        bot.consume().then(() => {
          console.log('🍗 Healed: eating food...');
        }).catch(() => {});
      }).catch(() => {});
    }
  }
}, 7000);



    // ✅ Chat loop
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
      "man ko un sme man stfu aq tk tipu ni wt aq baran gile af like icl ts pmo sm hg ptut senyp sybau like bro ts sgt kevin",
      "ma bad ma bad ma fault²",
      "SHOW ME YO WILLYYYYY",
      "apa ko aku bukan yatim",
      "blablablbelbelbleblulbu",
      "ahhhh yes king",
      "sunyi siak",
      "MUSTARRRRRRRDDDDDDDD",
      "setiap pendosa pasti taubat..dengan itu cukuplah menyebut dosa orang kerana anda juga mempunyai dosa tetapi Allah menutup aibmu.",
      "because he kno how tu play futbal more than ronaldo",
      "how gud is that dihh yes king auhghh",
      "sat berak sat",
      "tkpe a tk jdi,kentut aja",
      "asal korg senyap ja",
      "WOIIIII TK LARAT NI WE",
      "sedar tk sedar pada satu hari nanti kita tidak jumpa lagi jadi bermainlah selagi ada masa",
      "sybau",
      "23duatiga24",
      "stecu stecu stelan cuek baru malu aduh adik ini mw juga abang yang rayu",
      "kalau harini menanggg!! gloryglory man unitedddd",
      "said im fine said i move on",
      "aku selalu tersenyummmm",
      "nampak bosan kan? tapi game chat ni bole buat kita pejamkan mata dan bayangkan muka iman",
      "AUFFUDUDHDUDH SAKIT KEPALA AKU WIWOWUFJWOCBWOCJDOF TOLONG AKUH",
      "kalaulah aku bleh main ngan korg hm",
      "ok aq ulang blik dri awal"
    ];
    let index = 0;
    setInterval(() => {
      bot.chat(messages[index]);
      index = (index + 1) % messages.length;
    }, 90000);
  });

  // ✅ Reconnect on error
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

createBot();

// ✅ Keep-alive using Express
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(3000, () => console.log("🌐 Express server active on port 3000"));

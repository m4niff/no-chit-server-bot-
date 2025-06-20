const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const express = require('express');

let bot;

function createBot() {
  bot = mineflayer.createBot({
    host: "skibidimustard.aternos.me",
    port: 19470,
    username: "messi",
    version: "1.12.1",
    keepAlive: false
  });

  bot.once('spawn', () => {
    bot.loadPlugin(pathfinder);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);

    console.log('✅ Bot joined');

    // ✅ Random movement to avoid idle
    const directions = ['forward', 'back', 'left', 'right'];
    setInterval(() => {
      if (!bot || !bot.setControlState) return;
      const dir = directions[Math.floor(Math.random() * directions.length)];
      bot.setControlState(dir, true);
      setTimeout(() => bot.setControlState(dir, false), 1000);
    }, 15000);

    // ✅ Jump every 10 seconds
    setInterval(() => {
      if (bot && bot.setControlState) {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 500);
      }
    }, 10000);

    // ✅ Look around randomly
    setInterval(() => {
      const yaw = (Math.random() - 0.5) * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI / 2;
      bot.look(yaw, pitch, true);
    }, 8000);

  // ✅ Simple sleep: click bed if night
setInterval(() => {
  if (!bot.time || !bot.entity) return;

  if (bot.time.isNight && !bot.isSleeping) {
    const bed = bot.findBlock({
      matching: block => bot.isABed(block),
      maxDistance: 6
    });

    if (bed) {
      bot.lookAt(bed.position.offset(0.5, 0.5, 0.5), true, () => {
        bot.sleep(bed).then(() => {
          console.log("🛏️ Sleeping...");
          bot.chat("tido la gile");
        }).catch(err => {
          console.log("⚠️ Couldn't sleep:", err.message);
        });
      });
    }
  }
}, 15000);



    // ✅ Chat loop
    const messages = [
       "where the fuck am i tf?",
      "pahal aku teperangkap anjj",
      "lepaskan saya lepaskan sayaa saya ketua lanun",
      "oh shi aku lupa aku hanyalah robot hm",
      "bising bdo karina",
      "amirul hadif x nurul iman",
      "gpp jadi sok asik asalkan aq tolong on kan server ni 24 jam",
      "duatiga duatiga dua empat",
      "boikot perempuan nme sofea pantek jubo lahanat",
      "bising do bal",
      "man ko un sme man stfu aq tk tipu ni wt aq baran gile af like icl ts pmo sm hg ptut senyp sybau like bro ts sgt kevin",
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
      "SubhanAllah Alhamdulillah AstagfiruAllah Lailaha ilallah Allahu Akbar",
      "taubat ygy",
      "kalaulah aku bleh main ngan korg hm",
      "SAYA ULANGGG!!!"
    ];
    let index = 0;
    setInterval(() => {
      bot.chat(messages[index]);
      index = (index + 1) % messages.length;
    }, 90000);
  });

// ✅ Join/Leave message
const recentJoins = new Set();
const recentLeaves = new Set();

bot.on('playerJoined', (player) => {
  if (player.username !== bot.username && !recentJoins.has(player.username)) {
    recentJoins.add(player.username);
    setTimeout(() => {
      bot.chat(`weyyy ${player.username} dah masuk piwitt Hi, I have autism too! Sending hugs!`);
      setTimeout(() => recentJoins.delete(player.username), 5000);
    }, 5000); // ← change this delay (5s)
  }
});

bot.on('playerLeft', (player) => {
  if (player.username !== bot.username && !recentLeaves.has(player.username)) {
    recentLeaves.add(player.username);
    setTimeout(() => {
      bot.chat(`yela babaii ${player.username} i wil mis u bebeh forevah`);
      setTimeout(() => recentLeaves.delete(player.username), 5000);
    }, 5000); // ← change this delay (5s)
  }
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

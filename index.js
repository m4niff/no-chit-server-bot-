const mineflayer = require('mineflayer');
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

  bot.on('spawn', () => {
    console.log('✅ Bot joined');

    // ✅ Force survival if in spectator mode
    if (bot.game.gameMode !== 'survival') {
      bot.chat('/gamemode survival');
    }

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

    // ✅ Sleep if it's night and bed is nearby
    setInterval(() => {
      if (!bot.time || !bot.entity) return;
      if (bot.time.isNight) {
        const bed = bot.findBlock({
          matching: block => bot.isABed(block),
          maxDistance: 16
        });

        if (bed) {
          bot.sleep(bed).then(() => {
            console.log("🛏️ Sleeping...");
          }).catch(err => {
            console.log("⚠️ Sleep failed:", err.message);
          });
        }
      }
    }, 20000);

    // ✅ Chat loop
    const messages = [
      "where the fuck am i tf?",
      "pahal aku teperangkap anjj",
      "lepaskan saya lepaskan sayaa saya ketua lanun",
      "oh shi aku lupa aku hanyalah robot hm",
      "bising bdo karina",
      "amirul fadif x nurul iman",
      "gpp jadi sok asik asalkan aq tolong on kan server ni 24 jam",
      "duatiga duatiga dua empat",
      "boikot perempuan nme sofea pantek jubo lahanat",
      "bising do bal",
      "SHOW ME YO WILLYYYYY",
      "apa ko aku bukan yatim",
      "blablablbelbelbleblulbu",
      "sunyi siak",
      "MUSTARRRRRRRDDDDDDDD",
      "taubat ygy",
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
      }, 1500);
    }
  });

  bot.on('playerLeft', (player) => {
    if (player.username !== bot.username && !recentLeaves.has(player.username)) {
      recentLeaves.add(player.username);
      setTimeout(() => {
        bot.chat(`yela babaii ${player.username} i wil mis u bebeh forevah`);
        setTimeout(() => recentLeaves.delete(player.username), 5000);
      }, 1500);
    }
  });

  // ✅ Reconnect on kick or end
  bot.on('end', () => {
    console.log("❌ Disconnected. Reconnecting in 90 seconds...");
    setTimeout(createBot, 90000);
  });

  bot.on('error', err => {
    console.log("⚠️ Error:", err.message);
    console.log("🔄 Reconnecting in 90 seconds...");
    setTimeout(createBot, 90000);
  });

  bot.on('kicked', reason => {
    console.log("🚫 Bot was kicked:", reason);
    console.log("🔄 Reconnecting in 90 seconds...");
    setTimeout(createBot, 90000);
  });
}

createBot();

// ✅ Keep-alive using Express
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(3000, () => console.log("🌐 Express server active on port 3000"));

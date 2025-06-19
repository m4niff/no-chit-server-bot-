const mineflayer = require('mineflayer');
const express = require('express');

let bot;
let jumpInterval;
let chatInterval;

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

    // Safe movement to avoid idle kick
    jumpInterval = setInterval(() => {
      if (!bot || typeof bot.setControlState !== 'function') return;
      bot.setControlState('jump', true);
      setTimeout(() => {
        if (bot) bot.setControlState('jump', false);
      }, 500);
    }, 10000);

    
    // 💬 AFK chat messages
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

  // 👥 Join/Leave messages
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

  // 🔁 Auto reconnect
  bot.on('end', () => {
    console.log("❌ Disconnected. Reconnecting in 90 seconds...");
    setTimeout(createBot, 90000);
  });

  bot.on('error', err => {
    console.log("⚠️ Error:", err.message);
    console.log("🔄 Reconnecting in 90 seconds...");
    setTimeout(createBot, 90000);
  });

  bot.on('kicked', (reason) => {
    console.log("🚫 Bot was kicked:", reason);
    console.log("🔄 Reconnecting in 90 seconds...");
    setTimeout(createBot, 90000);
  });
}

createBot();

// 🌐 Express keep-alive (for uptime sites like BetterUptime)
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(3000, () => console.log("🌐 Express server active on port 3000"));

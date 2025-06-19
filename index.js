const mineflayer = require('mineflayer');
const express = require('express');

// Start web server to prevent Render from sleeping
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(3000, () => console.log("🌐 Express server active on port 3000"));

function createBot() {
  const bot = mineflayer.createBot({
    host: "skibidimustard.aternos.me",
    port: 19470,
    username: "messi",
    version: "1.12.1",
    keepAlive: true
  });

  bot.on('spawn', () => {
    console.log('✅ Bot joined');

    // Movement directions
    const directions = ['forward', 'back', 'left', 'right'];

    // Walk randomly
    setInterval(() => {
      const dir = directions[Math.floor(Math.random() * directions.length)];
      bot.setControlState(dir, true);
      setTimeout(() => bot.setControlState(dir, false), 1500 + Math.random() * 1500);
    }, 15000); // Every 15 sec

    // Random look around
    setInterval(() => {
      const yaw = Math.random() * 2 * Math.PI;
      const pitch = Math.random() * Math.PI - (Math.PI / 2);
      bot.look(yaw, pitch, true);
    }, 12000);

    // Jump occasionally
    setInterval(() => {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 400);
    }, 10000);

    // Chat every 90 seconds
    const messages = [
      "where the fuck am i tf?",
      "pahal aku teperangkap anjj",
      "lepaskan saya lepaskan sayaa saya ketua lanun",
      "oh shi aku lupa aku hanyalah robot hm",
      "bising bdo karina",
      "mirul adif x nurul iman",
      "boikot perempuan nme sofea pantek jubo lahanat",
      "bising do bal",
      "man ko un sme man stfu aq tk tipu ni wt aq baran gile af like icl ts pmo sm hg ptut senyp sybau like bro ts sgt kevin",
      "SHOW ME YO WILLYYYYY",
      "apa ko aku bukan yatim",
      "ahhhh yes king",
      "sunyi siak",
      "MUSTARRRRRRRDDDDDDDD",
      "sat berak sat",
      "kalau harini menanggg!! gloryglory man unitedddd",
      "aku selalu tersenyummmm",
      "SubhanAllah Alhamdulillah AstagfiruAllah Lailaha ilallah Allahu Akbar",
      "taubat ygy",
      "kalaulah aku bleh main ngan korg hm",
      "SAYA ULANGGG!!!"
    ];
    let index = 0;
    setInterval(() => {
      bot.chat(messages[index]);
      index = (index + 1) % messages.length;
    }, 90000); // 90 seconds
  });

  bot.on('end', () => {
    console.log("❌ Disconnected. Reconnecting in 90 seconds...");
    setTimeout(createBot, 90000);
  });

  bot.on('error', err => {
    console.log("⚠️ Error:", err.message);
    console.log("🔄 Attempting to reconnect in 90 seconds...");
    setTimeout(createBot, 90000);
  });

  bot.on('kicked', (reason) => {
    console.log("🚫 Bot was kicked:", reason);
    console.log("🔄 Reconnecting in 90 seconds...");
    setTimeout(createBot, 90000);
  });
}

createBot();

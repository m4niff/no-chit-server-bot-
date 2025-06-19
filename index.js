const mineflayer = require('mineflayer');
const express = require('express');

function createBot() {
  const bot = mineflayer.createBot({
    host: "skibidimustard.aternos.me",
    port: 19470,
    username: "messi",
    version: "1.12.1",
    keepAlive: false
  });

  bot.on('spawn', () => {
    console.log('✅ Bot joined');

    // AFK Movement
    setInterval(() => {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }, 10000);

    // AFK Chat
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

    // Detect join/leave messages via chat
    bot.on('message', (jsonMsg) => {
      const msg = jsonMsg.toString();
      const matchJoin = msg.match(/^(\w+) joined the game$/);
      const matchLeave = msg.match(/^(\w+) left the game$/);

      if (matchJoin) {
        const name = matchJoin[1];
        if (name !== 'messi') bot.chat(`weyyy ${name} dah masukk piwittHi, I have autism too! It’s so nice for someone to raise awareness about our condition. Sending hugs!`);
      }

      if (matchLeave) {
        const name = matchLeave[1];
        if (name !== 'messi') bot.chat(`yela babaii ${name} i miss you bebeh`);
      }
    });
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

const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(3000, () => console.log("🌐 Express server active on port 3000"));

const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
let sock = null;

async function startBot(){
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({level:'silent'}),
    browser: ['SHAJU BOT', 'Chrome', '1.0'] // <-- EITA LAGBOI, NAILE LINK OIBO NA
  });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('group-participants.update', async (u)=>{
    if(u.action === 'add'){
      for(let p of u.participants){
        try{ await sock.sendMessage(u.id, {text: `Welcome @${p.split('@')[0]} to the group! Type *.menu*`, mentions:[p]}); }catch(e){}
      }
    }
  });

  sock.ev.on('messages.upsert', async (m)=>{
    try{
      const msg = m.messages[0];
      if(!msg.message || msg.key.fromMe) return;
      let raw = "";
      if(msg.message.conversation) raw = msg.message.conversation;
      else if(msg.message.extendedTextMessage) raw = msg.message.extendedTextMessage.text;
      else if(msg.message.imageMessage) raw = msg.message.imageMessage.caption || "";
      else if(msg.message.videoMessage) raw = msg.message.videoMessage.caption || "";
      raw = raw.trim();
      let text = raw.toLowerCase();
      console.log("MSG AISHE:", raw);
      const from = msg.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      const sender = msg.key.participant || msg.key.remoteJid;

      if(isGroup && (text.includes('https://') || text.includes('http://') || text.includes('wa.me/') || text.includes('chat.whatsapp.com/'))){
        try{
          await sock.sendMessage(from, {delete: msg.key});
          await sock.sendMessage(from, {text: `Link not allowed @${sender.split('@')[0]}`, mentions:[sender]});
        }catch(e){}
        return;
      }

      let cmd = text;
      if(cmd.startsWith('.')) cmd = cmd.slice(1);
      let cmdName = cmd.split(' ')[0];

      let reply = "";
      if(cmdName === 'menu' || cmdName === 'hi' || cmdName === 'hello' || cmdName === 'help'){
        reply = "*SHAJU BOT - TOP 1 GROUP BOT*\n\n*.menu* - Show menu\n*.alive* - Bot alive?\n*.owner* - Owner info\n*.tagall* - Tag all members\n*.kick* - Reply to kick\n*.song* - Download song\n\nGroup: Welcome + Anti-Link Auto ON";
      }
      else if(cmdName === 'alive' || cmdName === 'ping'){
        reply = "✅ SHAJU BOT is Alive!\nBot is Working 100%";
      }
      else if(cmdName === 'owner'){
        reply = "👑 Owner: Shaju Khan\n🤖 Bot: SHAJU BOT\n✅ Top 1 Group Bot";
      }
      else if(cmdName === 'tagall' && isGroup){
        try{
          const meta = await sock.groupMetadata(from);
          const members = meta.participants.map(p=>p.id);
          let txt = "*TAG ALL - SHAJU BOT*\n\n";
          members.forEach(m=> txt += `@${m.split('@')[0]} `);
          await sock.sendMessage(from, {text: txt, mentions: members});
          return;
        }catch(e){ reply = "Bot ke Admin banau, tarpor .tagall likho"; }
      }
      // KICK - EITA AGE ASIL NA
      else if(cmdName === 'kick' && isGroup){
        try{
          let target = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
          if(!target){ reply = "Reply ba Tag koira .kick likho"; }
          else { await sock.groupParticipantsUpdate(from, [target], 'remove'); reply = "✅ Kicked Successfully - SHAJU BOT"; }
        }catch(e){ reply = "Bot ke Admin banau!"; }
      }
      // SONG - EITA AGE ASIL NA
      else if(cmdName === 'song'){
        let query = raw.slice(5).trim();
        if(!query){ reply = "Likho: .song premke rangme"; }
        else {
          try{
            await sock.sendMessage(from, {text: "🎵 Searching: " + query});
            const yts = require('yt-search');
            const ytdl = require('@distube/ytdl-core');
            let s = await yts(query);
            let v = s.videos[0];
            let stream = ytdl(v.url, {filter:'audioonly', quality:'highestaudio'});
            let chunks=[]; for await(let c of stream) chunks.push(c);
            await sock.sendMessage(from, {audio: Buffer.concat(chunks), mimetype:'audio/mp4', fileName: v.title+'.mp3'});
            return;
          }catch(e){ reply = "❌ Song painai, arekta naam deo"; }
        }
      }

      if(reply){
        await sock.sendMessage(from, {text: reply});
      }
    }catch(e){ console.log("ERROR:", e); }
  });

  // THIK KORA CONNECTION - LOGOUT OILE RESTART MARTO NA
  sock.ev.on('connection.update', (u)=>{
    console.log("CONNECTION:", u.connection);
    if(u.connection==='close'){
      let code = u.lastDisconnect?.error?.output?.statusCode;
      console.log("Close Reason:", code);
      if(code !== DisconnectReason.loggedOut){
        setTimeout(startBot, 3000);
      } else {
        console.log("LOGGED OUT - Delete auth folder & Pair Again");
      }
    }
    if(u.connection==='open') console.log("BOT CONNECTED - READY FOR DOT COMMANDS");
  });
}
startBot().catch(e=>console.log(e));

// THIK KORA PAIR API
app.post('/api/pair', async (req,res)=>{
  try{
    let number = req.body.number.replace(/[^0-9]/g,'');
    if(!sock) return res.json({code:"WAIT 10 SEC"});
    // Agei link thakle
    if(sock.authState?.creds?.registered){
      return res.json({code:"ALREADY LINKED"});
    }
    let code = await sock.requestPairingCode(number);
    res.json({code: code});
  }catch(e){ console.log(e); res.json({code:"TRY AGAIN"}); }
});
app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(process.env.PORT || 3000, ()=> console.log("Running"));
const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
let sock = null;
let startTime = Date.now();

async function startBot(){
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({level:'silent'}),
    browser: ['SHAJU BOT', 'Chrome', '1.0']
  });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('group-participants.update', async (u)=>{
    if(u.action === 'add'){
      for(let p of u.participants){
        try{ await sock.sendMessage(u.id, {text: `👋 Welcome @${p.split('@')[0]} to the group!\nType *.menu*`, mentions:[p]}); }catch(e){}
      }
    }
  });

  sock.ev.on('messages.upsert', async (m)=>{
    try{
      const msg = m.messages[0];
      if(!msg.message || msg.key.fromMe) return;
      let raw = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
      raw = raw.trim();
      let text = raw.toLowerCase();
      const from = msg.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      const sender = msg.key.participant || msg.key.remoteJid;

      if(isGroup && (text.includes('https://') || text.includes('http://') || text.includes('wa.me/') || text.includes('chat.whatsapp.com/'))){
        try{ await sock.sendMessage(from, {delete: msg.key}); await sock.sendMessage(from, {text: `🚫 Link not allowed @${sender.split('@')[0]}`, mentions:[sender]}); }catch(e){}
        return;
      }

      let cmd = text.startsWith('.') ? text.slice(1) : text;
      let cmdName = cmd.split(' ')[0];

      if(cmdName === 'menu'){
        await sock.sendMessage(from, {text: `👑 *SHAJU BOT - TOP 1 GROUP BOT* 👑\n\n.open - Group Khulo\n.close - Group Bondho\n.menu - Menu\n.ping - Speed\n.alive - Status\n.tagall - Sobaire Tag\n.owner - Owner Info\n.kick - Reply diya Kick\n.song <name> - Gan\n\nAuto Welcome + Anti-Link ON ✅`});
        return;
      }
      if(cmdName === 'ping'){ await sock.sendMessage(from, {text: `⚡ Ping\n© SHAJU BOT : 116 Ms`}); return; }
      if(cmdName === 'alive'){
        let up = Math.floor((Date.now()-startTime)/1000);
        await sock.sendMessage(from, {text: `🌹 *SHAJU BOT is Online* 🌹\n\n✅ Status : Online\n⏰ Uptime : ${Math.floor(up/86400)}d ${Math.floor((up%86400)/3600)}h ${Math.floor((up%3600)/60)}m ${up%60}s\n👑 Owner : SAJU\n🤖 Bot : SHAJU BOT`});
        return;
      }
      if(cmdName === 'tagall' && isGroup){
        const meta = await sock.groupMetadata(from);
        const members = meta.participants.map(p=>p.id);
        let txt = `🚨 *ATTENTION EVERYONE* 🚨\n\n`;
        members.forEach((id,i)=> txt += `${i+1}. @${id.split('@')[0]}\n`);
        txt += `\n*TOTAL: ${members.length} MEMBERS*`;
        await sock.sendMessage(from, {text: txt, mentions: members}); return;
      }
      if(cmdName === 'owner'){ await sock.sendMessage(from, {text: `👑 *OWNER INFO* 👑\n\n👤 NAME : MD SAJJADUL ISLAM (SAJU)\n🎂 AGE : 21\n📍 FROM : Sylhet, Bangladesh\n🤖 BOT : SHAJU BOT`}); return; }
      if(cmdName === 'kick' && isGroup){
        let target = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if(!target) await sock.sendMessage(from, {text: `Reply ba Tag koira .kick likho`});
        else { await sock.groupParticipantsUpdate(from, [target], 'remove'); await sock.sendMessage(from, {text: `✅ Kicked Successfully`}); }
        return;
      }
      if(cmdName === 'song'){
        let query = raw.slice(6).trim();
        if(!query){ await sock.sendMessage(from, {text: `🎵 Usage: .song <name>\nExample: .song Mann Mera`}); return; }
        await sock.sendMessage(from, {text: `🎵 Searching: ${query}...`});
        try{
          const yts = require('yt-search'); const ytdl = require('@distube/ytdl-core');
          let s = await yts(query); let v = s.videos[0];
          let stream = ytdl(v.url, {filter:'audioonly', quality:'highestaudio'});
          let chunks=[]; for await(let c of stream) chunks.push(c);
          await sock.sendMessage(from, {audio: Buffer.concat(chunks), mimetype:'audio/mp4', fileName: v.title+'.mp3'});
        }catch{ await sock.sendMessage(from, {text: `❌ Song painai`}); }
        return;
      }
      if(cmdName === 'open' && isGroup){ await sock.groupSettingUpdate(from, 'not_announcement'); await sock.sendMessage(from, {text: `✅ Group Is Open`}); return; }
      if(cmdName === 'close' && isGroup){ await sock.groupSettingUpdate(from, 'announcement'); await sock.sendMessage(from, {text: `🔒 *GROUP CLOSED*\n\nONLY ADMINS CAN SEND MESSAGES NOW`}); return; }

    }catch(e){ console.log(e); }
  });

  sock.ev.on('connection.update', (u)=>{
    if(u.connection==='close'){
      let code = u.lastDisconnect?.error?.output?.statusCode;
      if(code !== DisconnectReason.loggedOut) setTimeout(startBot, 3000);
    }
    if(u.connection==='open') console.log("BOT CONNECTED");
  });
}
startBot();

app.post('/api/pair', async (req,res)=>{
  try{
    let number = (req.body.number || '').toString().replace(/[^0-9]/g,'');
    if(!sock) return res.json({code:"WAIT 10 SEC"});
    if(sock.authState?.creds?.registered) return res.json({code:"ALREADY LINKED"});
    let code = await sock.requestPairingCode(number);
    res.json({code: code});
  }catch(e){ res.json({code:"TRY AGAIN"}); }
});
app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(process.env.PORT || 3000, ()=> console.log("Running"));
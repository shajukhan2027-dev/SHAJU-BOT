‎const express = require('express');
‎const path = require('path');
‎const app = express();
‎app.use(express.json());
‎app.use(express.static(path.join(__dirname, 'public')));
‎let sock = null;
‎
‎async function startBot(){
‎  const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
‎  const { state, saveCreds } = await useMultiFileAuthState('auth');
‎  sock = makeWASocket({ auth: state, printQRInTerminal: true, logger: require('pino')({level:'silent'}) });
‎  sock.ev.on('creds.update', saveCreds);
‎
‎  // 1. WELCOME - DOT LAGBO NA, AUTO
‎  sock.ev.on('group-participants.update', async (u)=>{
‎    if(u.action === 'add'){
‎      for(let p of u.participants){
‎        try{ await sock.sendMessage(u.id, {text: `Welcome @${p.split('@')[0]} to the group! Type *.menu*`, mentions:[p]}); }catch(e){}
‎      }
‎    }
‎  });
‎
‎  sock.ev.on('messages.upsert', async (m)=>{
‎    try{
‎      const msg = m.messages[0];
‎      if(!msg.message || msg.key.fromMe) return;
‎
‎      // SOB DHORONER MSG DHORBO - FIX
‎      let raw = "";
‎      if(msg.message.conversation) raw = msg.message.conversation;
‎      else if(msg.message.extendedTextMessage) raw = msg.message.extendedTextMessage.text;
‎      else if(msg.message.imageMessage) raw = msg.message.imageMessage.caption || "";
‎      else if(msg.message.videoMessage) raw = msg.message.videoMessage.caption || "";
‎      raw = raw.trim();
‎      let text = raw.toLowerCase();
‎      console.log("MSG AISHE:", raw);
‎
‎      const from = msg.key.remoteJid;
‎      const isGroup = from.endsWith('@g.us');
‎      const sender = msg.key.participant || msg.key.remoteJid;
‎
‎      // 2. ANTI-LINK - AUTO
‎      if(isGroup && (text.includes('https://') || text.includes('http://') || text.includes('wa.me/') || text.includes('chat.whatsapp.com/'))){
‎        try{
‎          await sock.sendMessage(from, {delete: msg.key});
‎          await sock.sendMessage(from, {text: `Link not allowed @${sender.split('@')[0]}`, mentions:[sender]});
‎        }catch(e){}
‎        return;
‎      }
‎
‎      // DOT FIX - .menu ar menu 2 tai cholbo
‎      // .menu -> menu, .alive -> alive
‎      let cmd = text;
‎      if(cmd.startsWith('.')) cmd = cmd.slice(1); // samner dot kaita dilam
‎      cmd = cmd.split(' ')[0]; // .tagall hello -> tagall
‎
‎      let reply = "";
‎      // 3. MENU - .menu
‎      if(cmd === 'menu' || cmd === 'hi' || cmd === 'hello' || cmd === 'help'){
‎        reply = "*SHAJU BOT - TOP 1 GROUP BOT*\n\n*.menu* - Show menu\n*.alive* - Bot alive?\n*.owner* - Owner info\n*.tagall* - Tag all members\n\nGroup: Welcome + Anti-Link Auto ON";
‎      }
‎      // 4. ALIVE - .alive
‎      else if(cmd === 'alive' || cmd === 'ping'){
‎        reply = "✅ SHAJU BOT is Alive!\nBot is Working 100%";
‎      }
‎      // 5. OWNER - .owner
‎      else if(cmd === 'owner'){
‎        reply = "👑 Owner: Shaju Khan\n🤖 Bot: SHAJU BOT\n✅ Top 1 Group Bot";
‎      }
‎      // 6. TAGALL - .tagall
‎      else if(cmd === 'tagall' && isGroup){
‎        try{
‎          const meta = await sock.groupMetadata(from);
‎          const members = meta.participants.map(p=>p.id);
‎          let txt = "*TAG ALL - SHAJU BOT*\n\n";
‎          members.forEach(m=> txt += `@${m.split('@')[0]} `);
‎          await sock.sendMessage(from, {text: txt, mentions: members});
‎          console.log("TAGALL DONE");
‎          return;
‎        }catch(e){ reply = "Bot ke Admin banau, tarpor .tagall likho"; }
‎      }
‎
‎      if(reply){
‎        console.log("REPLY DITASI:", reply);
‎        await sock.sendMessage(from, {text: reply});
‎      }
‎    }catch(e){ console.log("ERROR:", e); }
‎  });
‎
‎  sock.ev.on('connection.update', (u)=>{
‎    console.log("CONNECTION:", u.connection);
‎    if(u.connection==='close') setTimeout(startBot,3000);
‎    if(u.connection==='open') console.log("BOT CONNECTED - READY FOR DOT COMMANDS");
‎  });
‎}
‎startBot().catch(e=>console.log(e));
‎
‎app.post('/api/pair', async (req,res)=>{
‎  try{
‎    let number = req.body.number.replace(/[^0-9]/g,'');
‎    if(!sock) return res.json({code:"WAIT 10 SEC"});
‎    let code = await sock.requestPairingCode(number);
‎    res.json({code: code});
‎  }catch(e){ res.json({code:"TRY AGAIN"}); }
‎});
‎app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
‎app.listen(process.env.PORT || 3000, ()=> console.log("Running"));
‎
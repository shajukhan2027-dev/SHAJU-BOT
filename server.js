const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
let sock = null;

async function startBot(){
  const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  sock = makeWASocket({ auth: state, printQRInTerminal: true, logger: require('pino')({level:'silent'}) });
  sock.ev.on('creds.update', saveCreds);

  // 1. WELCOME - 100% kaj korbo
  sock.ev.on('group-participants.update', async (u)=>{
    if(u.action === 'add'){
      for(let p of u.participants){
        await sock.sendMessage(u.id, {text: `Welcome @${p.split('@')[0]} to the group! Type *menu*`, mentions:[p]});
      }
    }
  });

  sock.ev.on('messages.upsert', async (m)=>{
    const msg = m.messages[0];
    if(!msg.message || msg.key.fromMe) return;
    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = msg.key.participant || msg.key.remoteJid;

    // 2. ANTI-LINK - 100% kaj korbo
    if(isGroup && (text.includes('https://') || text.includes('http://'))){
      try{
        await sock.sendMessage(from, {delete: msg.key});
        await sock.sendMessage(from, {text: `Link not allowed @${sender.split('@')[0]}`, mentions:[sender]});
      }catch(e){}
      return;
    }

    let reply = "";
    // 3. MENU
    if(text === 'menu' || text === 'hi' || text === 'hello'){
      reply = "*SHAJU BOT - TOP 1 GROUP BOT*\n\nmenu - Show menu\nalive - Bot alive?\nowner - Owner info\n.tagall - Tag all members\n\nGroup: Welcome + Anti-Link Auto ON";
    }
    // 4. ALIVE
    else if(text === 'alive'){ reply = "SHAJU BOT is Alive!"; }
    // 5. OWNER
    else if(text === 'owner'){ reply = "Owner: Shaju Khan\nBot: SHAJU BOT"; }
    // 6. TAGALL - 100% kaj korbo
    else if(text === '.tagall' && isGroup){
      try{
        const meta = await sock.groupMetadata(from);
        const members = meta.participants.map(p=>p.id);
        let txt = "*TAG ALL*\n\n";
        members.forEach(m=> txt += `@${m.split('@')[0]} `);
        await sock.sendMessage(from, {text: txt, mentions: members});
        return;
      }catch(e){ reply = "Bot ke Admin banau, tarpor .tagall likho"; }
    }

    if(reply) await sock.sendMessage(from, {text: reply});
  });
  sock.ev.on('connection.update', (u)=>{ if(u.connection==='close') setTimeout(startBot,3000); });
}
startBot().catch(e=>console.log(e));

app.post('/api/pair', async (req,res)=>{
  try{
    let number = req.body.number.replace(/[^0-9]/g,'');
    if(!sock) return res.json({code:"WAIT 10 SEC"});
    let code = await sock.requestPairingCode(number);
    res.json({code: code});
  }catch(e){ res.json({code:"TRY AGAIN"}); }
});
app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(process.env.PORT || 3000, ()=> console.log("Running"));
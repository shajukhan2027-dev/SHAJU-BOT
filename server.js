const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;

let sock = null;
let lastCode = null;

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  sock = makeWASocket({
    logger: pino({level:'silent'}),
    printQRInTerminal: false,
    auth: state,
    browser: ['SHAJU BOT','Chrome','1.0'],
    markOnlineOnConnect: true
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u)=>{
    console.log('STATUS:', u.connection);
    if(u.connection==='close'){
      console.log('Reconnecting...');
      setTimeout(startBot, 3000);
    }
    if(u.connection==='open'){
      console.log('CONNECTED SUCCESSFULLY - SHAJU BOT LIVE!');
    }
  });
  // Auto Reply - Shob feature
  sock.ev.on('messages.upsert', async ({messages})=>{
    const m = messages[0];
    if(!m.message || m.key.fromMe) return;
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase();
    const from = m.key.remoteJid;
    if(text.includes('hi') || text.includes('hello') || text.includes('salam')) await sock.sendMessage(from, {text: 'Assalamualaikum! Ami SHAJU BOT 🤖 Shopnopuri thaki aisi! Help lagle *menu* lekho.'});
    else if(text.includes('menu')) await sock.sendMessage(from, {text: '🌸 *SHAJU BOT MENU* 🌸\n\n1. hi - Salam\n2. gaan - Gaan bajbo\n3. shopno - Shopnopuri theme\n4. owner - Shaju bhai\n5. song - Amader Deshta Shopnopuri'});
    else if(text.includes('gaan') || text.includes('song')) await sock.sendMessage(from, {text: '🎵 Amader Deshta Shopnopuri, Sathi Modher Phul Pori... 🎵\nWebsite e gaan bajer bhai!'});
    else if(text.includes('owner')) await sock.sendMessage(from, {text: 'Amar Malik Nationalist Shaju Khan 👑 Sylhet, Dayamir er gorbo!'});
    else if(text.includes('shopno')) await sock.sendMessage(from, {text: '✨ Shopner Porir Moto Sundor Ei Desh ✨ Amader Sylhet!'});
  });
}
startBot();

app.post('/api/pair', async (req,res)=>{
  try{
    let {number} = req.body;
    number = number.replace(/[^0-9]/g,'');
    if(!sock) return res.json({code:'WAIT - SERVER STARTING...'});
    let code = await sock.requestPairingCode(number);
    lastCode = code;
    console.log('PAIR CODE FOR', number, code);
    res.json({code});
  }catch(e){ console.log(e); res.json({code:'TRY AGAIN'}); }
});
app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, ()=> console.log('Server running on', PORT));
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(express.json());
app.use(express.static('public'));
let sock;
async function startBot(number){
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, printQRInTerminal: false, browser: ["SHAJU BOT","Chrome","1.0"] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u)=>{
    if(u.connection==='open') console.log('BOT CONNECTED!');
  });
  await new Promise(r=>setTimeout(r,2000));
  if(!sock.authState.creds.registered){
    let code = await sock.requestPairingCode(number);
    return code;
  }
  return "ALREADY CONNECTED";
}
app.post('/api/pair', async (req,res)=>{
  try{
    let num = req.body.number.replace(/[^0-9]/g,'');
    let code = await startBot(num);
    res.json({code});
  }catch(e){ res.json({code:"TRY AGAIN - "+e.message}) }
});
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Live on '+PORT));
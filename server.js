const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let sock = null;
let currentCode = null;

async function startBot(numberForPair) {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['SHAJU BOT', 'Chrome', '1.0']
  });
  sock.ev.on('creds.update', saveCreds);

  // Pair Code Chaile
  if (numberForPair && !state.creds.registered) {
    try {
      let code = await sock.requestPairingCode(numberForPair);
      currentCode = code;
      console.log('PAIR CODE: ' + code);
    } catch (e) { console.log('Pair Error', e); }
  }

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'open') console.log('BOT CONNECTED ✅');
    if (connection === 'close') {
      let reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) startBot();
    }
  });

  // GROUP WELCOME
  sock.ev.on('group-participants.update', async (e) => {
    try {
      if (e.action === 'add') {
        for (let p of e.participants) {
          await sock.sendMessage(e.id, { text: `👋 Welcome @${p.split('@')[0]} To The Group!\n👑 SHAJU BOT`, mentions: [p] });
        }
      }
    } catch {}
  });

  // MESSAGES
  sock.ev.on('messages.upsert', async ({ messages }) => {
    let msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    let from = msg.key.remoteJid;
    let text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    if (!text) return;
    console.log('MSG AISHE: ' + text);

    // ANTI-LINK
    if (from.endsWith('@g.us') && (text.includes('https://') || text.includes('chat.whatsapp.com'))) {
      try {
        let sender = msg.key.participant;
        await sock.sendMessage(from, { text: `❌ Link Not Allowed @${sender.split('@')[0]}`, mentions: [sender] });
        await sock.sendMessage(from, { delete: msg.key });
      } catch {}
      return;
    }

    // .menu
    if (text === '.menu') {
      await sock.sendMessage(from, { text: `👑 SHAJU BOT - TOP 1 GROUP BOT\n\n.menu - Show All Commands\n.ping - Check Bot Speed\n.alive - Bot Status\n.tagall - Tag All Members\n.owner - Owner Information\n.kick - Tag To Kick User\n.song - Download Any Song\n\nAuto Welcome + Anti-Link Works Automatically` });
      return;
    }
    // .ping
    if (text === '.ping') { await sock.sendMessage(from, { text: '🏓 Pong! Bot Is Fast ✅' }); return; }
    // .alive
    if (text === '.alive') { await sock.sendMessage(from, { text: '✅ SHAJU BOT Is Alive And Online 👑' }); return; }
    // .owner
    if (text === '.owner') { await sock.sendMessage(from, { text: '👑 Owner: Shaju Khan\n📞 +8801763512268' }); return; }

    // .tagall
    if (text === '.tagall') {
      if (!from.endsWith('@g.us')) return;
      let g = await sock.groupMetadata(from);
      let members = g.participants.map(p => p.id);
      let txt = '👑 SHAJU BOT Tagall\n\n' + members.map(m => '@' + m.split('@')[0]).join('\n');
      await sock.sendMessage(from, { text: txt, mentions: members });
      return;
    }

    // .kick
    if (text === '.kick' || text.startsWith('.kick ')) {
      if (!from.endsWith('@g.us')) { await sock.sendMessage(from, { text: '❌ Only In Group' }); return; }
      let target = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!target) { await sock.sendMessage(from, { text: 'Tag Or Reply To User(s) To Kick' }); return; }
      try { await sock.groupParticipantsUpdate(from, [target], 'remove'); await sock.sendMessage(from, { text: '✅ User Kicked Successfully\n👑 SHAJU BOT' }); }
      catch { await sock.sendMessage(from, { text: '❌ Failed! Make Bot Admin First!' }); }
      return;
    }

    // .song - DYNAMIC - Jeta Likhba Oita Aibo
    if (text.startsWith('.song ')) {
      let query = text.replace('.song ', '').trim();
      if (!query) { await sock.sendMessage(from, { text: '❌ Write Song Name\nExample: .song premke rangme' }); return; }
      await sock.sendMessage(from, { text: '🎵 Searching: ' + query + '\nPlease Wait...' });
      try {
        let search = await yts(query);
        let video = search.videos[0];
        await sock.sendMessage(from, { text: '🎶 Found: ' + video.title + '\n⏳ Downloading...' });
        let stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
        let chunks = []; for await (let c of stream) chunks.push(c);
        let buffer = Buffer.concat(chunks);
        await sock.sendMessage(from, { audio: buffer, mimetype: 'audio/mp4', fileName: video.title + '.mp3' });
      } catch { await sock.sendMessage(from, { text: '❌ Song Not Found, Try Another Name' }); }
      return;
    }
  });
}

// API - Tumar Website Eita Dake
app.post('/api/pair', async (req, res) => {
  let number = req.body.number?.replace(/[^0-9]/g, '');
  if (!number) return res.json({ code: 'INVALID' });
  if (!sock) await startBot(number);
  else if (!sock.authState?.creds?.registered) {
    try { currentCode = await sock.requestPairingCode(number); } catch {}
  }
  // 2 sec pore code pathao
  setTimeout(() => res.json({ code: currentCode || 'TRY AGAIN' }), 2000);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(3000, () => console.log('Server Running on 3000'));
startBot();
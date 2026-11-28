const WARNINGS = new Map();
const SPAM_TRACKER = new Map();

const DEFAULT_SETTINGS = {
  welcome: true,
  antiLink: true,
  antiSpam: true,
  badWordFilter: true,
  autoReply: true,
  groupProtection: true,
  badWords: ["boka", "kharap"],
  autoReplies: {
    hi: "Hello! 👋 Welcome to SHAJU BOT 💖",
    hello: "হ্যালো! ❤️ কেমন আছেন?",
    "assalamualaikum": "Walaikum Assalam! 💖 কেমন আছেন?"
  }
};

const botSettings = new Map();

function getSettings(ownerId) {
  if (!botSettings.has(ownerId)) {
    botSettings.set(ownerId, {
      ...DEFAULT_SETTINGS,
      badWords: [...DEFAULT_SETTINGS.badWords],
      autoReplies: { ...DEFAULT_SETTINGS.autoReplies }
    });
  }
  return botSettings.get(ownerId);
}

function checkLink(text) {
  return /(https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\/|telegram\.me\/)/i.test(text);
}

function checkSpam(text, chatId, sender) {
  const key = `${chatId}:${sender}`;
  const now = Date.now();
  const history = SPAM_TRACKER.get(key) || [];
  const recent = history.filter(time => now - time < 5000);
  recent.push(now);
  SPAM_TRACKER.set(key, recent);
  // 5 সেকেন্ডে 5টা মেসেজ বা 1500+ অক্ষর = স্প্যাম
  return recent.length >= 5 || text.length > 1500;
}

function checkBadWords(text, settings) {
  const low = text.toLowerCase();
  return settings.badWords.some(word => word && low.includes(word.toLowerCase()));
}

function addWarning(key) {
  const count = (WARNINGS.get(key) || 0) + 1;
  WARNINGS.set(key, count);
  return count;
}

async function isGroupAdmin(sock, chatId, sender) {
  try {
    const metadata = await sock.groupMetadata(chatId);
    const participant = metadata.participants.find(item => item.id === sender);
    return participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch { return false; }
}

// মেসেজ ডিলিট করার ফাংশন
async function deleteMsg(sock, chatId, message) {
  try {
    await sock.sendMessage(chatId, { delete: message.key });
  } catch {}
}

async function handleMessage(ownerId, message, sock) {
  try {
    if (!message.message || message.key.fromMe) return;

    const settings = getSettings(ownerId);
    const chatId = message.key.remoteJid;
    const sender = message.key.participant || chatId;

    const text =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    if (!text) return;
    const isGroup = chatId.endsWith("@g.us");
    const lower = text.toLowerCase().trim();

    if (isGroup) {
      const admin = await isGroupAdmin(sock, chatId, sender);

      // বট নিজে অ্যাডমিন না হইলে ডিলিট/কিক পারবো না
      if (!admin) {

        // 1. ANTI-LINK - ডিলিট + ওয়ার্নিং
        if (settings.antiLink && checkLink(text)) {
          await deleteMsg(sock, chatId, message);
          await sock.sendMessage(chatId, { text: "⚠️ লিংক পাঠানো নিষিদ্ধ! লিংক ডিলিট করা হইছে 💖" });
          return;
        }

        // 2. ANTI-SPAM - ডিলিট
        if (settings.antiSpam && checkSpam(text, chatId, sender)) {
          await deleteMsg(sock, chatId, message);
          await sock.sendMessage(chatId, { text: "⚠️ স্প্যাম মেসেজ পাঠাবেন না! ⛔" });
          return;
        }

        // 3. BAD WORD - 3 বার হইলে কিক
        if (settings.badWordFilter && checkBadWords(text, settings)) {
          const count = addWarning(`${chatId}:${sender}`);
          await deleteMsg(sock, chatId, message);

          if (count >= 3) {
            WARNINGS.delete(`${chatId}:${sender}`);
            await sock.sendMessage(chatId, { text: `⛔ @${sender.split("@")[0]} 3 বার খারাপ শব্দ ব্যবহার করায় গ্রুপ থেকে রিমুভ করা হইলো!`, mentions: [sender] });
            // বট অ্যাডমিন হইলে কিক করবো
            try { await sock.groupParticipantsUpdate(chatId, [sender], "remove"); } catch {}
          } else {
            await sock.sendMessage(chatId, { text: `⚠️ খারাপ শব্দ ব্যবহার করবেন না! Warning: ${count}/3` });
          }
          return;
        }
      }
    }

    // 4. AUTO REPLY - এখন ছোট হাত/বড় হাত + স্পেস সমস্যা নাই
    if (settings.autoReply) {
      const reply = settings.autoReplies[lower];
      if (reply) {
        await sock.sendMessage(chatId, { text: reply });
      }
    }

  } catch (error) {
    console.error("Feature error:", error.message);
  }
}

module.exports = { getSettings, handleMessage };

const WARNINGS = new Map();

const DEFAULT_SETTINGS = {
  welcome: true,
  antiLink: false,
  antiSpam: false,
  badWordFilter: false,
  autoReply: true,
  groupProtection: false,
  badWords: ["খারাপশব্দ"],
  autoReplies: {
    hi: "Hello! 👋 Welcome to SHAJU BOT.",
    hello: "হ্যালো! ❤️ কেমন আছেন?"
  }
};

function getSettings(ownerId) {
  if (!global.botSettings) global.botSettings = new Map();

  if (!global.botSettings.has(ownerId)) {
    global.botSettings.set(ownerId, {
      ...DEFAULT_SETTINGS,
      autoReplies: { ...DEFAULT_SETTINGS.autoReplies },
      badWords: [...DEFAULT_SETTINGS.badWords]
    });
  }

  return global.botSettings.get(ownerId);
}

function checkLink(text) {
  return /(https?:\/\/|www\.|chat\.whatsapp\.com\/)/i.test(text);
}

function checkSpam(text) {
  return /(.)\1{9,}/i.test(text) || text.length > 1500;
}

function checkBadWords(text, settings) {
  return settings.badWords.some(word =>
    word && text.toLowerCase().includes(word.toLowerCase())
  );
}

function addWarning(key) {
  const count = (WARNINGS.get(key) || 0) + 1;
  WARNINGS.set(key, count);
  return count;
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

    if (isGroup && settings.antiLink && checkLink(text)) {
      await sock.sendMessage(chatId, {
        text: "⚠️ লিংক পাঠানো নিষিদ্ধ!"
      });
      return;
    }

    if (isGroup && settings.antiSpam && checkSpam(text)) {
      await sock.sendMessage(chatId, {
        text: "⚠️ স্প্যাম মেসেজ পাঠাবেন না!"
      });
      return;
    }

    if (isGroup && settings.badWordFilter &&
        checkBadWords(text, settings)) {
      const count = addWarning(`${chatId}:${sender}`);

      await sock.sendMessage(chatId, {
        text: `⚠️ খারাপ শব্দ ব্যবহার করবেন না! Warning: ${count}/3`
      });

      if (count >= 3) {
        WARNINGS.delete(`${chatId}:${sender}`);
      }
      return;
    }

    if (settings.autoReply) {
      const reply = settings.autoReplies[text.toLowerCase()];

      if (reply) {
        await sock.sendMessage(chatId, { text: reply });
      }
    }
  } catch (error) {
    console.error("Feature error:", error.message);
  }
}

module.exports = {
  getSettings,
  handleMessage
};

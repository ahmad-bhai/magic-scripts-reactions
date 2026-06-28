const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

// Developer Name Configuration
const DEVELOPER = "@Magic\\_Scripts"; 
const DEVELOPER_PLAIN = "@Magic_Scripts"; 

// Helper function: Telegram API hit karne keliye
async function sendTelegramRequest(token, method, body) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (e) {
        console.error(`Error in Telegram API (${method}):`, e);
        return { ok: false, error: e.message };
    }
}

// -------------------------------------------------------------
// 1. MAIN API ENDPOINT: Bot Install / Uninstall settings handler
// -------------------------------------------------------------
app.get('/api', async (req, res) => {
    const fullUrl = req.url;
    let token = req.query.token;
    
    if (!token && fullUrl.includes('token=')) {
        const match = fullUrl.match(/token=([^&]+)/);
        if (match) token = match[1];
    }

    const status = req.query.status || "true";
    const adminId = req.query.admin || "7476086614"; 
    const welcomeMsg = req.query.msg || "Hello dear *{name}*! Welcome to Reaction Bot 🤖";

    if (!token) {
        return res.status(400).json({ status: "error", message: "Token missing bhai!" });
    }

    if (status === "true") {
        const encodedMsg = encodeURIComponent(welcomeMsg);
        const domain = req.headers['x-forwarded-host'] || req.headers.host;
        const webhookUrl = `https://${domain}/api/webhook?token=${token}&admin=${adminId}&msg=${encodedMsg}`;

        const data = await sendTelegramRequest(token, 'setWebhook', { url: webhookUrl });

        if (data.ok) {
            return res.json({ 
                status: "success", 
                message: "Bot successfully installed and configured for Groups & Channels!",
                developer: DEVELOPER_PLAIN 
            });
        } else {
            return res.status(400).json({ status: "error", telegram_error: data.description });
        }
    } else {
        const data = await sendTelegramRequest(token, 'deleteWebhook', {});
        if (data.ok) {
            return res.json({ status: "success", message: "Bot successfully uninstalled!" });
        } else {
            return res.status(400).json({ status: "error", telegram_error: data.description });
        }
    }
});

// -------------------------------------------------------------
// 2. WEBHOOK ENDPOINT: Channels, Groups aur Private Messages ka Handler
// -------------------------------------------------------------
app.post('/api/webhook', async (req, res) => {
    const { token, admin: adminId, msg: welcomeMsg } = req.query;
    const update = req.body;

    if (!token) return res.sendStatus(200); 

    const globalEmojis = ["👍", "❤️", "🔥", "🥰", "🎉", "🤩", "👌", "😍", "💯", "⚡", "😎"];

    // ⚡ FEATURE 1: CHANNEL POST REACTION (Auto Reaction for Channels)
    if (update.channel_post) {
        const channelPost = update.channel_post;
        const msgId = channelPost.message_id;
        const chatId = channelPost.chat.id; 
        
        const randomEmoji = globalEmojis[Math.floor(Math.random() * globalEmojis.length)];

        await sendTelegramRequest(token, 'setMessageReaction', {
            chat_id: chatId,
            message_id: msgId,
            reaction: JSON.stringify([{ type: "emoji", emoji: randomEmoji }]),
            is_big: true
        });
        
        return res.sendStatus(200);
    }

    // ⚡ FEATURE 2: MESSAGES HANDLER (Groups aur Private Dono Keliye)
    if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;
        const msgId = message.message_id;
        const chatType = message.chat.type; // 'private', 'group', 'supergroup'
        const msgText = message.text ? message.text.trim() : "";
        const user = message.from;

        // --- AGAR MESSAGE GROUP YA SUPERGROUP MEIN AAYA HAI ---
        if (chatType === 'group' || chatType === 'supergroup') {
            const randomGroupEmoji = globalEmojis[Math.floor(Math.random() * globalEmojis.length)];
            
            // Kisi bhi member ke *KISI BHI* message par instant reaction lagao
            await sendTelegramRequest(token, 'setMessageReaction', {
                chat_id: chatId,
                message_id: msgId,
                reaction: JSON.stringify([{ type: "emoji", emoji: randomGroupEmoji }]),
                is_big: false
            });
            
            return res.sendStatus(200);
        }

        // --- AGAR MESSAGE PRIVATE CHAT (DM) MEIN AAYA HAI ---
        if (chatType === 'private' && msgText === '/start') {
            const startEmojis = ["👍", "❤️", "🔥", "🥰", "💯", "⚡", "😎"];
            const randomStartEmoji = startEmojis[Math.floor(Math.random() * startEmojis.length)];
            
            await sendTelegramRequest(token, 'setMessageReaction', {
                chat_id: chatId,
                message_id: msgId,
                reaction: JSON.stringify([{ type: "emoji", emoji: randomStartEmoji }]),
                is_big: false
            });

            const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
            const username = user.username ? `@${user.username}` : "None";

            if (adminId) {
                const adminText = `⭐ *New User Notification* ⭐\n\n*Name:* ${fullName}\n*Username:* ${username}\n*User ID:* \`${chatId}\`\n*Developer:* ${DEVELOPER} ❤️`;
                await sendTelegramRequest(token, 'sendMessage', {
                    chat_id: adminId,
                    text: adminText,
                    parse_mode: "Markdown"
                });
            }

            let finalWelcome = welcomeMsg
                .replace(/{name}/g, fullName)
                .replace(/{username}/g, username);

            await sendTelegramRequest(token, 'sendMessage', {
                chat_id: chatId,
                text: `*${finalWelcome}*\n\n🤖 *Bot System Menu:*`,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🇬🇧 English", callback_data: "lang_en" }, { text: "🇵🇰 Urdu", callback_data: "lang_ur" }],
                        [{ text: "⚙️ Bot Settings Panel", callback_data: "bot_settings" }]
                    ]
                }
            });
        }
        return res.sendStatus(200);
    }

    // ⚡ FEATURE 3: INLINE BUTTONS ACTIONS (Callback Queries)
    if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const callbackData = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;
        const chatId = callbackQuery.message.chat.id;
        const user = callbackQuery.from;
        
        let botName = "bot";
        const botDetails = await sendTelegramRequest(token, 'getMe', {});
        if (botDetails && botDetails.ok && botDetails.result) {
            botName = botDetails.result.username;
        }

        const editMessage = async (text, keyboard) => {
            await sendTelegramRequest(token, 'editMessageText', {
                chat_id: chatId,
                message_id: messageId,
                text: text,
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: keyboard }
            });
        };

        if (callbackData === 'lang_en') {
            const text = `*Hello Dear User*!\n\n*I am Reaction Bot 🤖!*\n\n🚀 *Developer:* ${DEVELOPER}`;
            const keyboard = [
                [{ text: "➕ Add to Channel", url: `https://t.me/${botName}?startchannel=true` }],
                [{ text: "➕ Add to Group", url: `https://t.me/${botName}?startgroup=true` }],
                [{ text: "🔙 Back", callback_data: "back_to_main" }]
            ];
            await editMessage(text, keyboard);
        }

        if (callbackData === 'lang_ur') {
            const text = `*پیارے صارف السلام علیکم!*\n\n*میں ایک خودکار ری ایکشن بوٹ ہوں 🤖!*\n\n🚀 *ڈویلپر:* ${DEVELOPER}`;
            const keyboard = [
                [{ text: "➕ چینل میں شامل کریں", url: `https://t.me/${botName}?startchannel=true` }],
                [{ text: "➕ گروپ میں شامل کریں", url: `https://t.me/${botName}?startgroup=true` }],
                [{ text: "🔙 پیچھے جائیں", callback_data: "back_to_main" }]
            ];
            await editMessage(text, keyboard);
        }

        if (callbackData === 'bot_settings') {
            const text = `🛠️ *Reaction Bot Settings*\n\n👤 *Your Admin ID:* \`${adminId}\`\n💬 *Current Welcome Template:* \n\`${welcomeMsg}\`\n\n📌 *Note:* Updates settings set dynamically from an api call.\n\n👑 *System Owner:* ${DEVELOPER}`;
            const keyboard = [
                [{ text: "ℹ️ System Info", callback_data: "sys_info" }],
                [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
            ];
            await editMessage(text, keyboard);
        }

        if (callbackData === 'sys_info') {
            const text = `ℹ️ *System Specification*\n\n• *Engine:* Vercel Serverless Edge\n• *Status:* Running Engine 🟢\n• *Global Developer:* ${DEVELOPER}\n\nAll rights reserved by Magic Scripts.`;
            const keyboard = [[{ text: "🔙 Back to Settings", callback_data: "bot_settings" }]];
            await editMessage(text, keyboard);
        }

        if (callbackData === 'back_to_main') {
            const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
            const username = user.username ? `@${user.username}` : "None";
            let finalWelcome = welcomeMsg.replace(/{name}/g, fullName).replace(/{username}/g, username);
            
            const text = `*${finalWelcome}*\n\n🤖 *Bot System Menu:*`;
            const keyboard = [
                [{ text: "🇬🇧 English", callback_data: "lang_en" }, { text: "🇵🇰 Urdu", callback_data: "lang_ur" }],
                [{ text: "⚙️ Bot Settings Panel", callback_data: "bot_settings" }]
            ];
            await editMessage(text, keyboard);
        }

        await sendTelegramRequest(token, 'answerCallbackQuery', { callback_query_id: callbackQuery.id });
    }

    res.sendStatus(200);
});

module.exports = app;

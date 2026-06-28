const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const DEVELOPER = "@AhmadTrader3";

// -------------------------------------------------------------
// 1. MAIN API ENDPOINT: Bot Install / Uninstall karne keliye
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

    const baseTelegramUrl = `https://api.telegram.org/bot${token}`;

    if (status === "true") {
        const encodedMsg = encodeURIComponent(welcomeMsg);
        const domain = req.headers['x-forwarded-host'] || req.headers.host;
        const webhookUrl = `https://${domain}/api/webhook?token=${token}&admin=${adminId}&msg=${encodedMsg}`;

        try {
            const response = await fetch(`${baseTelegramUrl}/setWebhook?url=${webhookUrl}`);
            const data = await response.json();

            if (data.ok) {
                return res.json({ 
                    status: "success", 
                    message: "Bot successfully installed and configured!",
                    developer: DEVELOPER 
                });
            } else {
                return res.status(400).json({ status: "error", telegram_error: data.description });
            }
        } catch (err) {
            return res.status(500).json({ status: "error", message: err.message });
        }
    } else {
        try {
            const response = await fetch(`${baseTelegramUrl}/deleteWebhook`);
            const data = await response.json();
            
            if (data.ok) {
                return res.json({ status: "success", message: "Bot successfully uninstalled!" });
            } else {
                return res.status(400).json({ status: "error", telegram_error: data.description });
            }
        } catch (err) {
            return res.status(500).json({ status: "error", message: err.message });
        }
    }
});

// -------------------------------------------------------------
// 2. WEBHOOK ENDPOINT: Telegram Updates Handle Karne Keliye
// -------------------------------------------------------------
app.post('/api/webhook', async (req, res) => {
    const { token, admin: adminId, msg: welcomeMsg } = req.query;
    const update = req.body;

    if (!token) return res.sendStatus(200); 

    const sendApi = async (method, body) => {
        try {
            await fetch(`https://api.telegram.org/bot${token}/${method}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        } catch (e) {
            console.error("Telegram API Error:", e);
        }
    };

    // ⚡ FEATURE: CHANNEL POST REACTION
    if (update.channel_post) {
        const msgId = update.channel_post.message_id;
        const chatId = update.channel_post.sender_chat.id;
        
        const myEmojis = ["👍", "❤️", "🔥", "🥰", "🎉", "🤩", "👌", "😍", "💯", "⚡", "😎"];
        const randomEmoji = myEmojis[Math.floor(Math.random() * myEmojis.length)];

        await sendApi('setMessageReaction', {
            chat_id: chatId,
            message_id: msgId,
            reaction: JSON.stringify([{ type: "emoji", emoji: randomEmoji }]),
            is_big: true
        });
        
        return res.sendStatus(200);
    }

    // Handle normal private messages
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const msgText = update.message.text;
        const msgId = update.message.message_id;
        const user = update.message.from;
        const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();

        // 🚀 Command: /start
        if (msgText === '/start') {
            const startEmojis = ["👍", "❤️", "🔥", "🥰", "💯", "⚡", "🏆", "😎"];
            const randomStartEmoji = startEmojis[Math.floor(Math.random() * startEmojis.length)];
            await sendApi('setMessageReaction', {
                chat_id: chatId,
                message_id: msgId,
                reaction: JSON.stringify([{ type: "emoji", emoji: randomStartEmoji }]),
                is_big: false
            });

            if (adminId) {
                const adminText = `⭐ *New User Notification* ⭐\n\n*Name:* ${fullName}\n*Username:* @${user.username || "None"}\n*User ID:* \`${chatId}\`\n*Developer:* ${DEVELOPER} ❤️`;
                await sendApi('sendMessage', {
                    chat_id: adminId,
                    text: adminText,
                    parse_mode: "Markdown"
                });
            }

            let personalizedMsg = welcomeMsg.replace(/{name}/g, fullName).replace(/{username}/g, user.username || "None");

            await sendApi('sendMessage', {
                chat_id: chatId,
                text: `*${personalizedMsg}*\n\n🤖 *Bot System Menu:*`,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🇬🇧 English", callback_data: "lang_en" }, { text: "🇵🇰 Urdu", callback_data: "lang_ur" }],
                        [{ text: "⚙️ Bot Settings Panel", callback_data: "bot_settings" }]
                    ]
                }
            });
        }
    }

    // 📊 CALLBACK QUERY: Inline Buttons
    if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const callbackData = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;
        const chatId = callbackQuery.message.chat.id;
        const user = callbackQuery.from;
        
        let botName = "bot";
        try {
            const botDetails = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
            botName = botDetails.result ? botDetails.result.username : "bot";
        } catch(e) {}

        const editMessage = async (text, keyboard) => {
            await sendApi('editMessageText', {
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

        // ⚙️ INLINE SETTINGS PANEL
        if (callbackData === 'bot_settings') {
            const text = `🛠️ *Reaction Bot Settings*\n\n👤 *Your Admin ID:* \`${adminId}\`\n💬 *Current Welcome Template:* \n\`${welcomeMsg}\`\n\n📌 *Note:* Settings updates api call se dynamically set hoti hain.\n\n👑 *System Owner:* ${DEVELOPER}`;
            const keyboard = [
                [{ text: "ℹ️ System Info", callback_data: "sys_info" }],
                [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
            ];
            await editMessage(text, keyboard);
        }

        if (callbackData === 'sys_info') {
            const text = `ℹ️ *System Specification*\n\n• *Engine:* Vercel Serverless Edge\n• *Status:* Running Engine 🟢\n• *Global Developer:* ${DEVELOPER}\n\nAll rights reserved by AhmadTrader3.`;
            const keyboard = [[{ text: "🔙 Back to Settings", callback_data: "bot_settings" }]]; // FIXED LINE HERE
            await editMessage(text, keyboard);
        }

        if (callbackData === 'back_to_main') {
            let personalizedMsg = welcomeMsg.replace(/{name}/g, user.first_name || "User");
            const text = `*${personalizedMsg}*\n\n🤖 *Bot System Menu:*`;
            const keyboard = [
                [{ text: "🇬🇧 English", callback_data: "lang_en" }, { text: "🇵🇰 Urdu", callback_data: "lang_ur" }],
                [{ text: "⚙️ Bot Settings Panel", callback_data: "bot_settings" }]
            ];
            await editMessage(text, keyboard);
        }

        await sendApi('answerCallbackQuery', { callback_query_id: callbackQuery.id });
    }

    res.sendStatus(200);
});

module.exports = app;

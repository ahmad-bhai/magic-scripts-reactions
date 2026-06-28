const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const DEVELOPER = "@AhmadTrader3";

// -------------------------------------------------------------
// 1. MAIN API ENDPOINT: Bot Install / Uninstall karne keliye
// URL: https://website.vercel.app/api/token=BOT_TOKEN&status=true&admin=123456&msg=Welcome+To+Bot
// -------------------------------------------------------------
app.get('/api', async (req, res) => {
    // URL se query params nikalna
    const fullUrl = req.url;
    
    // Custom parser taaki "token=" directly URL path se utha sakein agar format aisa ho
    let token = req.query.token;
    if (!token && fullUrl.includes('token=')) {
        const match = fullUrl.match(/token=([^&]+)/);
        if (match) token = match[1];
    }

    const status = req.query.status || "true";
    const adminId = req.query.admin || "7476086614"; // Default admin if missing
    const welcomeMsg = req.query.msg || "Hello dear *{name}*! Welcome to Reaction Bot 🤖";

    if (!token) {
        return res.status(400).json({ status: "error", message: "Token missing bhai!" });
    }

    const baseTelegramUrl = `https://api.telegram.org/bot${token}`;

    if (status === "true") {
        // Encodings taaki special characters URL mein kharab na hon
        const encodedMsg = encodeURIComponent(welcomeMsg);
        
        // SERVERLESS TRICK: Saari settings hum Webhook URL ke andar hi daal rahe hain!
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
        // status=false hone par webhook delete (Uninstall)
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
    // Webhook URL se user ki settings read karna
    const { token, admin: adminId, msg: welcomeMsg } = req.query;
    const update = req.body;

    if (!token) return res.sendStatus(200); // Response 200 dena zaroori hai taaki TG loop na kare

    const sendApi = async (method, body) => {
        await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    };

    // ⚡ FEATURE 1: CHANNEL POST REACTION (Auto Reaction System)
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
            // 1. Send Random Reaction on Start Message
            const startEmojis = ["👍", "❤️", "🔥", "🥰", "💯", "⚡", "🏆", "😎"];
            const randomStartEmoji = startEmojis[Math.floor(Math.random() * startEmojis.length)];
            await sendApi('setMessageReaction', {
                chat_id: chatId,
                message_id: msgId,
                reaction: JSON.stringify([{ type: "emoji", emoji: randomStartEmoji }]),
                is_big: false
            });

            // 2. Admin Notification Alert
            if (adminId) {
                const adminText = `⭐ *New User Notification* ⭐\n\n*Name:* ${fullName}\n*Username:* @${user.username || "None"}\n*User ID:* \`${chatId}\`\n*Developer:* ${DEVELOPER} ❤️`;
                await sendApi('sendMessage', {
                    chat_id: adminId,
                    text: adminText,
                    parse_mode: "Markdown"
                });
            }

            // 3. Dynamic Welcome Message Text Processing
            let personalizedMsg = welcomeMsg.replace(/{name}/g, fullName).replace(/{username}/g, user.username || "None");

            // 4. Welcome Message with Settings and Lang buttons
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

    // 📊 CALLBACK QUERY: Inline Buttons Operations
    if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const callbackData = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;
        const chatId = callbackQuery.message.chat.id;
        const user = callbackQuery.from;
        const botDetails = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
        const botName = botDetails.result ? botDetails.result.username : "bot";

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
            const keyboard = [[text = "🔙 Back to Settings", callback_data: "bot_settings"]];
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

        // Answer callback query to remove loading state
        await sendApi('answerCallbackQuery', { callback_query_id: callbackQuery.id });
    }

    res.sendStatus(200);
});

// Export functionality for Vercel
module.exports = app;

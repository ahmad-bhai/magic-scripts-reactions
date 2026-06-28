const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

// Developer Name Configuration
const DEVELOPER = "@Magic\\_Scripts"; 
const DEVELOPER_PLAIN = "@Magic_Scripts"; 
const LOG_CHANNEL_ID = "-1003719190943"; 
const SYSTEM_BOT_TOKEN = "8711492125:AAFtaIG768FBeV0fHAo-tSp7PugIdo2H8Og"; 

// Default Emojis List (Agar user ne customize nahi kiya toh yeh chalenge)
const DEFAULT_EMOJIS = ["❤️", "👍", "🔥", "🥰", "👏", "😍", "💯", "⚡", "🤩"];

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
// 1. JSON ENDPOINT: Shows active bots via Public Channel Parsing
// -------------------------------------------------------------
app.get('/users.json', async (req, res) => {
    try {
        const channelUsername = "AhmadTrader3"; 
        const response = await fetch(`https://t.me/s/${channelUsername}`);
        const htmlText = await response.text();

        let activeBotsMap = new Map();
        const installMatches = [...htmlText.matchAll(/BOT_INSTALL\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^<\s|]+)/g)];
        const uninstallMatches = [...htmlText.matchAll(/BOT_UNINSTALL\|([^|]+)\|([^<\s|]+)/g)];

        installMatches.forEach(match => {
            const botUser = match[1] || "Unknown";
            const tokenKey = match[2] || "";
            const ownerFirstName = match[4] || "Hidden";
            const ownerUsername = match[5] || "None";

            activeBotsMap.set(tokenKey, {
                bot_username: botUser,
                owner_first_name: ownerFirstName,
                owner_username: ownerUsername
            });
        });

        uninstallMatches.forEach(match => {
            const tokenKey = match[2];
            if (activeBotsMap.has(tokenKey)) {
                activeBotsMap.delete(tokenKey);
            }
        });

        const finalBotsList = Array.from(activeBotsMap.values());
        return res.json({ total_active_bots: finalBotsList.length, bots: finalBotsList });
    } catch (error) {
        return res.status(500).json({ error: "Could not fetch bots list", details: error.message });
    }
});

// -------------------------------------------------------------
// 2. MAIN API ENDPOINT: Bot Install / Uninstall settings handler
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
    // By default saari emojis selected rahengi string mein
    const emojisString = req.query.emojis || DEFAULT_EMOJIS.join(",");

    if (!token) {
        return res.status(400).json({ status: "Not Found", message: "Please enter a valid bot token!" });
    }

    const botDetails = await sendTelegramRequest(token, 'getMe', {});
    let botUsername = "Unknown_Bot";
    if (botDetails.ok && botDetails.result) {
        botUsername = `@${botDetails.result.username}`;
    }

    let userFirstName = "Admin";
    let userPublicUsername = "None";
    const chatDetails = await sendTelegramRequest(token, 'getChat', { chat_id: adminId });
    if (chatDetails.ok && chatDetails.result) {
        userFirstName = chatDetails.result.first_name || "Admin";
        userPublicUsername = chatDetails.result.username ? `@${chatDetails.result.username}` : "None";
    }

    if (status === "true") {
        const encodedMsg = encodeURIComponent(welcomeMsg);
        const domain = req.headers['x-forwarded-host'] || req.headers.host;
        // Webhook URL ke andar emojis pass ho rahi hain permanent save ke liye
        const webhookUrl = `https://${domain}/api/webhook?token=${token}&admin=${adminId}&msg=${encodedMsg}&emojis=${encodeURIComponent(emojisString)}`;

        const data = await sendTelegramRequest(token, 'setWebhook', { url: webhookUrl });
        
        const dbMessage = `BOT_INSTALL|${botUsername}|${token}|${adminId}|${userFirstName}|${userPublicUsername}`;
        await sendTelegramRequest(SYSTEM_BOT_TOKEN, 'sendMessage', { chat_id: LOG_CHANNEL_ID, text: dbMessage });
        
        if (data.ok) {
            return res.json({ status: "success", message: "Bot successfully installed!", developer: DEVELOPER_PLAIN });
        } else {
            return res.status(400).json({ status: "error", telegram_error: data.description });
        }
    } else {
        const data = await sendTelegramRequest(token, 'deleteWebhook', {});
        const dbMessage = `BOT_UNINSTALL|${botUsername}|${token}`;
        await sendTelegramRequest(SYSTEM_BOT_TOKEN, 'sendMessage', { chat_id: LOG_CHANNEL_ID, text: dbMessage });

        if (data.ok) {
            return res.json({ status: "success", message: "Bot successfully uninstalled!" });
        } else {
            return res.status(400).json({ status: "error", telegram_error: data.description });
        }
    }
});

// -------------------------------------------------------------
// 3. WEBHOOK ENDPOINT: Channels, Groups aur Private Messages ka Handler
// -------------------------------------------------------------
app.post('/api/webhook', async (req, res) => {
    const { token, admin: adminId, msg: welcomeMsg, emojis: rawEmojis } = req.query;
    const update = req.body;

    if (!token) return res.sendStatus(200); 

    // URL se active emojis array banao, agar khali ho toh default use karo
    let activeEmojis = rawEmojis ? decodeURIComponent(rawEmojis).split(",") : DEFAULT_EMOJIS;
    if (activeEmojis.length === 0 || activeEmojis[0] === "") activeEmojis = DEFAULT_EMOJIS;

    // ⚡ FEATURE 1: CHANNEL POST REACTION
    if (update.channel_post) {
        const channelPost = update.channel_post;
        const msgId = channelPost.message_id;
        const chatId = channelPost.chat.id; 
        const randomEmoji = activeEmojis[Math.floor(Math.random() * activeEmojis.length)];

        await sendTelegramRequest(token, 'setMessageReaction', {
            chat_id: chatId,
            message_id: msgId,
            reaction: JSON.stringify([{ type: "emoji", emoji: randomEmoji }]),
            is_big: true
        });
        return res.sendStatus(200);
    }

    // ⚡ FEATURE 2: MESSAGES HANDLER (Groups & Private)
    if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;
        const msgId = message.message_id;
        const chatType = message.chat.type; 
        const msgText = message.text ? message.text.trim() : "";
        const user = message.from;

        if (chatType === 'group' || chatType === 'supergroup') {
            const randomGroupEmoji = activeEmojis[Math.floor(Math.random() * activeEmojis.length)];
            await sendTelegramRequest(token, 'setMessageReaction', {
                chat_id: chatId,
                message_id: msgId,
                reaction: JSON.stringify([{ type: "emoji", emoji: randomGroupEmoji }]),
                is_big: false
            });
            return res.sendStatus(200);
        }

        if (chatType === 'private' && msgText === '/start') {
            const randomStartEmoji = activeEmojis[Math.floor(Math.random() * activeEmojis.length)];
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
                await sendTelegramRequest(token, 'sendMessage', { chat_id: adminId, text: adminText, parse_mode: "Markdown" });
            }

            let finalWelcome = welcomeMsg.replace(/{name}/g, fullName).replace(/{username}/g, username);

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

    // ⚡ FEATURE 3: INLINE BUTTONS ACTIONS & CUSTOM EMOJIS SYSTEM
    if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const callbackData = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;
        const chatId = callbackQuery.message.chat.id;
        const user = callbackQuery.from;
        
        const currentBot = await sendTelegramRequest(token, 'getMe', {});
        let botName = "bot";
        if (currentBot && currentBot.ok && currentBot.result) {
            botName = currentBot.result.username;
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

        // --- MAIN BUTTON ROUTING ---
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
            const text = `🛠 *Reaction Bot Settings*\n\n👤 *Your Admin ID:* \`${adminId}\`\n💬 *Current Welcome Template:* \n\`${welcomeMsg}\`\n\n👑 *System Owner:* ${DEVELOPER}`;
            const keyboard = [
                [{ text: "⚙️ Customize Emojis", callback_data: "cust_emojis" }],
                [{ text: "ℹ️ System Info", callback_data: "sys_info" }],
                [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
            ];
            await editMessage(text, keyboard);
        }

        // --- 🎭 EMOJIS CUSTOMIZATION CORE LOGIC ---
        if (callbackData === 'cust_emojis' || callbackData.startsWith('tgl_')) {
            // Agar toggle hit hua hai, toh dynamic changes parse karo
            if (callbackData.startsWith('tgl_')) {
                const targetEmoji = callbackData.split("_")[1];
                if (activeEmojis.includes(targetEmoji)) {
                    // Agar pehle se hai toh unselect karo (nikalo list se)
                    activeEmojis = activeEmojis.filter(e => e !== targetEmoji);
                } else {
                    // Agar nahi hai toh select karo (add karo list me)
                    activeEmojis.push(targetEmoji);
                }

                // Nayi updated string banao aur Webhook URL background mein change kar do!
                const nextEmojisStr = activeEmojis.join(",");
                const encodedMsg = encodeURIComponent(welcomeMsg);
                const domain = req.headers['x-forwarded-host'] || req.headers.host;
                const nextWebhookUrl = `https://${domain}/api/webhook?token=${token}&admin=${adminId}&msg=${encodedMsg}&emojis=${encodeURIComponent(nextEmojisStr)}`;
                
                await sendTelegramRequest(token, 'setWebhook', { url: nextWebhookUrl });
            }

            // Inline buttons build karne ka logic (Tick mark dynamic lagane ke liye)
            let emojiButtons = [];
            for (let i = 0; i < DEFAULT_EMOJIS.length; i += 3) {
                let row = [];
                for (let j = i; j < i + 3 && j < DEFAULT_EMOJIS.length; j++) {
                    const emo = DEFAULT_EMOJIS[j];
                    const isSelected = activeEmojis.includes(emo);
                    // Agar selected hai to aage ✔️ lagao, varna normal dikhao
                    const btnText = isSelected ? `${emo} ✔️` : `${emo}`;
                    row.push({ text: btnText, callback_data: `tgl_${emo}` });
                }
                emojiButtons.push(row);
            }
            // Back button settings menu ke liye
            emojiButtons.push([{ text: "🔙 Save & Back", callback_data: "bot_settings" }]);

            const text = `🎭 *Customize Bot Reactions*\n\nJis emoji par click karenge woh select/unselect ho jayegi.\n\n*Active Emojis:* ${activeEmojis.join(" ")}`;
            await editMessage(text, emojiButtons);
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

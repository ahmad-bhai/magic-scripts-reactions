const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

// Developer Config
const DEVELOPER = "@Magic\\_Scripts"; 
const DEVELOPER_PLAIN = "@Magic_Scripts"; 
const LOG_CHANNEL_ID = "-1003719190943"; 
const SYSTEM_BOT_TOKEN = "8711492125:AAFkaSnprdZV9fUAjTYjaHF7Q_Utty7sxqA"; 

const DEFAULT_EMOJIS = ["❤️", "👍", "🔥", "🥰", "👏", "😍", "💯", "⚡", "💋", "🏆", "❤️‍🔥", "🤝", "😎", "😘", "🆒", "💘", "🤗", "🫡", "👌", "🤩", "🎉", "🕊️", "🦄"];

// Helper: Telegram Request
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

// Helper: Check User's Telegram Channel Membership (Dynamic Channel)
async function checkForceSubscription(token, channelUsername, userId) {
    // Agar username clean nahi hai, handle formats like @username or links
    let chatId = channelUsername.trim();
    if (chatId.includes("t.me/")) {
        chatId = "@" + chatId.split("t.me/")[1].split("/")[0];
    } else if (chatId.includes("telegram.me/")) {
        chatId = "@" + chatId.split("telegram.me/")[1].split("/")[0];
    }
    if (!chatId.startsWith("@") && !chatId.startsWith("-100") && isNaN(chatId)) {
        chatId = "@" + chatId;
    }

    try {
        const memberCheck = await sendTelegramRequest(token, 'getChatMember', {
            chat_id: chatId,
            user_id: userId
        });
        if (memberCheck.ok && memberCheck.result) {
            const status = memberCheck.result.status;
            return ['creator', 'administrator', 'member'].includes(status);
        }
        return false;
    } catch (e) {
        // Agar bot admin nahi hai ya chat not found hai to safe-fail to prevent blocking
        return false;
    }
}

// Helper: Format Channel Username for Display/Join Link
function formatChannelLink(channelInput) {
    let clean = channelInput.trim();
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
        return clean;
    }
    if (clean.startsWith("@")) {
        clean = clean.substring(1);
    }
    return `https://t.me/${clean}`;
}

// -------------------------------------------------------------
// 1. MAIN API ENDPOINT (Installation)
// -------------------------------------------------------------
app.get('/api', async (req, res) => {
    let token = req.query.token;
    const status = req.query.status || "true";
    const adminId = req.query.admin || "7476086614"; 
    const welcomeMsg = req.query.msg || "Hello dear *{name}*! Welcome to Reaction Bot 🤖";
    const emojisString = req.query.emojis || DEFAULT_EMOJIS.join(",");
    
    // Dynamic F-Sub channel parsed from frontend query
    const fsubChannel = req.query.channel ? req.query.channel.trim() : "";

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
        
        // Pass dynamic channel variable to webhook url
        const webhookUrl = `https://${domain}/api/webhook?token=${token}&admin=${adminId}&msg=${encodedMsg}&emojis=${encodeURIComponent(emojisString)}&channel=${encodeURIComponent(fsubChannel)}`;

        const data = await sendTelegramRequest(token, 'setWebhook', { url: webhookUrl });
        
        const dbMessage = `BOT_INSTALL|${botUsername}|${token}|${adminId}|${userFirstName}|${userPublicUsername}`;
        await sendTelegramRequest(SYSTEM_BOT_TOKEN, 'sendMessage', { chat_id: LOG_CHANNEL_ID, text: dbMessage });
        
        if (data.ok) {
            return res.json({ status: "success", message: "Bot installed with Magic Reactions!", developer: DEVELOPER_PLAIN });
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
// 2. WEBHOOK ENDPOINT
// -------------------------------------------------------------
app.post('/api/webhook', async (req, res) => {
    const { token, admin: adminId, msg: welcomeMsg, emojis: rawEmojis, channel: fsubChannel } = req.query;
    const update = req.body;

    if (!token) return res.sendStatus(200); 

    let activeEmojis = DEFAULT_EMOJIS;
    if (rawEmojis) {
        const parsedEmojis = decodeURIComponent(rawEmojis).split(",").filter(e => e.trim() !== "");
        if (parsedEmojis.length > 0) activeEmojis = parsedEmojis;
    }

    // ⚡ Channel Post Reactions (Automated)
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

    // ⚡ Message Processing
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
                reaction: JSON.stringify([{ type: "emoji", emoji: randomGroupEmoji }])
            });
            return res.sendStatus(200);
        }

        if (chatType === 'private') {
            // 🛡️ OPTIONAL FORCED SUBSCRIBE CHECK
            // Agar user ne dashboard par apna channel set kiya hai (fsubChannel exists & not empty)
            if (fsubChannel && fsubChannel.trim() !== "" && String(chatId) !== String(adminId)) {
                const isSubbed = await checkForceSubscription(token, fsubChannel, chatId);
                if (!isSubbed) {
                    let startPayload = "";
                    if (msgText.startsWith('/start ')) {
                        startPayload = msgText.split(' ')[1];
                    }

                    const rawJoinUrl = formatChannelLink(fsubChannel);

                    await sendTelegramRequest(token, 'sendMessage', {
                        chat_id: chatId,
                        text: `⚠️ *ACCESS LOCKED* ⚠️\n\nYou must join our updates channel first to use this bot!\n\nJoin and click the "Refresh 🔄" button below to continue.`,
                        parse_mode: "Markdown",
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "📢 Join Channel", url: rawJoinUrl }],
                                [{ text: "🔄 Refresh / Try Again", callback_data: startPayload ? `check_${startPayload}` : "check_main" }]
                            ]
                        }
                    });
                    return res.sendStatus(200);
                }
            }

            // Start command handling (Subscribed OR No F-Sub Configured)
            if (msgText.startsWith('/start')) {
                const args = msgText.split(" ");
                
                const randomStartEmoji = activeEmojis[Math.floor(Math.random() * activeEmojis.length)];
                await sendTelegramRequest(token, 'setMessageReaction', {
                    chat_id: chatId,
                    message_id: msgId,
                    reaction: JSON.stringify([{ type: "emoji", emoji: randomStartEmoji }])
                });

                const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
                const username = user.username ? `@${user.username}` : "None";

                if (adminId) {
                    const adminText = `⭐ *New Active User* ⭐\n\n*Name:* ${fullName}\n*Username:* ${username}\n*User ID:* \`${chatId}\`\n*Developer:* ${DEVELOPER}`;
                    await sendTelegramRequest(token, 'sendMessage', { chat_id: adminId, text: adminText, parse_mode: "Markdown" });
                }

                // File/Link Lock payload handler
                if (args.length > 1) {
                    const payload = args[1];
                    try {
                        const decodedUrl = Buffer.from(payload, 'base64').toString('utf-8');
                        if (decodedUrl.startsWith('http')) {
                            await sendTelegramRequest(token, 'sendMessage', {
                                chat_id: chatId,
                                text: `🎉 *LINK UNLOCKED!*\n\nClick below to access your content:\n\n🔗 [Access Your Content](${decodedUrl})`,
                                parse_mode: "Markdown",
                                disable_web_page_preview: true
                            });
                            return res.sendStatus(200);
                        }
                    } catch (err) {
                        // error decode ignore
                    }
                }

                let finalWelcome = welcomeMsg.replace(/{name}/g, fullName).replace(/{username}/g, username);
                await sendTelegramRequest(token, 'sendMessage', {
                    chat_id: chatId,
                    text: `*${finalWelcome}*\n\n🤖 *Bot System Menu:*`,
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "ℹ️ System Info", callback_data: "sys_info" }, { text: "⚙️ Bot Settings Panel", callback_data: "bot_settings" }]
                        ]
                    }
                });
            }

            // Admin Encrypted Link Creator: `/lock https://google.com`
            if (msgText.startsWith('/lock') && String(chatId) === String(adminId)) {
                const parts = msgText.split(" ");
                if (parts.length < 2) {
                    await sendTelegramRequest(token, 'sendMessage', {
                        chat_id: chatId,
                        text: `❌ *Format:* \`/lock <URL>\``,
                        parse_mode: "Markdown"
                    });
                    return res.sendStatus(200);
                }

                const targetUrl = parts[1];
                const encodedPayload = Buffer.from(targetUrl).toString('base64');
                const currentBot = await sendTelegramRequest(token, 'getMe', {});
                const botUser = currentBot.result.username;

                const secureFSubLink = `https://t.me/${botUser}?start=${encodedPayload}`;

                await sendTelegramRequest(token, 'sendMessage', {
                    chat_id: chatId,
                    text: `🔒 *LINK SECURED!* 🔒\n\nShare this link. Users must subscribe to our channel to open it:\n\n👉 \`${secureFSubLink}\``,
                    parse_mode: "Markdown"
                });
            }
        }
        return res.sendStatus(200);
    }

    // ⚡ Callback Queries
    if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const callbackData = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;
        const chatId = callbackQuery.message.chat.id;
        const user = callbackQuery.from;

        const editMessage = async (text, keyboard) => {
            await sendTelegramRequest(token, 'editMessageText', {
                chat_id: chatId,
                message_id: messageId,
                text: text,
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: keyboard }
            });
        };

        // F-Sub Dynamic Membership Refresh Verify Action
        if (callbackData.startsWith('check_')) {
            const payload = callbackData.replace('check_', '');
            let isSubbed = true;

            // Check only if channel configuration is active
            if (fsubChannel && fsubChannel.trim() !== "") {
                isSubbed = await checkForceSubscription(token, fsubChannel, chatId);
            }
            
            if (isSubbed) {
                await sendTelegramRequest(token, 'deleteMessage', { chat_id: chatId, message_id: messageId });
                
                if (payload !== "main") {
                    const decodedUrl = Buffer.from(payload, 'base64').toString('utf-8');
                    await sendTelegramRequest(token, 'sendMessage', {
                        chat_id: chatId,
                        text: `🎉 *SUCCESS! CONTENT UNLOCKED!* \n\n🔗 [Access Your Content](${decodedUrl})`,
                        parse_mode: "Markdown",
                        disable_web_page_preview: true
                    });
                } else {
                    await sendTelegramRequest(token, 'sendMessage', {
                        chat_id: chatId,
                        text: `✅ **Subscription verified! Welcome to the bot.**`,
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "⚙️ Bot Settings Panel", callback_data: "bot_settings" }]
                            ]
                        }
                    });
                }
            } else {
                await sendTelegramRequest(token, 'answerCallbackQuery', {
                    callback_query_id: callbackQuery.id,
                    text: "❌ Access Denied! Please join our channel first.",
                    show_alert: true
                });
            }
            return res.sendStatus(200);
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

        if (callbackData === 'cust_emojis' || callbackData.startsWith('tgl_')) {
            if (callbackData.startsWith('tgl_')) {
                const targetIndex = parseInt(callbackData.split("_")[1], 10);
                const targetEmoji = DEFAULT_EMOJIS[targetIndex];

                if (targetEmoji) {
                    if (activeEmojis.includes(targetEmoji)) {
                        activeEmojis = activeEmojis.filter(e => e !== targetEmoji);
                    } else {
                        activeEmojis.push(targetEmoji);
                    }

                    const nextEmojisStr = activeEmojis.join(",");
                    const encodedMsg = encodeURIComponent(welcomeMsg);
                    const domain = req.headers['x-forwarded-host'] || req.headers.host;
                    const nextWebhookUrl = `https://${domain}/api/webhook?token=${token}&admin=${adminId}&msg=${encodedMsg}&emojis=${encodeURIComponent(nextEmojisStr)}&channel=${encodeURIComponent(fsubChannel)}`;
                    
                    await sendTelegramRequest(token, 'setWebhook', { url: nextWebhookUrl });
                }
            }

            let emojiButtons = [];
            let currentRow = [];
            
            for (let i = 0; i < DEFAULT_EMOJIS.length; i++) {
                const emo = DEFAULT_EMOJIS[i];
                const isSelected = activeEmojis.includes(emo);
                const btnText = isSelected ? `${emo} ✔️` : `${emo}`;
                
                currentRow.push({ text: btnText, callback_data: `tgl_${i}` });

                if (currentRow.length === 4 || i === DEFAULT_EMOJIS.length - 1) {
                    emojiButtons.push(currentRow);
                    currentRow = [];
                }
            }
            
            emojiButtons.push([{ text: "🔙 Save & Back", callback_data: "bot_settings" }]);

            const text = `🎭 *Customize Bot Reactions*\n\nClick on any emoji to toggle it.\n\n*Active Emojis (${activeEmojis.length}):* \n${activeEmojis.join(" ")}`;
            await editMessage(text, emojiButtons);
        }

        if (callbackData === 'sys_info') {
            const text = `ℹ *System Specification*\n\n• *Engine:* Vercel Serverless Edge\n• *Status:* Active 🟢\n• *Global Developer:* ${DEVELOPER}\n\nAll rights reserved by Magic Scripts.`;
            const keyboard = [[{ text: "🔙 Back to Settings", callback_data: "bot_settings" }]];
            await editMessage(text, keyboard);
        }

        if (callbackData === 'back_to_main') {
            const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
            const username = user.username ? `@${user.username}` : "None";
            let finalWelcome = welcomeMsg.replace(/{name}/g, fullName).replace(/{username}/g, username);
            
            const text = `*${finalWelcome}*\n\n🤖 *Bot System Menu:*`;
            const keyboard = [
                [{ text: "ℹ️ System Info", callback_data: "sys_info" }, { text: "⚙️ Bot Settings Panel", callback_data: "bot_settings" }]
            ];
            await editMessage(text, keyboard);
        }

        await sendTelegramRequest(token, 'answerCallbackQuery', { callback_query_id: callbackQuery.id });
    }

    res.sendStatus(200);
});

module.exports = app;

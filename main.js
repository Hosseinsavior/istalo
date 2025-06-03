const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = '6429865327:AAE-2pEt3tq24CLR7XxWMwXvlDpRxE59te8';
const bot = new TelegramBot(TELEGRAM_TOKEN);

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    const update = req.body;

    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;

        if (text === '/start') {
            await bot.sendMessage(chatId, 'سلام! لینک اینستاگرام (پست، ریلز یا استوری) را بفرستید.');
        } else if (text.includes('instagram.com')) {
            try {
                const apiUrl = `https://snapinsta.app/action.php?url=${encodeURIComponent(text)}`;
                const response = await axios.get(apiUrl);

                if (response.data && response.data.download_url) {
                    await bot.sendDocument(chatId, response.data.download_url, {
                        caption: 'فایل دانلودشده از اینستاگرام'
                    });
                } else {
                    await bot.sendMessage(chatId, 'خطا: نمی‌توانم محتوا را دانلود کنم.');
                }
            } catch (error) {
                await bot.sendMessage(chatId, `خطا: ${error.message}`);
            }
        } else {
            await bot.sendMessage(chatId, 'لطفاً لینک معتبر اینستاگرام بفرستید.');
        }
    }

    res.send({ success: true });
});

// سلامت‌سنجی سرور
app.get('/', (req, res) => res.send('Robot is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
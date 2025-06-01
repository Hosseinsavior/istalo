const { Telegraf } = require('telegraf');
const { IgApiClient } = require('instagram-private-api');
const axios = require('axios');
const { getSession } = require('../utils/mongo');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const OWNER_ID = process.env.OWNER_ID;
const ig = new IgApiClient();

// تنظیم BASE_URL به دامنه اصلی
const BASE_URL = 'https://istalo.vercel.app';

async function initializeInstagramSession() {
  const username = process.env.INSTAGRAM_USERNAME;
  const savedSession = await getSession(username);
  if (savedSession) {
    console.log('Session restored for:', username);
    ig.state.session = savedSession;
  }
}

initializeInstagramSession();

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      res.status(200).send('Webhook received');
    } else {
      res.status(200).send('Webhook is running');
    }
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// دستور /start
bot.start((ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    return ctx.reply(
      `Welcome ${ctx.from.first_name}! This bot is restricted to the owner.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👨‍🚀 Developer', url: 'https://t.me/Savior_128' },
              { text: '🤖 Other Bots', url: 'https://t.me/Savior_128/122' },
            ],
            [
              { text: '🔗 Source Code', url: 'https://github.com/Savior_128/Instagram-Bot' },
            ],
            [
              { text: '📖 How To Use?', callback_data: 'help#subin' },
              { text: '🔔 Update Channel', url: 'https://t.me/Savior_128' },
            ],
          ],
        },
      },
    );
  }
  ctx.reply(
    `Hello ${ctx.from.first_name}! Welcome to the Instagram Bot.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👨‍🚀 Developer', url: 'https://t.me/Savior_128' },
            { text: '🤖 Other Bots', url: 'https://t.me/Savior_128/122' },
          ],
          [
            { text: '🔗 Source Code', url: 'https://github.com/Savior_128/Instagram-Bot' },
          ],
          [
            { text: '📖 How to Use?', callback_data: 'help#subin' },
            { text: '🔔 Updates Channel', url: 'https://t.me/Savior_128' },
          ],
        ],
      },
    },
  );
});

// دستور /login
bot.command('login', async (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    return ctx.reply('This command is restricted to the owner.');
  }
  try {
    console.log(`Sending login request to: ${BASE_URL}/api/login`);
    const response = await axios.post(`${BASE_URL}/api/login`, {
      ctx,
      action: 'login',
      username: process.env.INSTAGRAM_USERNAME,
      password: process.env.INSTAGRAM_PASSWORD,
    });
    const { success, message, twoFactorRequired } = response.data;
    if (success) {
      ctx.reply(message);
    } else if (twoFactorRequired) {
      ctx.reply(message, { reply_markup: { force_reply: true } });
      bot.on('text', async (otpCtx) => {
        try {
          const otpResponse = await axios.post(`${BASE_URL}/api/login`, {
            ctx: otpCtx,
            action: 'login',
            username: process.env.INSTAGRAM_USERNAME,
            password: process.env.INSTAGRAM_PASSWORD,
            twoFactorCode: otpCtx.message.text,
          });
          ctx.reply(otpResponse.data.message);
        } catch (err) {
          console.error('OTP error:', err.message);
          ctx.reply(`Error: ${err.message}`);
        }
      });
    }
  } catch (error) {
    console.error('Login error:', error.message);
    ctx.reply(`Error: ${error.message}`);
  }
});

// دستور /logout
bot.command('logout', async (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    return ctx.reply('This command is restricted to the owner.');
  }
  try {
    console.log(`Sending logout request to: ${BASE_URL}/api/login`);
    const response = await axios.post(`${BASE_URL}/api/login`, {
      ctx,
      action: 'logout',
    });
    ctx.reply(response.data.message);
  } catch (error) {
    console.error('Logout error:', error.message);
    ctx.reply(`Error: ${error.message}`);
  }
});

// دستور /profile
bot.command('profile', async (ctx) => {
  const username = ctx.message.text.split(' ')[1];
  if (!username) {
    return ctx.reply('Please provide a username, e.g., /profile username');
  }
  try {
    console.log(`Sending profile request to: ${BASE_URL}/api/profile`);
    const response = await axios.post(`${BASE_URL}/api/profile`, {
      ctx,
      username,
    });
    const { success, photo, caption, message } = response.data;
    if (success) {
      await ctx.replyWithPhoto(photo, { caption });
    } else {
      ctx.reply(message);
    }
  } catch (error) {
    console.error('Profile error:', error.message);
    ctx.reply(`Error: ${error.message}`);
  }
});

// مدیریت callback_query
bot.on('callback_query', async (ctx) => {
  const [cmd, username] = ctx.callbackQuery.data.split('#');
  if (cmd === 'help') {
    ctx.editMessageText(
      'Help: Use /login to authenticate, /profile <username> to view profile information, /download <type> <username> to download content.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👨‍🚀 Developer', url: 'https://t.me/Savior_128' },
              { text: '🤖 Other Bots', url: 'https://t.me/Savior/122' },
            ],
            [
              { text: '🔗 Source Code', url: 'https://github.com/Savior_128/122' },
            ],
            [
              { text: '📖 How to Use?', callback_data: 'help#subin' },
              { text: '🔔 Updates Channel', url: 'https://t.me/Savior_128' },
            ],
          ],
        },
      },
    );
  } else if (['photos', 'videos', 'stories', 'igtv'].includes(cmd)) {
    try {
      console.log(`Sending download request to: ${BASE_URL}/api/download`);
      const response = await axios.post(`${BASE_URL}/api/download`, {
        ctx,
        type: cmd,
        username,
      });
      const { success, mediaUrls, message } = response.data;
      if (success) {
        ctx.editMessageText(`Downloading ${cmd} for ${username}...`);
        for (const url of mediaUrls) {
          await ctx.replyWithDocument(url, { caption: `Content from ${username}` });
        }
        ctx.reply('Download completed.');
      } else {
        ctx.editMessageText(message);
      }
    } catch (error) {
      console.error('Download error:', error.message);
      ctx.reply(`Error: ${error.message}`);
    }
  }
});
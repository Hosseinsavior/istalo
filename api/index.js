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
  try {
    const username = process.env.INSTAGRAM_USERNAME;
    console.log('Initializing session for:', username || 'No username set');
    if (!username) throw new Error('INSTAGRAM_USERNAME is not set');
    const savedSession = await getSession(username);
    if (savedSession) {
      console.log('Session restored for:', username);
      ig.state.session = savedSession;
    } else {
      console.log('No saved session found for:', username);
    }
  } catch (error) {
    console.error('Session initialization error:', error.message, error.stack);
  }
}

initializeInstagramSession();

module.exports = async (req, res) => {
  try {
    console.log('Received request:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: JSON.stringify(req.body, null, 2),
    });
    if (req.method === 'POST') {
      console.log('Handling Telegram update');
      await bot.handleUpdate(req.body);
      return res.status(200).send('Webhook received');
    } else {
      console.log('Non-POST request received');
      return res.status(200).send('Webhook is running');
    }
  } catch (error) {
    console.error('Webhook error:', error.message, error.stack);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// دستور /start
bot.start((ctx) => {
  try {
    console.log('Received /start command from:', ctx.from.id);
    if (ctx.from.id.toString() !== OWNER_ID) {
      console.log('Unauthorized access attempt by:', ctx.from.id);
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
        }
      );
    }
    return ctx.reply(
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
              { text: '📖 How To Use?', callback_data: 'help#subin' },
              { text: '🔔 Update Channel', url: 'https://t.me/Savior_128' },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.error('Start command error:', error.message, error.stack);
    return ctx.reply(`Error: ${error.message}`);
  }
});

// دستور /login
bot.command('login', async (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    console.log('Unauthorized login attempt by:', ctx.from.id);
    return ctx.reply('This command is restricted to the owner.');
  }
  try {
    console.log(`Sending login request to: ${BASE_URL}/api/login`);
    console.log('Request payload:', {
      action: 'login',
      username: process.env.INSTAGRAM_USERNAME,
      password: process.env.INSTAGRAM_PASSWORD ? '****' : 'No password set',
    });
    const response = await axios.post(`${BASE_URL}/api/login`, {
      ctx,
      action: 'login',
      username: process.env.INSTAGRAM_USERNAME,
      password: process.env.INSTAGRAM_PASSWORD,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000, // 10 seconds timeout
    });
    console.log('Login response:', {
      status: response.status,
      data: response.data,
    });
    const { success, message, twoFactorRequired } = response.data;
    if (success) {
      return ctx.reply(message);
    } else if (twoFactorRequired) {
      ctx.reply(message, { reply_markup: { force_reply: true } });
      bot.on('text', async (otpCtx) => {
        try {
          console.log('Sending 2FA login request with code:', otpCtx.message.text);
          const otpResponse = await axios.post(`${BASE_URL}/api/login`, {
            ctx: otpCtx,
            action: 'login',
            username: process.env.INSTAGRAM_USERNAME,
            password: process.env.INSTAGRAM_PASSWORD,
            twoFactorCode: otpCtx.message.text,
          });
          console.log('2FA response:', otpResponse.data);
          return ctx.reply(otpResponse.data.message);
        } catch (err) {
          console.error('2FA error:', err.message, err.stack);
          return ctx.reply(`Error: ${err.message}`);
        }
      });
    }
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    if (error.response) {
      console.error('Response details:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    } else {
      console.error('No response received:', error.message);
    }
    return ctx.reply(`Error: ${error.message}`);
  }
});

// دستور /logout
bot.command('logout', async (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    console.log('Unauthorized logout attempt by:', ctx.from.id);
    return ctx.reply('This command is restricted to the owner.');
  }
  try {
    console.log(`Sending logout request to: ${BASE_URL}/api/login`);
    const response = await axios.post(`${BASE_URL}/api/login`, {
      ctx,
      action: 'logout',
    });
    console.log('Logout response:', response.data);
    return ctx.reply(response.data.message);
  } catch (error) {
    console.error('Logout error:', error.message, error.stack);
    if (error.response) {
      console.error('Response details:', {
        status: error.response.status,
        data: error.response.data,
      });
    }
    return ctx.reply(`Error: ${error.message}`);
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
    console.log('Profile request payload:', { username });
    const response = await axios.post(`${BASE_URL}/api/profile`, {
      ctx,
      username,
    });
    console.log('Profile response:', response.data);
    const { success, photo, caption, message } = response.data;
    if (success) {
      await ctx.replyWithPhoto(photo, { caption });
    } else {
      ctx.reply(message);
    }
  } catch (error) {
    console.error('Profile error:', error.message, error.stack);
    if (error.response) {
      console.error('Response details:', {
        status: error.response.status,
        data: error.response.data,
      });
    }
    return ctx.reply(`Error: ${error.message}`);
  }
});

// مدیریت callback queries
bot.on('callback_query', async (ctx) => {
  try {
    const [cmd, username] = ctx.callbackQuery.data.split('#');
    console.log('Received callback query:', { cmd, username });
    if (cmd === 'help') {
      ctx.editMessageText(
        'Help: Use /login to authenticate, /profile <username> to view profile info, /download <type> <username> to download content.',
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
        }
      );
    } else if (['photos', 'videos', 'stories', 'igtv'].includes(cmd)) {
      console.log(`Sending download request to: ${BASE_URL}/api/download`);
      console.log('Download request payload:', { type: cmd, username });
      const response = await axios.post(`${BASE_URL}/api/download`, {
        ctx,
        type: cmd,
        username,
      });
      console.log('Download response:', response.data);
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
    }
  } catch (error) {
    console.error('Callback query error:', error.message, error.stack);
    if (error.response) {
      console.error('Response details:', {
        status: error.response.status,
        data: error.response.data,
      });
    }
    ctx.reply(`Error: ${error.message}`);
  }
});
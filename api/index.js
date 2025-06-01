const { Telegraf } = require('telegraf');
const { IgApiClient } = require('instagram-private-api');
const axios = require('axios');
const { getSession, saveSession } = require('../utils/mongo'); // فرض بر وجود این توابع
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const OWNER_ID = process.env.OWNER_ID;
const ig = new IgApiClient();

// تنظیم BASE_URL (برای درخواست‌های داخلی می‌توان از مسیر نسبی استفاده کرد)
const BASE_URL = process.env.VERCEL_URL || 'https://istalo.vercel.app';

async function initializeInstagramSession() {
  try {
    const username = process.env.INSTAGRAM_USERNAME;
    console.log('Initializing session for:', username || 'No username set');
    if (!username) throw new Error('INSTAGRAM_USERNAME is not set');
    const savedSession = await getSession(username);
    if (savedSession) {
      console.log('Session restored for:', username);
      ig.state.deserialize(savedSession); // استفاده از deserialize برای session
    } else {
      console.log('No saved session found for:', username);
    }
  } catch (error) {
    console.error('Session initialization error:', error.message, error.stack);
  }
}

initializeInstagramSession();

// Handler برای ورود به اینستاگرام
async function handleInstagramLogin(req, res) {
  try {
    const { action, username, password, twoFactorCode } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (action === 'login') {
      ig.state.generateDevice(username);
      const loggedInUser = twoFactorCode
        ? await ig.account.twoFactorLogin({ username, verificationCode: twoFactorCode })
        : await ig.account.login(username, password);

      // ذخیره session در MongoDB
      const session = await ig.state.serialize();
      await saveSession(username, session);

      return res.status(200).json({
        success: true,
        message: `Logged in as ${username}`,
        twoFactorRequired: !!twoFactorCode,
      });
    } else if (action === 'logout') {
      await ig.account.logout();
      await saveSession(username, null); // پاک کردن session
      return res.status(200).json({ success: true, message: 'Logged out successfully' });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    return res.status(500).json({ error: 'Failed to login', details: error.message });
  }
}

// Handler برای دریافت پروفایل
async function handleInstagramProfile(req, res) {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // اطمینان از وجود session
    const savedSession = await getSession(process.env.INSTAGRAM_USERNAME);
    if (!savedSession) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    ig.state.deserialize(savedSession);
    const user = await ig.user.searchExact(username);

    return res.status(200).json({
      success: true,
      photo: user.profile_pic_url,
      caption: `${user.full_name} (@${user.username})\nBio: ${user.biography}`,
      message: `Profile fetched for ${username}`,
    });
  } catch (error) {
    console.error('Profile error:', error.message, error.stack);
    return res.status(500).json({ error: 'Failed to fetch profile', details: error.message });
  }
}

// Webhook و API handler
module.exports = async (req, res) => {
  try {
    console.log('Received request:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: JSON.stringify(req.body, null, 2),
    });

    // مدیریت درخواست‌های API
    if (req.url === '/api/login' && req.method === 'POST') {
      return handleInstagramLogin(req, res);
    } else if (req.url === '/api/profile' && req.method === 'POST') {
      return handleInstagramProfile(req, res);
    } else if (req.method === 'POST') {
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
// دستور /login در api/index.js
bot.command('login', async (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    console.log('Unauthorized login attempt by:', ctx.from.id);
    return ctx.reply('This command is restricted to the owner.');
  }
  try {
    console.log(`Sending login request to: /api/login`);
    const response = await axios.post('/api/login', {
      action: 'login',
      username: process.env.INSTAGRAM_USERNAME,
      password: process.env.INSTAGRAM_PASSWORD,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    console.log('Login response:', response.data);
    const { success, message, twoFactorRequired, twoFactorIdentifier } = response.data;
    if (success) {
      return ctx.reply(message);
    } else if (twoFactorRequired) {
      ctx.reply(message, { reply_markup: { force_reply: true } });
      bot.on('text', async (otpCtx) => {
        try {
          console.log('Sending 2FA login request with code:', otpCtx.message.text);
          const otpResponse = await axios.post('/api/login', {
            action: 'login',
            username: process.env.INSTAGRAM_USERNAME,
            password: process.env.INSTAGRAM_PASSWORD,
            twoFactorCode: otpCtx.message.text,
            twoFactorIdentifier,
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
      console.error('Response details:', error.response.data);
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
    console.log(`Sending logout request to: /api/login`);
    const response = await axios.post('/api/login', {
      action: 'logout',
      username: process.env.INSTAGRAM_USERNAME,
    });
    console.log('Logout response:', response.data);
    return ctx.reply(response.data.message);
  } catch (error) {
    console.error('Logout error:', error.message, error.stack);
    if (error.response) {
      console.error('Response details:', error.response.data);
    }
    return ctx.reply(`Error: ${error.message}`);
  }
});
// دستور /profile
// دستور /profile
bot.command('profile', async (ctx) => {
  const username = ctx.message.text.split(' ')[1];
  if (!username) {
    return ctx.reply('لطفاً یک نام کاربری وارد کنید، مثال: /profile username');
  }
  try {
    console.log(`Sending profile request to: /api/profile`);
    console.log('Profile request payload:', { username });
    const response = await axios.post('/api/profile', { username }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
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
      console.error('Response details:', error.response.data);
      if (error.response.status === 404) {
        return ctx.reply('خطای سرور: پروفایل یافت نشد. لطفاً بعداً تلاش کنید.');
      }
      return ctx.reply(`خطا: ${error.response.data.message || error.message}`);
    }
    return ctx.reply(`خطا: ${error.message}`);
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
      console.log(`Sending download request to: /api/download`);
      console.log('Download request payload:', { type: cmd, username });
      const response = await axios.post(`${BASE_URL}/api/download`, {
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
      console.error('Response details:', error.response.data);
    }
    ctx.reply(`Error: ${error.message}`);
  }
});
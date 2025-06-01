const { IgApiClient } = require('instagram-private-api');
const { saveSession, getSession, deleteSession } = require('../utils/mongo');
require('dotenv').config();

const ig = new IgApiClient();
let isLoggedIn = false;

async function loginToInstagram(username, password, ctx, twoFactorCode = null) {
  try {
    console.log('Attempting login for:', username);
    if (!username || !password) {
      throw new Error('Username or password is missing');
    }
    ig.state.generateDevice(username);

    // بررسی session موجود در MongoDB
    const savedSession = await getSession(username);
    if (savedSession) {
      console.log('Restoring session for:', username);
      ig.state.session = savedSession;
      isLoggedIn = true;
      return { success: true, message: `Restored session for ${username}!` };
    }

    // لاگین جدید
    console.log('Performing new login for:', username);
    if (twoFactorCode) {
      console.log('Using 2FA code:', twoFactorCode);
      await ig.account.twoFactorLogin({
        username,
        verificationCode: twoFactorCode,
        twoFactorIdentifier: ctx.session.twoFactorIdentifier,
      });
    } else {
      console.log('Logging in with username and password');
      await ig.account.login(username, password);
    }

    // ذخیره session در MongoDB
    console.log('Saving session for:', username);
    await saveSession(username, ig.state.session);
    isLoggedIn = true;
    return { success: true, message: `Successfully logged in as ${username}!` };
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    if (error.name === 'IgLoginTwoFactorRequiredError') {
      console.log('2FA required for:', username);
      ctx.session.twoFactorIdentifier = error.json.two_factor_info.two_factor_identifier;
      return { twoFactorRequired: true, message: 'Two-factor authentication required. Please provide the OTP.' };
    }
    throw new Error(`Login failed: ${error.message}`);
  }
}

async function logoutFromInstagram(username) {
  try {
    console.log('Attempting logout for:', username);
    if (!isLoggedIn) {
      console.log('No active session to logout');
      throw new Error('You are not logged in.');
    }
    await ig.account.logout();
    await deleteSession(username);
    isLoggedIn = false;
    console.log('Logout successful for:', username);
    return { success: true, message: 'Successfully logged out.' };
  } catch (error) {
    console.error('Logout error:', error.message, error.stack);
    throw new Error(`Logout failed: ${error.message}`);
  }
}

module.exports = async (req, res) => {
  try {
    console.log('Login endpoint called:', {
      body: req.body,
      headers: req.headers,
    });
    const { ctx, action, username, password, twoFactorCode } = req.body;

    if (!action) {
      console.log('No action provided');
      return res.status(400).json({ message: 'Action is required' });
    }

    if (action === 'login') {
      const result = await loginToInstagram(
        username || process.env.INSTAGRAM_USERNAME,
        password || process.env.INSTAGRAM_PASSWORD,
        ctx,
        twoFactorCode
      );
      console.log('Login result:', result);
      return res.status(200).json(result);
    } else if (action === 'logout') {
      const result = await logoutFromInstagram(username || process.env.INSTAGRAM_USERNAME);
      console.log('Logout result:', result);
      return res.status(200).json(result);
    } else {
      console.log('Invalid action:', action);
      return res.status(400).json({ message: 'Invalid action.' });
    }
  } catch (error) {
    console.error('Login endpoint error:', error.message, error.stack);
    return res.status(500).json({ message: error.message });
  }
};
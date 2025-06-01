const { IgApiClient } = require('instagram-private-api');
const { saveSession, getSession, deleteSession } = require('../utils/mongo');
require('dotenv').config();

const ig = new IgApiClient();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Login endpoint accessed:', {
      method: req.method,
      url: req.url,
      body: req.body,
      headers: req.headers,
    });

    const { action, username, password, twoFactorCode, twoFactorIdentifier } = req.body;

    if (!action) {
      console.log('No action provided');
      return res.status(400).json({ message: 'Action is required' });
    }

    const targetUsername = username || process.env.INSTAGRAM_USERNAME;
    const targetPassword = password || process.env.INSTAGRAM_PASSWORD;

    if (!targetUsername || !targetPassword) {
      console.log('Missing credentials:', { username: !!targetUsername, password: !!targetPassword });
      return res.status(400).json({ message: 'Username and password are required' });
    }

    if (action === 'login') {
      const result = await loginToInstagram(targetUsername, targetPassword, twoFactorCode, twoFactorIdentifier);
      console.log('Login result:', result);
      return res.status(200).json(result);
    } else if (action === 'logout') {
      const result = await logoutFromInstagram(targetUsername);
      console.log('Logout result:', result);
      return res.status(200).json(result);
    } else {
      console.log('Invalid action:', action);
      return res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Login endpoint error:', error.message, error.stack);
    return res.status(500).json({ message: `Error: ${error.message}` });
  }
};

async function loginToInstagram(username, password, twoFactorCode, twoFactorIdentifier) {
  try {
    console.log('Attempting login for:', username);

    // بررسی session موجود
    const savedSession = await getSession(username);
    if (savedSession) {
      console.log('Restoring session for:', username);
      await ig.state.deserialize(savedSession); // استفاده از deserialize
      return { success: true, message: `Restored session for ${username}` };
    }

    // لاگین جدید
    ig.state.generateDevice(username);
    console.log('Performing new login for:', username);
    let loggedInUser;
    if (twoFactorCode && twoFactorIdentifier) {
      console.log('Using 2FA code:', twoFactorCode);
      loggedInUser = await ig.account.twoFactorLogin({
        username,
        verificationCode: twoFactorCode,
        twoFactorIdentifier,
      });
    } else {
      console.log('Logging in with username and password');
      loggedInUser = await ig.account.login(username, password);
    }

    // ذخیره session
    const session = await ig.state.serialize();
    console.log('Saving session for:', username);
    await saveSession(username, session);

    return { success: true, message: `Successfully logged in as ${username}` };
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    if (error.name === 'IgLoginTwoFactorRequiredError') {
      console.log('2FA required for:', username);
      return {
        twoFactorRequired: true,
        twoFactorIdentifier: error.json.two_factor_info.two_factor_identifier,
        message: 'Two-factor authentication required. Please provide the OTP.',
      };
    }
    throw new Error(`Login failed: ${error.message}`);
  }
}

async function logoutFromInstagram(username) {
  try {
    console.log('Attempting logout for:', username);
    const savedSession = await getSession(username);
    if (!savedSession) {
      console.log('No active session to logout');
      return { success: true, message: 'No active session to logout.' };
    }

    await ig.state.deserialize(savedSession);
    await ig.account.logout();
    await deleteSession(username);
    console.log('Logout successful for:', username);
    return { success: true, message: 'Successfully logged out.' };
  } catch (error) {
    console.error('Logout error:', error.message, error.stack);
    throw new Error(`Logout failed: ${error.message}`);
  }
}
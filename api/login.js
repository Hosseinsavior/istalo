const { IgApiClient } = require('instagram-private-api');
const { saveSession, getSession, deleteSession } = require('../utils/mongo');
require('dotenv').config();

const ig = new IgApiClient();
let isLoggedIn = false;

async function loginToInstagram(username, password, ctx, twoFactorCode = null) {
  try {
    ig.state.generateDevice(username);

    // بررسی session موجود در MongoDB
    const savedSession = await getSession(username);
    if (savedSession) {
      ig.state.session = savedSession;
      isLoggedIn = true;
      return { success: true, message: `Restored session for ${username}!` };
    }

    // لاگین جدید
    if (twoFactorCode) {
      await ig.account.twoFactorLogin({
        username,
        verificationCode: twoFactorCode,
        twoFactorIdentifier: ctx.session.twoFactorIdentifier,
      });
    } else {
      await ig.account.login(username, password);
    }

    // ذخیره session در MongoDB
    await saveSession(username, ig.state.session);
    isLoggedIn = true;
    return { success: true, message: `Successfully logged in as ${username}!` };
  } catch (error) {
    if (error.name === 'IgLoginTwoFactorRequiredError') {
      ctx.session.twoFactorIdentifier = error.json.two_factor_info.two_factor_identifier;
      return { twoFactorRequired: true, message: 'Two-factor authentication required. Please provide the OTP.' };
    }
    throw new Error(`Login failed: ${error.message}`);
  }
}

async function logoutFromInstagram(username) {
  if (!isLoggedIn) {
    throw new Error('You are not logged in.');
  }
  await ig.account.logout();
  await deleteSession(username);
  isLoggedIn = false;
  return { success: true, message: 'Successfully logged out.' };
}

module.exports = async (req, res) => {
  const { ctx, action, username, password, twoFactorCode } = req.body;

  try {
    if (action === 'login') {
      const result = await loginToInstagram(username || process.env.INSTAGRAM_USERNAME, password || process.env.INSTAGRAM_PASSWORD, ctx, twoFactorCode);
      return res.status(200).json(result);
    } else if (action === 'logout') {
      const result = await logoutFromInstagram(username || process.env.INSTAGRAM_USERNAME);
      return res.status(200).json(result);
    } else {
      return res.status(400).json({ message: 'Invalid action.' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
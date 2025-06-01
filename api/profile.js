const { IgApiClient } = require('instagram-private-api');
const { getSession } = require('../utils/mongo');
require('dotenv').config();

const ig = new IgApiClient();

module.exports = async (req, res) => {
  const { username, ctx } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Please provide a username.' });
  }

  try {
    // بارگذاری session از MongoDB
    const savedSession = await getSession(process.env.INSTAGRAM_USERNAME);
    if (!savedSession) {
      return res.status(401).json({ message: 'Not logged in. Please use /login first.' });
    }
    ig.state.session = savedSession;

    // دریافت اطلاعات پروفایل
    ig.state.generateDevice(process.env.INSTAGRAM_USERNAME);
    const userId = await ig.user.getIdByUsername(username);
    const userInfo = await ig.user.info(userId);
    const profilePic = await ig.user.profilePicture(userId);

    const caption = `
      🏷 **Name**: ${userInfo.full_name || 'N/A'}
      🔖 **Username**: ${userInfo.username}
      📝 **Bio**: ${userInfo.biography || 'No bio'}
      📍 **Account Type**: ${userInfo.is_private ? 'Private' : 'Public'}
      🏭 **Is Business Account?**: ${userInfo.is_business_account ? 'Yes' : 'No'}
      👥 **Total Followers**: ${userInfo.follower_count}
      👥 **Total Following**: ${userInfo.following_count}
      📸 **Total Posts**: ${userInfo.media_count}
      📺 **IGTV Videos**: ${userInfo.total_igtv_videos || 0}
    `;

    return res.status(200).json({
      success: true,
      photo: profilePic.url,
      caption,
    });
  } catch (error) {
    return res.status(500).json({ message: `Error: ${error.message}` });
  }
};
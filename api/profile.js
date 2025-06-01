const { IgApiClient } = require('instagram-private-api');
const { getSession } = require('../utils/mongo');
require('dotenv').config();

const ig = new IgApiClient();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Please provide a username.' });
  }

  try {
    // بارگذاری session از MongoDB
    const savedSession = await getSession(process.env.INSTAGRAM_USERNAME);
    if (!savedSession) {
      return res.status(401).json({ message: 'Not logged in. Please use /login first.' });
    }

    // استفاده از deserialize برای بارگذاری session
    await ig.state.deserialize(savedSession);

    // تنظیم device برای جلوگیری از خطاهای اینستاگرام
    ig.state.generateDevice(process.env.INSTAGRAM_USERNAME);

    // دریافت اطلاعات پروفایل
    const user = await ig.user.searchExact(username); // استفاده از searchExact برای نام کاربری
    const userInfo = await ig.user.info(user.pk); // استفاده از user.pk به جای getIdByUsername
    const profilePic = user.profile_pic_url; // مستقیماً از user.profile_pic_url استفاده کنید

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
      photo: profilePic,
      caption,
      message: `Profile fetched successfully for ${username}`,
    });
  } catch (error) {
    console.error('Profile error:', error.message, error.stack);
    return res.status(500).json({
      message: 'Failed to fetch profile',
      details: error.message,
    });
  }
};
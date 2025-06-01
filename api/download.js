const { IgApiClient } = require('instagram-private-api');
const { getSession } = require('../utils/mongo');
require('dotenv').config();

const ig = new IgApiClient();

module.exports = async (req, res) => {
  const { type, username, ctx } = req.body;

  if (!username || !type) {
    return res.status(400).json({ message: 'Please provide username and type (photos, videos, stories, igtv).' });
  }

  if (!['photos', 'videos', 'stories', 'igtv'].includes(type)) {
    return res.status(400).json({ message: 'Invalid type. Use photos, videos, stories, or igtv.' });
  }

  try {
    // بارگذاری session از MongoDB
    const savedSession = await getSession(process.env.INSTAGRAM_USERNAME);
    if (!savedSession) {
      return res.status(401).json({ message: 'Not logged in. Please use /login first.' });
    }
    ig.state.session = savedSession;

    // تنظیم دستگاه برای API
    ig.state.generateDevice(process.env.INSTAGRAM_USERNAME);
    const userId = await ig.user.getIdByUsername(username);

    let mediaItems = [];
    if (type === 'photos' || type === 'videos') {
      const posts = await ig.feed.user(userId).items();
      const mediaType = type === 'photos' ? 1 : 2; // 1: image, 2: video
      mediaItems = posts.filter((post) => post.media_type === mediaType).slice(0, 5); // محدود به 5 مورد
    } else if (type === 'stories') {
      const stories = await ig.feed.userStories(userId).items();
      mediaItems = stories;
    } else if (type === 'igtv') {
      const igtv = await ig.feed.igtv(userId).items();
      mediaItems = igtv;
    }

    if (mediaItems.length === 0) {
      return res.status(200).json({ message: `No ${type} found for ${username}.` });
    }

    const mediaUrls = mediaItems
      .map((item) => {
        return item.image_versions2?.candidates[0]?.url || item.video_versions?.[0]?.url || null;
      })
      .filter((url) => url);

    return res.status(200).json({
      success: true,
      mediaUrls,
      message: `Found ${mediaUrls.length} ${type} for ${username}.`,
    });
  } catch (error) {
    return res.status(500).json({ message: `Error: ${error.message}` });
  }
};
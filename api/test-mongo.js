const { initMongo } = require('../utils/mongo');

module.exports = async (req, res) => {
  try {
    const db = await initMongo();
    await db.collection('test').insertOne({ message: 'MongoDB is working!', timestamp: new Date() });
    const result = await db.collection('test').findOne({ message: 'MongoDB is working!' });
    res.status(200).json({ message: result.message });
  } catch (error) {
    res.status(500).json({ message: `MongoDB error: ${error.message}` });
  }
};
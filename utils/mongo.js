const { MongoClient } = require('mongodb');
require('dotenv').config();

let mongoClient;
let db;

async function initMongo() {
  if (!mongoClient) {
    try {
      mongoClient = new MongoClient(process.env.MONGODB_URI);
      await mongoClient.connect();
      db = mongoClient.db('video_merge_bot');
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error.message);
      throw error;
    }
  }
  return db;
}

async function saveSession(username, sessionData) {
  const db = await initMongo();
  try {
    await db.collection('sessions').updateOne(
      { username },
      { $set: { sessionData, updatedAt: new Date() } },
      { upsert: true },
    );
    console.log(`Session saved for ${username}`);
  } catch (error) {
    console.error('Save session error:', error.message);
    throw error;
  }
}

async function getSession(username) {
  const db = await initMongo();
  try {
    const session = await db.collection('sessions').findOne({ username });
    return session ? session.sessionData : null;
  } catch (error) {
    console.error('Get session error:', error.message);
    throw error;
  }
}

async function deleteSession(username) {
  const db = await initMongo();
  try {
    await db.collection('sessions').deleteOne({ username });
    console.log(`Session deleted for ${username}`);
  } catch (error) {
    console.error('Delete session error:', error.message);
    throw error;
  }
}

module.exports = {
  initMongo,
  saveSession,
  saveSession,
  getSession,
  deleteSession,
};
const { MongoClient } = require('mongodb');
require('dotenv').config();

let mongoClient;
let db;

async function initMongo() {
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await mongoClient.connect();
    db = mongoClient.db('video_merge_bot'); // نام دیتابیس از Connection String
    console.log('Connected to MongoDB');
  }
  return db;
}

async function saveSession(username, sessionData) {
  const db = await initMongo();
  await db.collection('sessions').updateOne(
    { username },
    { $set: { sessionData, updatedAt: new Date() } },
    { upsert: true }
  );
}

async function getSession(username) {
  const db = await initMongo();
  const session = await db.collection('sessions').findOne({ username });
  return session ? session.sessionData : null;
}

async function deleteSession(username) {
  const db = await initMongo();
  await db.collection('sessions').deleteOne({ username });
}

module.exports = {
  initMongo,
  saveSession,
  getSession,
  deleteSession,
};
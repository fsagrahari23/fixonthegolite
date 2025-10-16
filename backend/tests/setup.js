const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

module.exports.connect = async () => {
  // Start in-memory Mongo and set env vars for app.js to connect lazily on require
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.SESSION_SECRET = 'testsecret';
  // Do NOT call mongoose.connect here to avoid double-connect across suites
};

module.exports.close = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  } finally {
    if (mongod) {
      await mongod.stop();
      mongod = null;
    }
  }
};

module.exports.clear = async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

const admin = require('firebase-admin');
const serviceAccount = require('./vintiora-app-serviceAccountKey.json');
// const serviceAccount = require('./firebase-adminsdk-serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;

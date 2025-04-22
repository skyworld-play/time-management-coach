const express = require('express');
const admin = require('firebase-admin');
const cron = require('node-cron');

const serviceAccount = require('./serviceAccountKey.json'); // Download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tmcoach-872fa.firebaseio.com"
});

const db = admin.firestore();
const app = express();

app.get('/', (req, res) => res.send('Notifier running!'));

// Run every hour
cron.schedule('0 * * * *', async () => {
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;
  const usersSnap = await db.collection('users').get();

  for (const userDoc of usersSnap.docs) {
    const tokensSnap = await userDoc.ref.collection('tokens').get();
    const tokens = tokensSnap.docs.map(doc => doc.id);
    if (tokens.length === 0) continue;

    const tasksSnap = await userDoc.ref.collection('tasks').get();
    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();
      if (task.due && !task.notified24h) {
        const dueTime = new Date(task.due).getTime();
        if (dueTime - in24h < 60 * 60 * 1000 && dueTime - now > 0) {
          const message = {
            notification: {
              title: 'Task Reminder',
              body: `Your task "${task.title}" is due in 24 hours!`
            }
          };
          for (const token of tokens) {
            try {
              await admin.messaging().send({ ...message, token });
            } catch (err) {
              console.error(`Error sending to token ${token}:`, err);
            }
          }
          await taskDoc.ref.update({ notified24h: true });
        }
      }
    }
  }
  console.log('Checked and sent notifications at', new Date());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Notifier backend running on port ${PORT}`));
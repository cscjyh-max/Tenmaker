const db = require('./db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, username, avatar, gold, clears, action } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  try {
    const userRef = db.collection('users').doc(userId);

    if (action === 'load') {
      const doc = await userRef.get();
      if (doc.exists) {
        return res.status(200).json({ exists: true, data: doc.data() });
      } else {
        return res.status(200).json({ exists: false });
      }
    } else if (action === 'save') {
      await userRef.set({
        username: username || "초보 마법사",
        avatar: avatar || "🧙‍♂️",
        gold: parseInt(gold) || 0,
        clears: parseInt(clears) || 0,
        lastUpdated: new Date()
      }, { merge: true });
      return res.status(200).json({ success: true });
    }

    res.status(400).json({ error: 'Invalid action parameter' });
  } catch (err) {
    console.error('sync-user error:', err);
    res.status(500).json({ error: err.message });
  }
};

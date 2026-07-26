const db = require('./db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, name, badge, score, timeRaw } = req.body;

  if (!type || !name || score === undefined) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const colName = `rankings_${type}`; // rankings_gold, rankings_clears, rankings_boss
    
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

    const newDocRef = db.collection(colName).doc();
    const entry = {
      badge: badge || "🧙‍♂️",
      name: name.substring(0, 15), // Limiting length for security
      score: score,
      date: dateStr,
      createdAt: adminFieldTimestamp() // Server timestamp for sorting backups
    };

    if (type === 'boss') {
      entry.timeRaw = parseFloat(timeRaw);
    }

    await newDocRef.set(entry);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('save-score error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Simple helper in Node to get database timestamp
function adminFieldTimestamp() {
  const admin = require('firebase-admin');
  return admin.firestore.FieldValue.serverTimestamp();
}

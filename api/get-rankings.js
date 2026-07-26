const db = require('./db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Fetch Gold Rankings
    const goldSnap = await db.collection('rankings_gold')
      .orderBy('score', 'desc')
      .limit(10)
      .get();
    const gold = goldSnap.docs.map((doc, idx) => ({
      rank: idx + 1,
      ...doc.data()
    }));

    // 2. Fetch Clears Rankings
    const clearsSnap = await db.collection('rankings_clears')
      .orderBy('score', 'desc')
      .limit(10)
      .get();
    const clears = clearsSnap.docs.map((doc, idx) => ({
      rank: idx + 1,
      ...doc.data()
    }));

    // 3. Fetch Boss Clear Time Rankings
    const bossSnap = await db.collection('rankings_boss')
      .orderBy('timeRaw', 'asc')
      .limit(10)
      .get();
    const boss = bossSnap.docs.map((doc, idx) => ({
      rank: idx + 1,
      ...doc.data()
    }));

    res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');
    res.status(200).json({ gold, clears, boss });
  } catch (err) {
    console.error('get-rankings error:', err);
    res.status(500).json({ error: err.message });
  }
};

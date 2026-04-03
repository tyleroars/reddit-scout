export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cutoff = req.query.cutoff ? parseInt(req.query.cutoff) : Math.floor(Date.now() / 1000) - 86400;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Referer': 'https://www.reddit.com/',
  };

  const allPosts = [];
  let after = '';

  try {
    for (let page = 0; page < 6; page++) {
      const url = `https://www.reddit.com/r/careerguidance/new.json?limit=100${after ? '&after=' + after : ''}`;

      const response = await fetch(url, { headers });

      if (!response.ok) {
        // If first page fails, return the error
        if (page === 0) {
          return res.status(response.status).json({ error: 'Reddit returned ' + response.status });
        }
        break;
      }

      const data = await response.json();
      const children = data?.data?.children;
      if (!children || !children.length) break;

      const batch = children.map(c => c.data);

      // Only keep posts within the time window
      const inWindow = batch.filter(p => p.created_utc >= cutoff);
      allPosts.push(...inWindow.map(p => ({
        id: p.id,
        title: p.title,
        selftext: (p.selftext || '').slice(0, 2000),
        permalink: p.permalink,
        url: p.url,
        created_utc: p.created_utc
      })));

      // Stop if oldest post in batch is before cutoff
      if (batch[batch.length - 1].created_utc < cutoff) break;

      after = data.data.after;
      if (!after) break;

      // Small delay between pages to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    res.setHeader('Cache-Control', 's-maxage=120');
    return res.status(200).json({ posts: allPosts });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

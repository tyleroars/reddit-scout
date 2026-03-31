export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { after } = req.query;
  const url = `https://www.reddit.com/r/careerguidance/new.json?limit=100${after ? '&after=' + after : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GradSimpleScout/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Reddit returned ' + response.status });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

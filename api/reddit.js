export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // RSS feed — not blocked by Reddit's IP restrictions unlike the JSON API
  const url = 'https://www.reddit.com/r/careerguidance/new/.rss?limit=100';

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GradSimpleScout/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Reddit returned ' + response.status });
    }

    const xml = await response.text();

    // Parse RSS XML into a simple array of post objects
    const posts = [];
    const itemRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1];

      const title = decodeXml(extractTag(item, 'title'));
      const link = extractAttr(item, 'link', 'href') || extractTag(item, 'link');
      const published = extractTag(item, 'published') || extractTag(item, 'updated');
      const content = decodeXml(extractTag(item, 'content') || extractTag(item, 'summary') || '');
      const id = extractTag(item, 'id') || link;

      if (!title || !link) continue;

      // Strip HTML tags from content
      const bodyText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      // Parse permalink to get post ID
      const permalinkMatch = link.match(/comments\/([a-z0-9]+)\//);
      const postId = permalinkMatch ? permalinkMatch[1] : id;
      const permalink = link.replace('https://www.reddit.com', '');

      const createdUtc = published ? Math.floor(new Date(published).getTime() / 1000) : Math.floor(Date.now() / 1000);

      posts.push({
        id: postId,
        title,
        selftext: bodyText,
        permalink: permalink.startsWith('/') ? permalink : '/' + permalink,
        url: link,
        created_utc: createdUtc
      });
    }

    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({ posts });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractAttr(xml, tag, attr) {
  const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : '';
}

function decodeXml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

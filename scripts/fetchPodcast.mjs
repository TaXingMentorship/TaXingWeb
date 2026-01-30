import fs from 'fs';
import path from 'path';
import axios from 'axios';
import Parser from 'rss-parser';

const FEED_URL = process.env.PODCAST_FEED_URL || 'https://feed.xyzfm.space/qwkvwqr67mfc';
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'podcast.json');
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;

const parser = new Parser({
  customFields: {
    item: [
      'itunes:duration',
      'itunes:image',
      'itunes:explicit',
      'itunes:subtitle',
      'itunes:summary',
      'itunes:season',
      'itunes:episode',
    ],
  },
});

async function fetchFeedWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await axios.get(url, {
        timeout: TIMEOUT_MS,
        responseType: 'text',
        headers: {
          'User-Agent': 'TaXingWeb RSS fetcher',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
      });
      return res.data;
    } catch (err) {
      const isLast = attempt === retries;
      console.warn(`Fetch attempt ${attempt} failed: ${err.message}`);
      if (isLast) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  throw new Error('Exhausted retries');
}

function buildPodcastFeed(feed) {
  return {
    title: feed.title || '',
    description: feed.description || '',
    link: feed.link || '',
    image: feed.itunes?.image || feed.image?.url || '',
    author: feed.itunes?.author || '',
    categories: feed.itunes?.categories || [],
    episodes: (feed.items || []).map((item, index) => ({
      id: item.guid || `episode-${index}`,
      title: item.title || `Episode ${index}`,
      description: item.content || item['itunes:summary'] || item.description || '',
      audioUrl: item.enclosure?.url || '',
      publishDate: item.pubDate || '',
      duration: item['itunes:duration'] || undefined,
      image: item['itunes:image']?.href || feed.image?.url || '',
      episodeNumber: item['itunes:episode'] ? parseInt(item['itunes:episode'], 10) : undefined,
      season: item['itunes:season'] ? parseInt(item['itunes:season'], 10) : undefined,
      explicit: item['itunes:explicit'] === 'yes',
    })),
  };
}

async function main() {
  console.log(`Fetching podcast feed from ${FEED_URL} ...`);

  try {
    const xml = await fetchFeedWithRetry(FEED_URL);
    const feed = await parser.parseString(xml);
    const podcastFeed = buildPodcastFeed(feed);

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(podcastFeed, null, 2), 'utf-8');
    console.log(`Saved ${podcastFeed.episodes.length} episodes to ${OUTPUT_PATH}`);
  } catch (err) {
    console.error('Failed to fetch podcast feed:', err.message);

    // Fallback: keep previous snapshot if it exists to avoid failing the build
    if (fs.existsSync(OUTPUT_PATH)) {
      console.warn('Using existing podcast.json as fallback.');
      return;
    }

    // Final fallback: write an empty feed so static export can proceed
    const emptyFeed = { title: '', description: '', link: '', image: '', episodes: [] };
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(emptyFeed, null, 2), 'utf-8');
    console.warn('Wrote empty podcast feed as fallback.');
  }
}

main();

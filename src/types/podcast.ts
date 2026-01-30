/**
 * Represents a single podcast episode
 */
export interface PodcastEpisode {
  /** Unique identifier for the episode */
  id: string;
  /** Episode title */
  title: string;
  /** Full episode description (may contain HTML) */
  description: string;
  /** URL to the audio file */
  audioUrl: string;
  /** Publication date of the episode (ISO 8601 format string) */
  publishDate: string;
  /** Episode duration in format HH:MM:SS or MM:SS */
  duration?: string;
  /** URL to episode cover image (falls back to podcast image if not provided) */
  image?: string;
  /** Episode number in the series */
  episodeNumber?: number;
  /** Season number */
  season?: number;
  /** Whether the episode contains explicit content */
  explicit?: boolean;
}

/**
 * Represents a podcast feed containing multiple episodes
 */
export interface PodcastFeed {
  /** Podcast title */
  title: string;
  /** Podcast description */
  description: string;
  /** Link to the podcast website or RSS feed */
  link: string;
  /** URL to podcast cover image */
  image: string;
  /** Author or creator of the podcast */
  author?: string;
  /** Podcast categories/genres */
  categories?: string[];
  /** List of podcast episodes */
  episodes: PodcastEpisode[];
}
export interface NavigationItem {
  name: string;
  path: string;
}

export const pagesItems: NavigationItem[] = [
  { name: 'Home', path: '/' },
  { name: 'About Us', path: '/about' },
  { name: 'Past Programs', path: '/past-programs' },
  { name: 'Podcast', path: '/podcast' },
  // { name: 'Join Us', path: '/join' },
];

import React from 'react';
import Container from '@mui/material/Container';
import PodcastPlayer from '@/components/common/PodcastPlayer';


export default function PodcastListPage() {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <PodcastPlayer />
    </Container>
  );
}
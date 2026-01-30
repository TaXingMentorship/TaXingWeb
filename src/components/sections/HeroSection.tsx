import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import Image from 'next/image';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const backgroundImgSrc = `${basePath}/images/taxing-hero-image.png`;

const HeroSection = () => (
  <Box
    sx={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      mb: 6,
    }}
  >
    <Image
      src={backgroundImgSrc}
      alt="Taxing background"
      fill
      style={{ objectFit: 'cover' }}
      priority
      quality={85}
    />
    <Box
      sx={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 0,
      }}
    />
    <Container
      maxWidth="md"
      sx={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'left',
      }}
    >
        <Box sx={{ pl: 0 }}> {/* adjust pt value as needed */}
  </Box>
      <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold', pl: 3}}>
        她行
      </Typography>
      <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold', pl: 3 }}>
        Forward With Her Mentorship
      </Typography>
    </Container>
  </Box>
);

export default HeroSection;

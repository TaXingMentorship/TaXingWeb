import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import Image from 'next/image';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const backgroundImgSrc = `${basePath}/images/taxing-hero-image.png`;

const HeroSection = () => (
  <Box
    sx={{
      position: 'relative',
      width: '100%',
      minHeight: { xs: '75vh', md: '100vh' },
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      mb: { xs: 4, md: 6 },
      overflow: 'hidden'
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
        textAlign: { xs: 'center', md: 'left' },
        px: { xs: 2, md: 4 }
      }}
    >
      <Typography
        variant="h2"
        component="h1"
        gutterBottom
        sx={{
          fontWeight: 'bold',
          pl: { md: 3 },
          fontSize: { xs: '2rem', sm: '2.5rem', md: '3.25rem' },
          lineHeight: 1.1
        }}
      >
        她行
      </Typography>
      <Typography
        variant="h2"
        component="h1"
        gutterBottom
        sx={{
          fontWeight: 'bold',
          pl: { md: 3 },
          fontSize: { xs: '1.65rem', sm: '2.2rem', md: '3rem' },
          lineHeight: 1.1
        }}
      >
        Forward With Her Mentorship
      </Typography>
    </Container>
  </Box>
);

export default HeroSection;

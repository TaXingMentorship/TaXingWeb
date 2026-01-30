'use client';

import React from 'react';
import { Box, Container } from '@mui/material';
import Image from 'next/image';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
import { volunteers } from '@/data/volunteers';
import { aboutPageContent } from '@/data/aboutContent';
import {HistoryTimeline, VolunteerAccordion } from '@/components/about';

const AboutUs: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box sx={{ my: 6, display: 'flex', justifyContent: 'center' }}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: 2000,
            aspectRatio: '16 / 9',
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: 3,
          }}
        >
          <Image
            src={`${basePath}/images/她行AboutUS网页插图.png`}
            alt="关于她行插图"
            fill
            sizes="(max-width: 900px) 100vw, 1024px"
            style={{ objectFit: 'cover' }}
            priority
          />
        </Box>
      </Box>
      <HistoryTimeline sections={aboutPageContent.sections} />
      <VolunteerAccordion
        title={aboutPageContent.volunteerSectionTitle}
        volunteers={volunteers}
      />
    </Container>
  );
};

export default AboutUs;
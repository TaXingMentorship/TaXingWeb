import React from 'react';
import { Container } from '@mui/material';
import {
  HeroSection,
  AboutSection,
  MediaIconsSection,
  PastProgramsSection,
  ParticipantsSection,
  OverviewSection,
  VolunteersSection,
  ContactUsSection
} from '@/components/sections';

const Home: React.FC = () => (
  <>
    <HeroSection />
    <Container maxWidth="lg" sx={{ mb: 4 }}>
      <AboutSection />
      <MediaIconsSection />
      <VolunteersSection />
      <PastProgramsSection />
      <ParticipantsSection />
      <OverviewSection />
      <ContactUsSection />
    </Container>
  </>
);

export default Home;
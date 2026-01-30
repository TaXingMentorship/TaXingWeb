import React from 'react';
import { Box, Typography } from '@mui/material';
import { AboutSection } from '@/types/aboutContent';

interface HistoryTimelineProps {
  sections: AboutSection[];
}

const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ sections }) => {
  return (
    <>
      {sections.map((section, index) => (
        <Box key={index} sx={{ mb: 6 }}>
          <Typography
            variant="h5"
            component="h2"
            gutterBottom
            sx={{ fontWeight: 'bold', color: '#000' }}
          >
            {section.title}
          </Typography>
          <Typography
            variant="body1"
            sx={{ fontSize: '1.1rem', lineHeight: 1.8, color: 'text.secondary' }}
          >
            {section.content}
          </Typography>
        </Box>
      ))}
    </>
  );
};

export default HistoryTimeline;

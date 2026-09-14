'use client';

import React from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Typography, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { PublicVolunteer } from '@/types/portal';

interface VolunteerAccordionProps {
  title: string;
  volunteers: PublicVolunteer[];
}

const VolunteerAccordion: React.FC<VolunteerAccordionProps> = ({ title, volunteers }) => {
  return (
    <Accordion>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="team-content"
        id="team-header"
        sx={{ bgcolor: '#f8f9fa' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold', color: '#000' }}>
            {title} ({volunteers.length})
          </Typography>
          <Typography
            variant="body2"
            component="p"
            sx={{ fontWeight: 500, color: '#555', lineHeight: 1.4 }}
          >
            志愿者排名不分先后
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ bgcolor: '#f8f9fa', pt: 0 }}>
        {volunteers.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ py: 2 }}>
            志愿者名单暂时无法加载，请稍后再试。
          </Typography>
        ) : (
          <Box>
            {volunteers.map((volunteer, index) => (
              <Box
                key={volunteer.id}
                sx={{
                  py: 2,
                  borderBottom: index < volunteers.length - 1 ? '1px solid #e0e0e0' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 2
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'medium', wordBreak: 'break-word' }}>
                  {volunteer.full_name}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                  {volunteer.seasons.join('、')}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default VolunteerAccordion;

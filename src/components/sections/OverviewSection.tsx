import React from 'react';
import { Box, Typography, SvgIcon } from '@mui/material';
import { OverviewData } from '@/types/home';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

const overviewData: OverviewData[] = [
  { iconSrc: RocketLaunchIcon, field: 'Established', value: '2020' },
  { iconSrc: RocketLaunchIcon, field: 'Volunteers', value: '90+' },
  { iconSrc: RocketLaunchIcon, field: 'Mentors', value: '400+' },
  { iconSrc: RocketLaunchIcon, field: 'Mentees', value: '1000+' },
];

const OverviewSection = () => (
  <Box sx={{ display: 'flex', justifyContent: 'space-evenly', pt: 3, flexWrap: 'wrap', gap: 3 }}>
    {overviewData.map((item) => (
      <Box key={item.field} sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        <SvgIcon color="secondary">
          {React.createElement(item.iconSrc)}
        </SvgIcon>
        <Typography variant="h3">{item.value}</Typography>
        <Typography variant="h4">{item.field}</Typography>
      </Box>
    ))}
  </Box>
);

export default OverviewSection;

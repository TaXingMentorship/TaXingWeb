import React from 'react';
import { Box, Typography } from '@mui/material';
import Image from 'next/image';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const map = `${basePath}/images/map.jpg`;

const ParticipantsSection = () => (
  <>
    <Box sx={{ textAlign: 'center', m: 1, mt: 8 }}>
      <Typography variant="h4">Participants</Typography>
    </Box>
    <Box sx={{ textAlign: 'center', m: 1 }}>
      我们聚集了来自世界各地的她们
    </Box>
    <Box sx={{ textAlign: 'center', m: 1 }}>
      Our participants come from all around the world.
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
      <Image src={map} alt="map" width={1200} height={600} />
    </Box>
  </>
);

export default ParticipantsSection;

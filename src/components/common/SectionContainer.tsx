import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';

interface SectionContainerProps {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const SectionContainer: React.FC<SectionContainerProps> = ({
  children,
  sx = {},
  maxWidth = 'lg'
}) => {
  const maxWidthMap = {
    sm: '600px',
    md: '900px',
    lg: '1200px',
    xl: '1536px'
  };

  return (
    <Box
      sx={{
        maxWidth: maxWidthMap[maxWidth],
        margin: '0 auto',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 4, sm: 6, md: 8 },
        ...sx
      }}
    >
      {children}
    </Box>
  );
};

export default SectionContainer;

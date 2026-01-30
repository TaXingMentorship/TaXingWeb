'use client';
import { Box, Typography } from '@mui/material';
import Image from 'next/image';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const line = `${basePath}/images/Line.png`;

interface TextDividerProps {
  text: string;
}

const TextDivider = ({ text }: TextDividerProps) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', my: 3 }}>
      <Image src={line} alt="Divider Line" width={160} height={4} />
      <Typography variant="body1" color="text.secondary" sx={{ ml: 1 }}>
        {text}
      </Typography>
    </Box>
  );
};

export default TextDivider;
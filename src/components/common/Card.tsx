import React from 'react';
import { Card as MuiCard, CardContent, Typography, Box, SxProps, Theme } from '@mui/material';

interface CardProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  image?: React.ReactNode;
  sx?: SxProps<Theme>;
  variant?: 'elevated' | 'outlined';
}

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  image,
  sx = {},
  variant = 'elevated'
}) => {
  return (
    <MuiCard
      elevation={variant === 'elevated' ? 3 : 0}
      variant={variant === 'outlined' ? 'outlined' : 'elevation'}
      sx={{
        borderRadius: 2,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: variant === 'elevated' ? 6 : 3,
        },
        ...sx
      }}
    >
      {image && (
        <Box sx={{ position: 'relative', width: '100%', height: 200 }}>
          {image}
        </Box>
      )}
      <CardContent>
        {title && (
          <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
            {title}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {subtitle}
          </Typography>
        )}
        {children}
      </CardContent>
    </MuiCard>
  );
};

export default Card;

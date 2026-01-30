import React from 'react';
import { Box, Typography, Card, CardContent, CardActions, Button } from '@mui/material';
import TextDivider from '@/components/common/TextDivider';
import { pastProgramCards, pastProgramsIntro } from '@/data/pastPrograms';

const PastProgramsSection = () => (
  <>
    <TextDivider text="往期回顾" />
    <Typography
      variant="h4"
      component="h4"
      gutterBottom
      sx={{ padding: 4, px: 6 }}
    >
      {pastProgramsIntro}
    </Typography>
    <Box sx={{ display: 'flex', justifyContent: 'space-evenly', flexWrap: 'wrap', gap: 3 }}>
      {pastProgramCards.map((card) => (
        <Card
          key={card.title}
          sx={{
            height: 300,
            width: 300,
            backgroundImage: `url(${card.imageSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            position: 'relative',
            borderRadius: 3,
            color: 'white',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: 'inherit',
            },
          }}
        >
          <CardContent sx={{ position: 'relative', color: 'white', p: 3, pt: 4 }}>
            <Typography gutterBottom variant="h5" component="div">
              {card.title}
            </Typography>
          </CardContent>
          <CardActions
            sx={{
              position: 'absolute',
              bottom: 16,
              p: 3,
              display: 'flex',
              justifyContent: 'flex-start'
            }}
          >
            <Button
              size="small"
              variant="contained"
              color="primary"
              component="a"
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn More
            </Button>
          </CardActions>
        </Card>
      ))}
    </Box>
  </>
);

export default PastProgramsSection;

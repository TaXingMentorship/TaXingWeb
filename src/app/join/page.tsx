import React from 'react';
import { Button, Typography, Container, Box } from '@mui/material';

const Home: React.FC = () => {
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Next.js with Material UI
        </Typography>
        <Button variant="contained" color="primary">
          Hello World
        </Button>
      </Box>
    </Container>
  );
};

export default Home;
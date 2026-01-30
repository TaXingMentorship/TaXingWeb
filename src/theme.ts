import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#FEBD59',
    },
    secondary: {
      main: '#FD7E14',
    },
    error: {
      main: '#red',
    },
    background: {
      default: '#fff',
    },
  },
  // Add custom typography, spacing, breakpoints, etc. here
});

export default theme;
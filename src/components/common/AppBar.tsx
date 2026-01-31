import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { pagesItems } from '@/data/navigation';
import { donationDescription, donationLink } from '@/data/donation';
import DonationDialog from '@/components/common/DonationDialog';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const logoSrc = `${basePath}/icons/forward_with_her_logo.png`;

const AppAppBar: React.FC = () => {
  const [donationOpen, setDonationOpen] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const handleDonationOpen = () => setDonationOpen(true);
  const handleDonationClose = () => setDonationOpen(false);
  const toggleNav = () => setNavOpen((prev) => !prev);

  const renderNavButtons = () => (
    pagesItems.map((item) => (
      <Link href={item.path} key={item.name}>
        <Button sx={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{item.name}</Button>
      </Link>
    ))
  );

  const drawer = (
    <Box sx={{ width: 260 }} role="presentation" onClick={toggleNav} onKeyDown={toggleNav}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, gap: 1 }}>
        <Image src={logoSrc} alt="Logo" width={48} height={48} />
        <Typography variant="h6" component="span">她行</Typography>
      </Box>
      <Divider />
      <List>
        {pagesItems.map((item) => (
          <ListItem key={item.name} disablePadding>
            <ListItemButton component={Link} href={item.path} sx={{ py: 1.2 }}>
              <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem disablePadding>
          <ListItemButton onClick={handleDonationOpen} sx={{ py: 1.2 }}>
            <ListItemText primary="Donation" primaryTypographyProps={{ fontWeight: 700 }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <>
      <AppBar color="primary" position="sticky" aria-label="Main navigation">
        <Toolbar sx={{ px: { xs: 2, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
              <Image
                src={logoSrc}
                alt="Logo"
                width={64}
                height={64}
                priority
                style={{ cursor: 'pointer', display: 'block' }}
              />
            </Link>
          </Box>

          {isDesktop ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                justifyContent: 'space-evenly',
                flexWrap: 'nowrap',
                flexGrow: 1,
                ml: { md: 3 }
              }}
            >
              {renderNavButtons()}
              <Button
                onClick={handleDonationOpen}
                variant="contained"
                color="inherit"
                disableElevation
                sx={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  px: 2.5,
                  background: '#ffffff',
                  color: '#1a1a1a',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                  '&:hover': {
                    background: '#f5f5f5',
                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.16)'
                  },
                  '&:focus-visible': {
                    outline: '3px solid rgba(0, 0, 0, 0.2)',
                    outlineOffset: 2
                  }
                }}
              >
                Donation
              </Button>
            </Box>
          ) : (
            <>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton
                edge="end"
                color="inherit"
                aria-label="Open navigation menu"
                onClick={toggleNav}
              >
                <MenuIcon />
              </IconButton>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={navOpen} onClose={toggleNav} ModalProps={{ keepMounted: true }}>
        {drawer}
      </Drawer>

      <DonationDialog
        open={donationOpen}
        onClose={handleDonationClose}
        description={donationDescription}
        link={donationLink}
      />
    </>
  );
};

export default AppAppBar;
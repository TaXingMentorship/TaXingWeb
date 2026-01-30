import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Image from 'next/image';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const poseImg = `${basePath}/images/pose_pien_uruuru_woman.png`;

interface DonationDialogProps {
  open: boolean;
  onClose: () => void;
  description: string;
  link: string;
}

const DonationDialog: React.FC<DonationDialogProps> = ({ open, onClose, description, link }) => (
  <Dialog
    open={open}
    onClose={onClose}
    aria-labelledby="donation-dialog-title"
  >
    <DialogTitle id="donation-dialog-title">感谢支持✨！</DialogTitle>
    <DialogContent>
      <DialogContentText sx={{ mb: 2 }}>
        {description}
      </DialogContentText>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Button
          component="a"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          size="large"
          sx={{ px: 3.5, py: 1.1, fontWeight: 700 }}
        >
          支持我们
        </Button>
      </Box>
      <DialogContentText sx={{ mb: 2 }}>
        点击上方按钮，下滑至推文末尾，点击“喜欢作者”
      </DialogContentText>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Image
          src={poseImg}
          alt="捐赠支持插画"
          width={400}
          height={363}
          sizes="(max-width: 480px) 70vw, 220px"
          style={{
            width: 'min(220px, 100%)',
            height: 'auto'
          }}
          priority
        />
      </Box>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);

export default DonationDialog;

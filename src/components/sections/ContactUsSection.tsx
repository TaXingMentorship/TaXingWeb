import React from 'react';
import { Box, Typography, Link } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import TextDivider from '@/components/common/TextDivider';

const ContactUsSection: React.FC = () => (
  <Box sx={{ py: 6 }}>
    <TextDivider text="Stay Connected 联系我们" />
    <Box sx={{ textAlign: 'center', mt: 4 }}>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
      如果你想获取她行的最新信息（比如新的活动，志愿者招募等等），欢迎关于她行的微信公众号：她行Mentorship
      <br /><br />
      如果有任何其他问题，欢迎在我们的公众号后台留言、私信，或者是发邮件至：
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
        <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Link href="mailto:taxingmentorship@gmail.com" underline="hover" color="primary">
        taxingmentorship@gmail.com
        </Link>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 4 }}>
      </Box>
    </Box>
  </Box>
);

export default ContactUsSection;

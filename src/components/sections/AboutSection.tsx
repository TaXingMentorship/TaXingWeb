import React from 'react';
import { Box, Typography } from '@mui/material';
import Image from 'next/image';
import TextDivider from '@/components/common/TextDivider';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const aboutImage = `${basePath}/images/taxing-about.png`;

const AboutSection = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: { xs: 'column-reverse', md: 'row' },
      justifyContent: 'space-between',
      alignItems: { xs: 'center', md: 'flex-start' },
      gap: { xs: 3, md: 4 },
      mb: 4
    }}
  >
    <Box sx={{ display: 'flex', flexDirection: 'column', mr: { md: 4 }, maxWidth: 720 }}>
      <TextDivider text="关于我们" />
      <Typography variant="h4" sx={{ mb: 2 }}>她行简介</Typography>
      <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
        她行是一个致力于帮助理工科女性的公益社群。通过mentorship交流活动的形式，将有丰富工作/学业经验的Mentor（导师）与初入职场/大学的Mentee（学员）连接起来，为她们创造一个专注于女性视角，聚焦在职场生活、个人成长上的对话空间。希望通过连接一位位在职场学业中曾经迷茫、稚嫩、无措的她们，我们将源源不断地传递「她行」理念——做衔接女性经验的行舟。
        <br /><br />
        自从2020年夏天的第一期mentorship活动开始，她行已经连接了上百位mentor与上千位mentee，而这个数字还在源源不断地增长。
      </Typography>
    </Box>
    <Box sx={{ width: { xs: '100%', sm: '80%', md: '45%' }, maxWidth: 520 }}>
      <Image
        src={aboutImage}
        alt="About"
        width={520}
        height={520}
        style={{ borderRadius: '5%', width: '100%', height: 'auto' }}
      />
    </Box>
  </Box>
);

export default AboutSection;

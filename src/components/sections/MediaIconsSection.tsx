import React from 'react';
import { Box, Typography, SvgIcon } from '@mui/material';
import Image from 'next/image';
import TextDivider from '@/components/common/TextDivider';
import { MediaIcon } from '@/types/home';

// Media icons data
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const wechatLogo = `${basePath}/icons/微信logo.svg`;
const littleRedBookLogo = `${basePath}/icons/小红书Logo.svg`;
const linkedinLogo = `${basePath}/icons/linkedin.svg`;
const xiaoYuZhouLogo = `${basePath}/icons/小宇宙.svg`;
const spotifyLogo = `${basePath}/icons/spotify.svg`;

const mediaIcons: MediaIcon[] = [
  { iconSrc: wechatLogo, text: '她行Mentorship', redirectUrl: 'https://mp.weixin.qq.com/s/j6mqJA1TKbIYU8grMWL4fQ' },
  { iconSrc: littleRedBookLogo, text: '她行Mentorship', redirectUrl: 'https://www.xiaohongshu.com/user/profile/61afcdc0000000002102acff?xsec_token=YBnLX563FOKkgkvuUqJp9Is8OOknOL8Ka1FqrECyZ6xV4=&xsec_source=app_share&xhsshare=CopyLink&appuid=59f69ff24eacab69b220e875&apptime=1745496711&share_id=523a71f6823144a28c2153b9f02a9aa8' },
  { iconSrc: linkedinLogo, text: 'Forward With Her', redirectUrl: 'https://www.linkedin.com/company/taxing-mentorship/' },
  { iconSrc: xiaoYuZhouLogo, text: '她声HerVoice', redirectUrl: 'https://www.xiaoyuzhoufm.com/podcast/6665957dc449f5567cfcf85a' },
  { iconSrc: spotifyLogo, text: '她声HerVoice', redirectUrl: 'https://open.spotify.com/show/1erEPXE5haT4nrsNjrXsdr?si=7RJlVulrT_KwuCkmSO2PhQ' },
];

const MediaIconsSection = () => (
  <>
    <TextDivider text="OUR 平台" />
    <Box sx={{ display: 'flex', justifyContent: 'space-evenly', flexWrap: 'wrap' }}>
      {mediaIcons.map((mediaIcon) => (
        <Box key={mediaIcon.redirectUrl} sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
          <SvgIcon
            component="a"
            fontSize="large"
            href={mediaIcon.redirectUrl}
            sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }}
          >
            <Image src={mediaIcon.iconSrc} alt="Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
          </SvgIcon>
          <Typography variant="body1">{mediaIcon.text}</Typography>
        </Box>
      ))}
    </Box>
  </>
);

export default MediaIconsSection;

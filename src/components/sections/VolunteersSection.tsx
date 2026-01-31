import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import TextDivider from '@/components/common/TextDivider';
import Image from 'next/image';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const HrTeamIcon = `${basePath}/icons/hr_team.png`;
const OperationsTeamIcon = `${basePath}/icons/operations_team.png`;
const ProjectTeamIcon = `${basePath}/icons/project_team.png`;
const StrategyTeamIcon = `${basePath}/icons/strategy_team_icon.jpg`;

const volunteerGroups = [
  {
    icon: <Image src={StrategyTeamIcon} alt="Forward With Her" width={110} height={110} />,
    title: '战略组',
    description: '负责她行的策划与管理工作',
  },
  {
    icon: <Image src={HrTeamIcon} alt="Forward With Her" width={110} height={110} />,
    title: '人事组',
    description: '负责与活动参与者Mentor和Mentee们进行对接',
  },
  {
    icon: (
      <Image
        src={OperationsTeamIcon}
        alt="Forward With Her"
        width={125}
        height={125}
      />
    ),
    title: '运营组',
    description: '负责她行的对外宣传工作',
  },
  {
    icon: <Image src={ProjectTeamIcon} alt="Forward With Her" width={110} height={110} />,
    title: '项目组',
    description: '负责策划与组织她行中的圆桌讨论及分享交流活动，促进成员间的经验分享与深入交流',
  },
];

const VolunteersSection: React.FC = () => (
  <Box sx={{ py: 6 }}>
    <TextDivider text="OUR 志愿者" />
    <Typography variant="body1" sx={{ textAlign: 'center', mb: 4 }}>
    作为一个纯公益组织，她行活动的维系与发展要全部归功于无私奉献自己时间的志愿者们！没有她们，她行也无法持续下去。
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
      {volunteerGroups.map((group, index) => (
        <Box key={index} sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)' }, maxWidth: '500px' }}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              p: 2,
              transition: 'transform 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-8px)',
              },
            }}
          >
            <CardContent>
              <Box sx={{ mb: 2 }}>
                {group.icon}
              </Box>
              <Typography variant="h6" component="h3" gutterBottom>
                {group.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {group.description}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  </Box>
);

export default VolunteersSection;

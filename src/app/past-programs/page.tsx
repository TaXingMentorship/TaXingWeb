import React from 'react';
import { Box, Chip, Divider, Link, Stack, Tooltip, Typography } from '@mui/material';
import Card from '@/components/common/Card';
import SectionContainer from '@/components/common/SectionContainer';

const programs = [
  {
    icon: '🌱',
    title: '2024 春季活动：春意夏色中的多元探索',
    keywords: '形式创新 | 播客上线 | 灵活匹配',
    url: 'https://mp.weixin.qq.com/s/kR4K81OB6NXmgaQg2_Q1Rw',
    description:
      '本期项目聚焦科技领域，62 位 Mentor 与 147 位 Mentee 在春夏之交开启了一场多元对话。我们在机制上大胆创新，支持 Mentee 在活动中期二次匹配新 Mentor，打破单一视角，获取更丰富的经验输入。此外，这也是「她行」项目的重要里程碑——我们首次推出了播客栏目，将女性成长的声音传递给更广阔的听众；并设立了 Padlet 毕业留言板，记录下无数个关于“陪伴与成长”的暖心瞬间。'
  },
  {
    icon: '❄️',
    title: '2024 冬季活动：跨越寒冬的成长礼赞',
    keywords: '规模之最 | 全链路支持 | 深度连接',
    url: 'https://mp.weixin.qq.com/s/iznIWo17wgwtHhm-IxkXuw',
    description:
      '这是「她行」创立以来规模最大的一期项目，汇聚了全球 115 位 Mentor 与 226 位 Mentee。在这个冬天，我们构建了从“详尽 Handbook 指引”到“19 场分组集体答疑”，再到“核心 1v1 深度交流”的全链路支持体系。来自 AI、金融科技、医疗等前沿领域的导师们，不仅带来了硬核的行业经验，更通过 10+ 场主题分享会，与姐妹们共同探讨了职场进阶与自我调节的智慧。我们在寒冬中紧密相连，让知识的传递高效而有温度。'
  },
  {
    icon: '☀️',
    title: '2025 夏季活动：继续做衔接经验的行舟',
    keywords: '可持续生态 | 自由答疑 | 透明运营',
    url: 'https://mp.weixin.qq.com/s/oM5o0hvfkN5hfT31Gzg9Iw',
    description:
      '在这个夏天，我们致力于打造一个女性互助的可持续生态。我们新增了 Mentor Office Hour 的活动形式，支持 Mentor 自由组织答疑活动。通过 20+ 场 Mentor Office Hour、7 场圆桌分享与 6 期播客，我们链接了 62 名 Mentor 与 112 名 Mentee，让经验流动不仅限于 1v1，更在社群中活跃。本期活动更加注重社群文化的沉淀，推出了五周年特别策划、专属表情包以及完善的 Wiki 资料库。同时，我们坚持财务公开透明，依靠志愿者的高效协作与社群支持，让这艘承载女性经验与智慧的“行舟”行稳致远，让 Girls help girls 的方向更加清晰。'
  },
  {
    icon: '🌱',
    title: '2026 春季活动：女性互助沃土中的春和景明',
    keywords: '多元 Tech 社群 | 干货分享 | 精神小天地',
    url: 'https://mp.weixin.qq.com/s/JT96_V3jQkuCe9iGjcHGpw',
    description:
      '在这个春意盎然的季节，「她行」汇聚了 188 位 Mentee、74 位 Mentor 与 45 位志愿者，共同交织出一个跨越学生与职场的多元女性 Tech 社群。本期项目不仅落地了 73 组核心 1v1 深度交流，更开展了 19 场分组集体答疑与 12 场主题丰富的“圆桌”或“她分享”，内容全面覆盖 AI 技术前沿、跨界转行突破、全球求职升学及职场生存等等。从“搞钱搞事业”的探索到“身心向内求”的自我觉醒，Mentor们帮助姐妹们在充满不确定性的大环境中稳住“个人的小气候”。在这片“Girls Help Girls”的沃土上，我们在共鸣中沉淀思考，让每一次交流都萌发出生机勃勃的可能性。'
  }
];

const PastProgramsPage: React.FC = () => {
  return (
    <SectionContainer maxWidth="lg">
      <Stack spacing={{ xs: 3, md: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            她行历届回顾
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            从 2020 年夏季的第一期活动起，截止 2026 年一月，「她行」已经走过了八期活动。
            在无数志愿者的帮助下，连接了 400 多位 Mentor 与 1000 多位 Mentee。
            感谢参与者们的真诚反馈与志愿者们的集体头脑风暴，「她行」在每一期活动之间都会持续进行复盘、迭代与改进，致力于探索并打磨最适合线上 mentorship 的活动形式，以更好地运营和支持女性互助社群。
            从最初仅以 1v1 交流为核心，我们逐步拓展出圆桌会议、Mentor 导师答疑群、Office Hour、毕业留言板等丰富多样的活动形式，为 Mentor 与 Mentee 提供更加灵活的参与方式，并覆盖从职场与学业发展到个人成长与生活议题的广泛主题。「她行」希望为她们搭建一个安全、开放且自由的线上交流空间。
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2, lineHeight: 1.8 }}>
            如果你想进一步仔细了解这五年中我们的成长与收获，欢迎阅读
            <Link
              href="https://mp.weixin.qq.com/s/ua59edv5VfuM3ApTO1OtEw"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mx: 1, fontWeight: 600 }}
            >
              「她行」五周年报告
            </Link>
            。
          </Typography>
        </Box>

        <Divider sx={{ my: { xs: 1, md: 2 } }} />

        <Stack spacing={{ xs: 3, md: 3.5 }}>
          {[...programs].reverse().map((program) => (
            <Tooltip
              key={program.title}
              title="了解更多"
              arrow
              followCursor
              placement="bottom-start"
              slotProps={{
                popper: {
                  modifiers: [
                    {
                      name: 'offset',
                      options: {
                        offset: [12, 12]
                      }
                    }
                  ]
                },
                tooltip: {
                  sx: {
                    borderRadius: 2,
                    fontWeight: 600,
                    px: 1.5,
                    py: 1,
                    bgcolor: '#fff',
                    color: 'text.primary',
                    border: '1px solid',
                    borderColor: 'primary.main',
                    boxShadow: 2,
                    '& .MuiTooltip-arrow': {
                      color: '#fff',
                      '&::before': {
                        border: '1px solid',
                        borderColor: 'primary.main'
                      }
                    }
                  }
                }
              }}
            >
              <Box
                component="a"
                href={program.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block'
                }}
              >
                <Card sx={{ p: 1.5, cursor: 'pointer' }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography fontSize={24} aria-hidden>
                        {program.icon}
                      </Typography>
                      <Typography variant="h6" fontWeight={700} lineHeight={1.4}>
                        {program.title}
                      </Typography>
                    </Stack>
                    <Chip
                      label={program.keywords}
                      color="primary"
                      variant="outlined"
                      sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
                    />
                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                      {program.description}
                    </Typography>
                  </Stack>
                </Card>
              </Box>
            </Tooltip>
          ))}
        </Stack>
      </Stack>
    </SectionContainer>
  );
};

export default PastProgramsPage;
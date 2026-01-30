import { PastProgramCardData } from '@/types/home';

export const pastProgramsIntro = '「她行」的Mentorship活动在聚焦于理工科女性的职业成长的同时, 也搭建了一个个温暖的女性社群';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const pastProgramCards: PastProgramCardData[] = [
  { imageSrc: `${basePath}/images/past_program_image_1.png`, title: '她行2025夏季项目总结', url: 'https://mp.weixin.qq.com/s/oM5o0hvfkN5hfT31Gzg9Iw' },
  { imageSrc: `${basePath}/images/past_program_image_2.png`, title: '她行五年，感谢有你', url: 'https://mp.weixin.qq.com/s/ua59edv5VfuM3ApTO1OtEw' },
  { imageSrc: `${basePath}/images/past_program_image_3.png`, title: '从实习到跳槽，你的职场成长全攻略！', url: 'https://mp.weixin.qq.com/s/Ygmn70p2NIWALMyfKKZegw' },
];

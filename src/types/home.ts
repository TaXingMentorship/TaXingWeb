import { SvgIconComponent } from '@mui/icons-material';

export interface MediaIcon {
  iconSrc: string;
  text: string;
  redirectUrl: string;
}

export interface OverviewData {
  iconSrc: SvgIconComponent;
  field: string;
  value: string;
}

export interface PastProgramCardData {
  imageSrc: string;
  title: string;
  url: string;
}
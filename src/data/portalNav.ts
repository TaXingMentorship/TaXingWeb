import type { SvgIconComponent } from "@mui/icons-material";
import HomeIcon from "@mui/icons-material/Home";
import PersonIcon from "@mui/icons-material/Person";
import EventIcon from "@mui/icons-material/Event";
import GroupsIcon from "@mui/icons-material/Groups";
import InsightsIcon from "@mui/icons-material/Insights";
import ForumIcon from "@mui/icons-material/Forum";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ListAltIcon from "@mui/icons-material/ListAlt";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { Profile } from "@/types/portal";
import { portalCopy } from "./portalCopy";

export type PortalNavAccess = "all" | "participant" | "admin";

export type PortalNavItem = {
  label: string;
  path: string;
  /** The component, not an element — each surface sizes and colours it. */
  Icon: SvgIconComponent;
  access: PortalNavAccess;
  /** Only the portal home tiles use this. */
  description: string;
  /** The home page does not link to itself. */
  showOnHome?: boolean;
};

/**
 * Single source of truth for portal navigation, shared by the sidebar
 * (PortalShell) and the landing tiles (/portal). These used to be two separate
 * arrays with the same shape and the same filter, so every new page had to be
 * added twice — and 季度管理 was duly missed on the home page.
 */
export const portalNavItems: PortalNavItem[] = [
  {
    label: portalCopy.nav.home,
    path: "/portal",
    Icon: HomeIcon,
    access: "all",
    description: "门户首页。",
    showOnHome: false,
  },
  {
    label: portalCopy.nav.me,
    path: "/portal/me",
    Icon: PersonIcon,
    access: "all",
    description: "完善个人资料，填写微信号方便联系。",
  },
  {
    label: portalCopy.nav.activities,
    path: "/portal/activities",
    Icon: EventIcon,
    access: "all",
    description: "查看重要文件、主线与支线活动安排。",
  },
  {
    label: portalCopy.nav.directory,
    path: "/portal/directory",
    Icon: GroupsIcon,
    access: "all",
    description: "浏览本期的导师与学员，按兴趣搜索。",
  },
  {
    label: portalCopy.nav.progress,
    path: "/portal/admin/sessions",
    Icon: InsightsIcon,
    access: "participant",
    description: "记录辅导场次，学员可提交活动记录。",
  },
  {
    label: portalCopy.nav.board,
    path: "/portal/board",
    Icon: ForumIcon,
    access: "all",
    description: "发布求助、感谢与成长打卡。",
  },
  {
    label: portalCopy.nav.cohorts,
    path: "/portal/admin/cohorts",
    Icon: CalendarMonthIcon,
    access: "admin",
    description: "新建季度、修改名称与起止日期、开关留言板。",
  },
  {
    label: portalCopy.nav.roster,
    path: "/portal/admin/roster",
    Icon: ListAltIcon,
    access: "admin",
    description: "查看成员信息、辅导场次与活动记录。",
  },
  {
    label: portalCopy.nav.adminImport,
    path: "/portal/admin/import",
    Icon: UploadFileIcon,
    access: "admin",
    description: "上传 CSV 批量导入导师与学员。",
  },
];

/**
 * Whether a signed-in profile may reach a nav entry. This is presentation
 * only — every page also checks server-side, and RLS is the real boundary.
 */
export function canAccessPortalNav(
  item: PortalNavItem,
  profile: Profile | null,
): boolean {
  if (!profile) return false;
  if (item.access === "all") return true;
  if (item.access === "admin") return profile.is_admin;
  return profile.is_admin || Boolean(profile.participant_role);
}

import type { BulletinCategory, SessionType, UserRole } from "@/types/portal";

/** Centralized Simplified-Chinese copy for the portal prototype. */

export const roleLabels: Record<UserRole, string> = {
  admin: "管理员",
  mentor: "导师",
  mentee: "学员",
};

export const sessionTypeLabels: Record<SessionType, string> = {
  mentorship: "Mentorship 交流",
  gratitude: "感谢赠言",
};

export const sessionTypeColors: Record<SessionType, "primary" | "secondary"> = {
  mentorship: "primary",
  gratitude: "secondary",
};

export const categoryLabels: Record<BulletinCategory, string> = {
  wish: "寻求帮助",
  thanks: "感谢",
  growth: "成长打卡",
  other: "其他",
};

export const categoryColors: Record<
  BulletinCategory,
  "primary" | "secondary" | "success" | "default"
> = {
  wish: "primary",
  thanks: "secondary",
  growth: "success",
  other: "default",
};

export const portalCopy = {
  brand: "她行 · Mentorship",
  prototypeBadge: "原型演示（示例数据）",
  nav: {
    home: "首页",
    directory: "成员目录",
    me: "我的资料",
    board: "留言板",
    activities: "本期活动",
    progress: "进度跟踪",
    roster: "成员名单",
    adminImport: "名单导入",
    adminSessions: "进度跟踪",
  },
  activities: {
    title: "本期活动",
    subtitle: "本期活动的重要文件与活动安排。",
    sections: {
      files: "重要文件",
      main: "主线活动",
      side: "支线活动",
    },
    empty: "内容即将上线，敬请期待。",
  },
  board: {
    title: "留言板",
    listSubtitle: "选择一个留言板进入查看与发布留言。",
    createButton: "新建留言板",
    createTitle: "新建留言板",
    nameLabel: "留言板名称",
    descriptionLabel: "简介（可选）",
    openLabel: "开放发布（关闭后仅可浏览）",
    postCount: "条留言",
    closed: "仅浏览",
    backToList: "返回留言板列表",
    empty: "当前还没有留言板。",
    adminOnlyCreate: "只有管理员可以新建留言板。",
  },
  account: {
    switcher: "切换演示身份",
    loggedInAs: "当前身份",
    reset: "重置演示数据",
    resetConfirm: "确定要重置所有演示数据吗？所有改动将被清除。",
  },
} as const;

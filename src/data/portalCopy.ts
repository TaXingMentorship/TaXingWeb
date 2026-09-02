import type {
  BulletinCategory,
  BulletinColor,
  ParticipantRole,
  Profile,
  SessionType,
  UserRole,
} from "@/types/portal";

/** Centralized Simplified-Chinese copy for the portal. */

export const roleLabels: Record<UserRole, string> = {
  admin: "管理员",
  mentor: "导师",
  mentee: "学员",
};

export const participantRoleLabels: Record<ParticipantRole, string> = {
  mentor: "导师",
  mentee: "学员",
};

export function profileLabels(
  profile: Pick<Profile, "participant_role" | "is_admin" | "is_volunteer">,
): string[] {
  return [
    profile.participant_role
      ? participantRoleLabels[profile.participant_role]
      : null,
    profile.is_admin ? roleLabels.admin : null,
    profile.is_volunteer ? "志愿者" : null,
  ].filter((label): label is string => Boolean(label));
}

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
  question: "提问",
  feedback: "反馈与建议",
  expectation: "期待",
  reflection: "感想",
  other: "其他",
};

export const categoryColors: Record<
  BulletinCategory,
  "primary" | "secondary" | "success" | "info" | "warning" | "default"
> = {
  wish: "primary",
  thanks: "secondary",
  growth: "success",
  question: "info",
  feedback: "warning",
  expectation: "info",
  reflection: "secondary",
  other: "default",
};

export const allCategories: BulletinCategory[] = [
  "question",
  "feedback",
  "expectation",
  "reflection",
  "wish",
  "thanks",
  "growth",
  "other",
];

/**
 * Card backgrounds for bulletin posts. Colour is personal expression only —
 * the category chip carries the meaning — so nothing is lost when a reader
 * cannot distinguish these. Body text stays at `text.primary`, and every
 * background here clears WCAG AA against it. The theme is light-only
 * (`src/theme.ts`), so no dark variants are needed.
 */
export const postColors: Record<
  BulletinColor,
  { label: string; bg: string; border: string }
> = {
  default: { label: "白色", bg: "#FFFFFF", border: "#E4E4E7" },
  yellow: { label: "暖黄", bg: "#FFF6E0", border: "#F5D48A" },
  pink: { label: "粉色", bg: "#FDECF1", border: "#F1B9CB" },
  blue: { label: "蓝色", bg: "#E9F2FD", border: "#A9CBF0" },
  green: { label: "绿色", bg: "#EAF6EC", border: "#A8D8B2" },
  purple: { label: "紫色", bg: "#F1EDFA", border: "#C3B4E6" },
  orange: { label: "橙色", bg: "#FDEEE3", border: "#F2BE95" },
};

export const postColorOrder: BulletinColor[] = [
  "default",
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
  "orange",
];

/**
 * Reactions members can leave on a post. Must stay in sync with the check
 * constraint on `bulletin_reactions.emoji`
 * (supabase/migrations/0006_bulletin_padlet.sql).
 */
export const reactionEmojis = ["❤️", "👍", "🎉", "🤝", "💡", "🥺"] as const;

/** Emoji offered by the composer's picker, grouped for the popover. */
export const emojiPickerGroups: { label: string; emojis: string[] }[] = [
  {
    label: "心情",
    emojis: [
      "😀", "😊", "🥹", "🥰", "😍", "🤩", "😌", "😴",
      "🤔", "😅", "😭", "🥺", "😤", "😳", "🙃", "😎",
    ],
  },
  {
    label: "手势与人物",
    emojis: [
      "👍", "👏", "🙌", "🙏", "🤝", "💪", "✌️", "🫶",
      "👩‍💻", "👩‍🔬", "👩‍🎓", "🧑‍🤝‍🧑", "👭", "🫂", "🚺", "💃",
    ],
  },
  {
    label: "心意",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "💖", "✨",
      "🌸", "🌷", "🌻", "🍀", "🌈", "☀️", "🌙", "⭐",
    ],
  },
  {
    label: "活动",
    emojis: [
      "🎉", "🎊", "🎓", "🏆", "🔥", "💡", "📚", "✏️",
      "💼", "🚀", "🎯", "📈", "☕", "🍰", "🎁", "📌",
    ],
  },
];

export const portalCopy = {
  brand: "她行 · Mentorship",
  prototypeBadge: "2026 Autumn",
  nav: {
    home: "首页",
    directory: "成员目录",
    me: "我的资料",
    board: "留言板",
    activities: "本期活动",
    progress: "进度跟踪",
    cohorts: "季度管理",
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
    listSubtitle: "选择上方的留言板，浏览并发布你的留言。",
    createButton: "新建留言板",
    createTitle: "新建留言板",
    nameLabel: "留言板名称",
    descriptionLabel: "简介（可选）",
    promptLabel: "引导语（可选，显示在发布框里）",
    openLabel: "开放发布（关闭后仅可浏览）",
    allowAnonymousLabel: "允许匿名发布",
    allowCommentsLabel: "允许评论",
    categoriesLabel: "可选类别（不选则全部可用）",
    postCount: "条留言",
    closed: "仅浏览",
    empty: "当前还没有留言板。",
    adminOnlyCreate: "只有管理员可以新建留言板。",
    emptyWall: "还没有留言，来发布第一条吧！",
    emptyWallReadOnly: "这个留言板还没有留言。",
    loading: "加载中…",
    notFound: "找不到该留言板。",

    // Composer
    composeButton: "发布留言",
    composeTitle: "发布留言",
    titleLabel: "标题（可选）",
    bodyLabel: "想说的话",
    bodyPlaceholder: "分享你的想法…",
    categoryLabel: "类别",
    colorLabel: "卡片颜色",
    emojiButton: "插入表情",
    anonymousLabel: "匿名发布",
    // Deliberately does not promise full anonymity: `author_id` is still
    // readable through the API. See PLAN.md Phase G.
    anonymousHint: "其他成员不会看到你的名字，管理员仍可查看以便处理不当内容。",
    anonymousName: "匿名成员",
    // Cross-season authors: `profiles` stays cohort-scoped, so their name is
    // unresolvable. Must read differently from a genuinely anonymous post.
    pastMemberName: "往期成员",
    submit: "发布",
    cancel: "取消",

    // Post card
    pinned: "置顶",
    resolved: "已解答",
    hiddenChip: "已隐藏",
    reactionTooltip: "点一个表情",
    commentsToggle: "条评论",
    commentsEmpty: "还没有评论。",
    commentPlaceholder: "写下你的回复…",
    commentSubmit: "回复",
    commentsClosed: "该留言板未开启评论。",
    deleteConfirm: "确定要删除吗？删除后无法恢复。",

    // Sorting
    sortLabel: "排序",
    sortNewest: "最新",
    sortReactions: "最多反应",

    // Admin actions
    actionPin: "置顶",
    actionUnpin: "取消置顶",
    actionResolve: "标记已解答",
    actionUnresolve: "取消已解答",
    actionHide: "隐藏",
    actionUnhide: "取消隐藏",
    actionDelete: "删除",

    // Seasons
    seasonLabel: "季度",
    seasonArchivedChip: "已归档",
    seasonOpenToggle: "本季度留言板开放",

    // Gating
    volunteerReadOnly: "志愿者账号可浏览留言，但不能发布内容。",
    boardClosed: "该留言板当前已关闭，仅可浏览。",
    seasonArchived: "本季度活动已结束，留言板仅可浏览。",
    otherSeasonReadOnly: "你不是本季度的成员，可以浏览往期内容，但不能发布或互动。",
  },
  cohorts: {
    title: "季度管理",
    subtitle: "每期活动是一个季度。留言板、名单导入、配对记录都挂在季度上。",
    createButton: "新建季度",
    createTitle: "新建季度",
    editTitle: "编辑季度",
    nameLabel: "季度名称",
    startsAtLabel: "开始日期",
    endsAtLabel: "结束日期",
    bulletinOpenLabel: "留言板开放",
    unset: "未设置",
    archived: "已归档",
    memberCount: "成员",
    boardCount: "留言板",
    actions: "操作",
    edit: "编辑",
    save: "保存",
    cancel: "取消",
    empty: "还没有任何季度，先新建一个。",
    loading: "加载中…",
    adminOnly: "仅管理员可访问季度管理。",
    nameRequired: "请填写季度名称。",
    endBeforeStart: "结束日期不能早于开始日期。",
    // Deletion is intentionally absent: eight tables cascade from `cohorts`,
    // so removing one would wipe that season's entire history.
    noDeleteHint: "季度不可在此删除 —— 删除会连带清空该季度的全部留言、配对与记录。",
  },
  account: {
    switcher: "切换演示身份",
    loggedInAs: "当前身份",
    reset: "重置演示数据",
    resetConfirm: "确定要重置所有演示数据吗？所有改动将被清除。",
  },
} as const;

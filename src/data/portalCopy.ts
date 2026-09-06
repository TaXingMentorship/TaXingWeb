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
    volunteers: "志愿者名单",
    adminImport: "名单导入",
    adminVolunteers: "志愿者管理",
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
  volunteers: {
    title: "志愿者名单",
    subtitle: "她行的志愿者们，按组别与季度浏览。",
    allTab: "全部",
    myGroupHint: "我所在的组",
    searchLabel: "搜索志愿者",
    searchPlaceholder: "搜索姓名、邮箱或微信…",
    seasonLabel: "季度",
    allSeasons: "全部季度",
    columns: {
      name: "姓名",
      group: "组别",
      seasons: "季度",
      email: "邮箱",
      wechat: "微信",
      notes: "备注",
      actions: "操作",
    },
    noGroup: "未分组",
    notPublic: "不公开",
    notPublicHint: "不会出现在官网的志愿者致谢名单里",
    count: (n: number) => `共 ${n} 位志愿者`,
    empty: "没有符合条件的志愿者。",
    emptyAll: "还没有志愿者记录。管理员可以在「志愿者管理」中批量导入。",
    loading: "加载中…",

    // Create / edit dialog
    addButton: "添加志愿者",
    createTitle: "添加志愿者",
    editTitle: "编辑志愿者",
    nameLabel: "姓名",
    nameHelper: "必填。同名的两位志愿者请加上区分后缀，例如「小鱼 - 运营」。",
    emailLabel: "邮箱",
    emailHelper: "选填。批量导入时按邮箱匹配已有记录。",
    wechatLabel: "微信号",
    notesLabel: "备注",
    isPublicLabel: "在官网致谢名单中公开显示",
    seasonsLabel: "参与季度与组别",
    seasonsHelper: "至少选择一个季度。同一位志愿者在不同季度可以属于不同的组。",
    addSeason: "添加季度",
    removeSeason: "移除这个季度",
    groupPlaceholder: "未分组",
    save: "保存",
    cancel: "取消",
    nameRequired: "请填写姓名。",
    seasonRequired: "请至少选择一个季度。",
    duplicateSeason: "同一个季度只能出现一次。",

    // Deletion
    deleteButton: "删除",
    deleteTitle: "删除志愿者",
    deleteConfirm: (name: string) =>
      `确定要删除「${name}」吗？该志愿者的季度与组别记录会一并删除，且无法恢复。`,
    deleteAction: "确认删除",

    adminOnly: "仅管理员可以添加、编辑或删除志愿者。",

    // Profile linking
    linkedChip: "已关联门户账号",
    linkedHint: "姓名、邮箱与微信来自本人的门户资料，在这里不可编辑。",
    linkedProfileLink: "查看门户资料",
    unlink: "解除关联",
    unlinkTitle: "解除关联",
    unlinkConfirm: (name: string) =>
      `解除「${name}」与门户账号的关联后，名单会改回显示志愿者表里自己存的信息。稍后如果邮箱仍然一致，系统会重新自动关联。`,
    ownValueHint: (value: string) => `解除关联后会回落为「${value}」`,
    seasonGroupColumn: "季度 · 组别",
    moreSeasons: (n: number) => `+${n}`,
    seasonDetailTitle: "参与经历",
    leadLabel: "负责人",
    leadHint: "标记为该季度所在组的负责人。负责人会自动出现在战略组名单里。",
    leadChip: "负责人",
    includesLeadsHint: "本组自动包含当季所有负责人",
  },
  adminVolunteers: {
    title: "志愿者管理",
    subtitle: "批量导入志愿者名单，并维护组别。",
    adminOnly: "仅管理员可访问志愿者管理。",

    // Import
    importTitle: "批量导入",
    importIntro:
      "支持 Excel（.xlsx）与 CSV。必需的列：姓名、季度；可选的列：邮箱、微信、组别、备注、公开。",
    importSeasonHint:
      "「季度」列填一个或多个季度，用分号隔开：2025秋季;2026春季。要给每个季度单独指定组别，写成 2025秋季:运营组;2026春季:项目组。",
    importDedupeHint:
      "有邮箱的行按邮箱匹配已有记录并更新；没有邮箱的行按姓名匹配。只要有任意一行冲突，整个文件都不会写入。",
    chooseFile: "选择文件",
    downloadTemplate: "下载模板",
    templateFileName: "志愿者导入模板.csv",
    selected: (name: string, rows: number) => `已选择：${name}（${rows} 行）`,
    checking: "预检中…",
    importing: "导入中…",
    confirmImport: (rows: number) => `确认导入 ${rows} 行`,
    recheck: "重新选择文件",
    previewTitle: "预检结果",
    previewClean: "预检通过，可以导入。",
    resultTitle: "导入结果",
    willAdd: (n: number) => `新增 ${n}`,
    willUpdate: (n: number) => `更新 ${n}`,
    errorCount: (n: number) => `错误 ${n}`,
    blocked: "文件中存在冲突，本次没有写入任何数据。请按下列提示修改后重新上传。",
    added: "已新增",
    updated: "已更新",
    done: (added: number, updated: number) =>
      `导入完成：新增 ${added} 位，更新 ${updated} 位。`,

    // Groups
    groupsTitle: "组别管理",
    groupsIntro: "组别用于志愿者名单的视图切换。新增组别后会自动出现在名单页的标签栏里。",
    addGroup: "新建组别",
    createGroupTitle: "新建组别",
    editGroupTitle: "编辑组别",
    groupNameLabel: "组别名称",
    groupDescriptionLabel: "简介（可选）",
    groupSortLabel: "排序（数字越小越靠前）",
    includesLeadsLabel: "自动包含所有负责人",
    includesLeadsHelp:
      "开启后，其他组的负责人会自动出现在这个组的名单里 —— 战略组就是这样运作的。",
    groupMembers: (n: number) => `${n} 人次`,
    deleteGroupTitle: "删除组别",
    deleteGroupConfirm: (name: string) =>
      `确定要删除「${name}」吗？属于该组的志愿者不会被删除，只会变成「未分组」。`,
    groupNameRequired: "请填写组别名称。",
    groupsEmpty: "还没有组别，先新建一个。",

    // Name-match linking candidates
    matchesTitle: "待确认的账号关联",
    matchesIntro:
      "下面这些志愿者与某个门户账号同名，但邮箱对不上，所以没有自动关联 —— 同名不代表是同一个人。确认之后，他们的姓名与联系方式将以门户资料为准。",
    matchesEmpty: "没有待确认的关联。邮箱一致的志愿者会自动关联。",
    matchVolunteer: "志愿者",
    matchProfile: "门户账号",
    matchConfirm: "确认是同一人",
    matchConfirmTitle: "确认关联",
    matchConfirmBody: (v: string, p: string) =>
      `确认志愿者「${v}」就是门户账号「${p}」本人？关联后名单会改用其门户资料里的姓名与联系方式。`,
  },
  roster: {
    identityTitle: "编辑身份",
    identityHint: "导师与学员互斥；管理员与志愿者是独立的标记。",
    identityLabels: {
      mentor: "导师",
      mentee: "学员",
      admin: "管理员",
      volunteer: "志愿者",
    },
    identityNone: "暂无身份",
    identityRequired: "每位成员至少需要一种身份。",
    identitySelfAdminWarning:
      "这会移除你自己的管理员身份，之后你将无法再打开这个页面。",
    save: "保存",
    cancel: "取消",
    editIdentity: (name: string) => `编辑「${name}」的身份`,
  },
  persona: {
    label: "当前视角",
    switchTo: "切换视角",
    options: {
      admin: "管理员",
      mentor: "导师",
      mentee: "学员",
      volunteer: "志愿者",
    },
    primaryHint: "我的身份",
    back: "回到我的身份",
  },
  account: {
    switcher: "切换演示身份",
    loggedInAs: "当前身份",
    reset: "重置演示数据",
    resetConfirm: "确定要重置所有演示数据吗？所有改动将被清除。",
  },
} as const;

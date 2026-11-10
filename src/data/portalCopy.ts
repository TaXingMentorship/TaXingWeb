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
  admin: "负责人",
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
  auth: {
    /** Shown at login, and after the middleware ends a banned session. */
    accountBanned: "该账号已被封禁，如需解封请联系她行志愿者。",
  },
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
    adminImport: "成员导入",
    adminSessions: "进度跟踪",
    tasks: "我的任务",
    adminTasks: "任务管理",
    dashboard: "数据看板",
  },
  tasks: {
    title: "我的任务",
    subtitle: "请查收活动任务📮，处理完后记得标记完成哦！",
    pendingTab: "待办",
    doneTab: "已完成",
    empty: "暂时没有待办任务。",
    emptyDone: "还没有完成过的任务。",
    loading: "加载中…",
    go: "去处理",
    markDone: "标记完成",
    reopen: "重新打开",
    dueOn: (date: string) => `截止 ${date}`,
    overdue: "已逾期",
    completedAt: (date: string) => `完成于 ${date}`,
    // Home-page reminder card
    reminderTitle: "待办提醒",
    reminderCount: (n: number) => `你有 ${n} 项待办任务`,
    reminderAll: "查看全部",
    badgeNew: "新任务",
    badgeUpdated: "已更新",
  },
  adminTasks: {
    title: "任务管理",
    subtitle: "给志愿者、导师或学员分配任务，她们会在门户首页和「我的任务」里收到提醒。",
    adminOnly: "仅负责人可访问任务管理。",
    newButton: "新建任务",
    empty: "还没有分配过任务。",
    loading: "加载中…",
    columns: {
      title: "任务",
      recipients: "接收人",
      progress: "完成情况",
      due: "截止",
      created: "创建时间",
      actions: "操作",
    },
    progress: (done: number, total: number) => `${done} / ${total} 已完成`,
    noAccount: (n: number) => `${n} 人尚未开通门户`,
    noDue: "无",
    editButton: "编辑",
    deleteButton: "删除",
    deleteTitle: "删除任务",
    deleteConfirm: (title: string) =>
      `确定要删除「${title}」吗？所有接收人的这条任务和完成记录都会一并删除。`,
    deleteAction: "确认删除",
    cancel: "取消",

    // Recipients detail
    detailTitle: "完成情况",
    statusDone: "已完成",
    statusPending: "待办",
    statusNoAccount: "未开通门户",
    statusNoAccountHint: "开通门户账号后就会看到这条任务，不需要重新分配。",

    // Create dialog
    createTitle: "新建任务",
    editTitle: "编辑任务",
    editLockedHint: "已有的接收人不能移除，只能新增；季度不能修改。",
    notifyAllLabel: "通知所有人（包括已完成的人）",
    notifyAllHint: "已完成的人会再次看到「已更新」标记，完成状态保留。",
    saveEdit: "保存修改",
    editPreview: (added: number, contentChanged: boolean, pending: number, done: number, notifyAll: boolean) =>
      [
        added > 0 ? `新增 ${added} 人将收到提醒。` : "没有新增接收人。",
        contentChanged
          ? `内容已修改，${pending} 位未完成的人将收到更新提醒。`
          : "内容没有修改，不会提醒已有的接收人。",
        notifyAll
          ? `已完成的 ${done} 人也会收到提醒。`
          : done > 0
            ? `已完成的 ${done} 人不受影响。`
            : "",
      ]
        .filter(Boolean)
        .join(""),
    presetLabel: "常用任务",
    presetCustom: "自定义",
    presets: [
      {
        key: "volunteer-profile",
        title: "完善志愿者信息",
        description: "请到「我的资料」检查你的昵称、微信号，并确认参与季度与所在组别是否正确。",
        link: "/portal/me",
      },
      {
        key: "profile",
        title: "完善个人资料",
        description: "请到「我的资料」补充你的简介、领域与兴趣方向，方便导师或学员了解你。",
        link: "/portal/me",
      },
      {
        key: "sessions",
        title: "上传交流记录",
        description: "请到「进度跟踪」记录最近的交流场次或提交活动记录。",
        link: "/portal/admin/sessions",
      },
    ],
    titleLabel: "任务标题",
    descriptionLabel: "任务说明",
    linkLabel: "跳转链接",
    linkPlaceholder: "选择页面，或输入门户内路径",
    linkHelper: "选填。从列表里选一个页面，也可以直接输入门户内的路径（如 /portal/me）；接收人点「去处理」会跳转过去。",
    dueLabel: "截止日期",
    recipientsLabel: "接收人",
    recipientModeLabel: "选择方式",
    recipientGroups: {
      volunteers: "志愿者",
      members: "导师与学员",
    },
    recipientModes: {
      individuals: "指定志愿者",
      group: "某季度的一个组",
      season: "某季度全部志愿者",
      members: "指定成员",
      mentors: "某季度全部导师",
      mentees: "某季度全部学员",
      participants: "某季度全部导师与学员",
    },
    seasonLabel: "季度",
    allSeasons: "全部季度",
    seasonFilterHelper: "只列出该季度参与过的人；换季度后，不属于新季度的已选人员会被移除。",
    groupLabel: "组别",
    volunteersLabel: "志愿者",
    volunteersPlaceholder: "搜索姓名…",
    membersLabel: "成员",
    membersPlaceholder: "搜索姓名…",
    previewCount: (n: number) => `将分配给 ${n} 人`,
    previewNoAccount: (n: number) =>
      `其中 ${n} 位志愿者还没有开通门户账号，暂时看不到提醒；开通后会自动看到。`,
    previewEmpty: "还没有选择接收人。",
    previewDynamicEmpty: "当前没有符合条件的成员。",
    previewDynamicVolunteers: "之后被加入该季度（或该组）的志愿者（导入或手动添加）也会自动收到，包括任务过期后加入的人。",
    previewDynamic: "之后加入该季度且身份符合的导师或学员也会自动收到，包括任务过期后加入的人。",
    titleRequired: "请填写任务标题。",
    dueRequired: "请选择截止日期。",
    recipientsRequired: "请至少选择一位接收人。",
    create: "创建并分配",
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
    subItems: {
      add: "添加子活动",
      open: "打开",
      meeting: "会议链接",
      /** Meeting button by provider, e.g. 加入飞书会议. */
      joinMeeting: (provider: string) => `加入${provider}`,
      providers: {
        feishu: "飞书会议",
        tencent: "腾讯会议",
        zoom: "Zoom",
      },
      meetingPending: "会议链接待更新",
      /** A session with no link of its own, in a row with a 总表 link. */
      sheet: (app: string | null) => (app ? `查看${app}总表` : "查看总表"),
      openIn: (app: string | null) => (app ? `在${app}打开` : "打开"),
      docApps: {
        feishu: "飞书",
        tencentDocs: "腾讯文档",
      },
      recording: "观看录屏",
      recordingPending: "录屏整理中",
      status: {
        upcoming: "即将开始",
        live: "进行中",
        past: "已结束",
      },
      edit: "编辑",
    },
    itemDialog: {
      createTitle: (parent: string) => `添加到「${parent}」`,
      editTitle: (parent: string) => `编辑「${parent}」的子活动`,
      kindLabel: "类型",
      kinds: {
        session: "场次（时间、主题、录屏）",
        link: "链接（如腾讯文档）",
      },
      linkTitleLabel: "标题",
      linkTitlePlaceholder: "答疑组时间与分组表",
      urlLabel: "链接",
      urlPlaceholder: "https://docs.qq.com/sheet/...",
      linkSummaryLabel: "一句话说明（选填）",
      startsAtLabel: "时间",
      startsAtHelper: "按你所在地的时间填写，成员看到的会换算成各自的时区。",
      placedIn: (row: string) => `这个时间属于「${row}」，保存后会放在那一行下面。`,
      outOfRange: (ranges: string) => `这个时间不在本活动的日期内（北京时间 ${ranges}），请检查日期。`,
      sessionTitleLabel: "主题",
      summaryLabel: "分享内容简介（选填）",
      summaryPlaceholder: "嘉宾、聊什么、适合谁来",
      meetingUrlLabel: "会议链接（选填）",
      recordingUrlLabel: "录屏链接（选填，结束后再补）",
      titleRequired: "请填写标题。",
      urlRequired: "请填写链接。",
      startsAtRequired: "请选择时间。",
      urlInvalid: "请填写完整的链接，以 http:// 或 https:// 开头。",
      cancel: "取消",
      save: "保存",
      delete: "删除",
      deleteConfirm: "确定删除这条子活动吗？删除后无法恢复。",
    },
    /** The button on each 重要文件 entry. */
    openPdf: "PDF",
    timelineHeading: (range: string) => `2026 秋季项目时间线 · ${range}`,
    upNext: {
      title: "接下来",
      more: (n: number) => `之后还有 ${n} 场`,
    },
    browse: {
      showPast: (n: number) => `已结束 ${n} 场`,
      hidePast: "收起已结束",
      showMore: (n: number) => `展开其余 ${n} 场`,
      showLess: "收起",
      details: "简介",
      zoneNote: (zone: string) => `时间按你所在时区显示（${zone}）`,
      rowPhase: {
        current: "进行中",
        past: "已结束",
        upcoming: "未开始",
      },
    },
    calendar: {
      weekdays: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
      today: "今天",
      hint: "点击场次查看简介和会议链接；右侧有摄像机图标的场次已经可以加入会议。",
      hintWithSheet: "会议链接请看上方总表；点击场次查看简介。",
      viewCalendar: "日历",
      viewList: "列表",
    },
    datesDialog: {
      edit: "修改活动时间",
      title: (row: string) => `修改「${row}」的时间`,
      fromLabel: "开始日期",
      toLabel: "结束日期",
      weekLabel: "周次标签",
      weekPlaceholder: "Week 5–7",
      helper: "按北京时间填写，含首尾两天。",
      defaults: (range: string, week: string) => `默认：${range} · ${week}`,
      rangeInvalid: "结束日期不能早于开始日期。",
      required: "请填写开始日期、结束日期和周次标签。",
      outside: (n: number) =>
        `这一行下有 ${n} 场不在新的日期内。已添加的场次不会自动移动，保存后它们仍显示在这一行。`,
      reset: "恢复默认",
      cancel: "取消",
      save: "保存",
    },
  },
  mascot: {
    name: "小萤",
    greeting: "遇到问题，或者有想法？来留言板告诉我吧～",
    bubbleTitle: "发现 Bug 了吗？",
    bubbleBody: "页面哪里不对劲、哪里不好用，都可以到秋季留言板告诉我们。",
    feedbackAction: "去留言板反馈",
    tasksLeft: (count: number) => `头顶的叶子是你还没完成的 ${count} 项任务。`,
    tasksLink: "去看看",
    tasksDone: "任务都完成啦，叶子都落光了 🍂",
    later: "稍后再说",
    hide: "收起",
    show: "展开小萤",
    ariaLabel: "反馈小助手",
    dragHint: "可以拖动小萤到任意位置，双击让她回到右下角",
  },
  boardReplies: {
    title: (n: number) => `你参与的留言有 ${n} 条新评论`,
    newComments: (n: number) => `${n} 条新评论`,
    go: "去查看",
    more: (n: number) => `还有 ${n} 条留言有新评论`,
    chip: (n: number) => `${n} 条新评论`,
    collapse: "收起",
  },
  /** 成员目录 → 志愿者: a group shows two rows of five, then 「+N」. */
  volunteerDirectory: {
    hiddenCount: (n: number) => `还有 ${n} 位成员未显示`,
    showAll: "展开全部",
    showLess: "收起",
  },
  mentorGroups: {
    columnLabel: "答疑组",
    unassigned: "未分组",
    unassignedCount: (n: number) => `未分组 ${n} 位`,
    /** The group number on a directory card chip, e.g. 「组2」. */
    numberChip: (n: string) => `组${n}`,
    manageButton: "管理答疑组",
    dialogTitle: "管理答疑组",
    dialogHint: "按季度设置 mentor 答疑组。每位 mentor 每个季度只属于一个组，但可以回答任何组的问题。",
    none: "这个季度还没有答疑组。",
    directionLabel: "方向",
    directionPlaceholder: "产品经理",
    nameLabel: "组名",
    namePlaceholder: "产品经理 组2",
    orderLabel: "排序",
    memberCount: (n: number) => `${n} 人`,
    add: "添加",
    close: "完成",
    delete: "删除答疑组",
    deleteConfirm: (name: string, count: number) =>
      `确定删除「${name}」？组内 ${count} 位 mentor 将变为未分组，已发的帖子会保留但不再属于任何组。`,
    selectedCount: (n: number) => `已选 ${n} 位`,
    bulkAssign: "批量分到…",
    bulkClear: "移出答疑组",
    selectAll: "全选 mentor",
  },
  mentorGroupChange: {
    fieldLabel: (season: string) => `答疑组 · ${season}`,
    unassigned: "未分组",
    lockedHint: "答疑组由负责人分配，如需调整请提交申请并写明理由。",
    previewHint: "你正在预览视角，只有这个季度的 mentor 本人才能提交申请。",
    requestButton: "申请调整",
    dialogTitle: "申请调整答疑组",
    currentLabel: "当前答疑组",
    newGroupLabel: "想调整到",
    reasonLabel: "申请理由",
    reasonHint: "请说明为什么要调整，方便负责人审核。",
    submit: "提交申请",
    cancel: "取消",
    withdraw: "撤回申请",
    pending: (name: string) => `审核中：申请调整到「${name}」，请等待负责人处理。`,
    approved: (name: string) => `你的答疑组调整已通过，现在是「${name}」。`,
    rejected: (name: string, note: string) =>
      `你调整到「${name}」的申请未通过：${note}`,
    reviewTitle: "答疑组调整申请",
    reviewRow: (who: string, season: string, from: string, to: string) =>
      `${who}（${season}）：${from} → ${to}`,
    reasonPrefix: "理由：",
    approve: "通过",
    reject: "拒绝",
    rejectDialogTitle: "拒绝申请",
    rejectNoteLabel: "拒绝原因",
    rejectNoteHint: "必填，申请人会看到这段话。",
    confirmReject: "确认拒绝",
  },
  /** 成员收藏 (migration 0036). */
  favorites: {
    add: "收藏",
    remove: "取消收藏",
    onlyFavorites: (count: number) => `只看收藏（${count}）`,
    noneInTab: "这个分类下还没有收藏的成员。",
    homeTitle: (count: number) => `我收藏的成员（${count}）`,
    homeAll: "去成员目录",
    failed: "操作失败，请稍后重试。",
  },
  directoryFilters: {
    searchPlaceholder: "搜索姓名、简介或兴趣",
    mentorSearchPlaceholder: "搜索姓名、简介、兴趣或答疑组",
    interestPlaceholder: "按兴趣筛选",
    groupLabel: "答疑组",
    allGroups: "全部答疑组",
    groupOption: (name: string, count: number) => `${name}（${count}）`,
  },
  /** 目录页「导出」: a CSV of the mentors shown, for mentees without outside access. */
  directoryExport: {
    button: "导出 CSV",
    scopeHint: (count: number, season: string) =>
      `导出 ${season} 当前筛选出的 ${count} 位导师。`,
    failed: "导出失败，请稍后重试。",
    /** One label per ProfileDialog field; also the CSV column headers. */
    fields: {
      name: "姓名",
      field: "领域",
      bio: "简介",
      background: "学术经历 / 行业经历",
      yearsExperience: "工作年限",
      menteeCapacity: "可以帮助的 mentee 数量",
      menteeExpectations: "对 mentee 的期望",
      topics: "擅长与不擅长的话题",
      qaIntro: "答疑组自我介绍",
      qaTopic: "本次分享的主题",
      canHelp: "我能帮上什么",
      interests: "兴趣方向",
      group: "答疑组",
      linkedin: "LinkedIn",
    },
  },
  board: {
    title: "留言板",
    listSubtitle: "选择下方的留言板，浏览并发布你的留言。",
    createButton: "新建留言板",
    createSeasonHelp: "新留言板归属的季度。还没有留言板的季度也可以选。",
    createTitle: "新建留言板",
    createAction: "创建",
    editButton: "编辑留言板",
    editTitle: "编辑留言板",
    editSeasonHelp: "留言板所属季度不可更改。",
    saveAction: "保存",
    deleteButton: "删除留言板",
    deleteBoardTitle: "删除留言板",
    deleteBoardConfirm: (name: string, count: number) =>
      `确定删除「${name}」？其中 ${count} 条留言及全部评论、表情将一并删除，无法恢复。`,
    deleteBoardAction: "删除",
    nameLabel: "留言板名称",
    descriptionLabel: "简介（可选）",
    promptLabel: "引导语（可选，显示在发布框里）",
    openLabel: "开放发布（关闭后仅可浏览）",
    allowAnonymousLabel: "允许匿名发布",
    allowCommentsLabel: "允许评论",
    pinBoardLabel: "置顶留言板（显示在普通留言板前）",
    pinnedBoard: "已置顶留言板",
    categoriesLabel: "可选类别（不选则全部可用）",
    postCount: "条留言",
    closed: "仅浏览",
    empty: "当前还没有留言板。",
    adminOnlyCreate: "只有负责人可以新建留言板。",
    emptyWall: "还没有留言，来发布第一条吧！",
    emptyWallReadOnly: "这个留言板还没有留言。",
    loading: "加载中…",
    notFound: "找不到该留言板。",

    // Composer
    composeButton: "发布留言",
    composeTitle: "发布留言",
    editPostTitle: "修改留言",
    editSave: "保存修改",
    editHint: "图片和匿名设置发布后不能修改。",
    actionEdit: "编辑",
    edited: "已编辑",
    editedAt: (time: string) => `编辑于 ${time}`,
    commentSave: "保存",
    titleLabel: "标题（可选）",
    bodyLabel: "想说的话",
    bodyPlaceholder: "分享你的想法…",
    categoryLabel: "类别",
    colorLabel: "卡片颜色",
    emojiButton: "插入表情",
    addImageButton: "添加图片",
    imageLimitReached: "最多添加 4 张图片。",
    removeImage: "移除图片",
    anonymousLabel: "匿名发布",
    // Deliberately does not promise full anonymity: `author_id` is still
    // readable through the API. See PLAN.md Phase G.
    anonymousHint: "其余活动参加者不可见，仅负责人可见，以便处理不当内容。",
    anonymousHintQa: "其余活动参加者不可见，仅负责人可见，以便处理不当内容。",
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
    viewProfile: "查看资料",
    commentsToggle: "条评论",
    commentsEmpty: "还没有评论。",
    commentPlaceholder: "写下你的回复…",
    commentSubmit: "回复",
    commentsClosed: "该留言板未开启评论。",
    deleteConfirm: "确定要删除吗？删除后无法恢复。",

    // Mentor Q&A groups (boards with use_groups)
    useGroupsLabel: "答疑板（帖子归属 mentor 答疑组）",
    groupMine: "我的提问",
    groupMineHint: "你发过的帖子，包括匿名的。匿名帖的作者仅你自己和负责人可见。",
    groupMineEmpty: "你还没有提过问。",
    groupNavEmpty: "这个季度还没有设置答疑组。",
    groupUngrouped: "未分组",
    groupUngroupedHint: "没有归入任何答疑组的帖子：答疑板开启前发的，或所在的组已被删除。",
    groupUngroupedEmpty: "没有未分组的帖子。",
    groupMentorCount: (n: number) => `${n} 位 mentor`,
    groupNoMentors: "本组还没有 mentor。",
    groupAskTitle: "提问到哪个组",
    groupRequired: "请选择一个答疑组。",
    groupAskInGroup: (name: string) => `去 ${name} 提问`,
    groupChip: (name: string) => `答疑组 · ${name}`,
    groupEmpty: "这个组还没有留言。看看上面的留言须知，发出第一个问题吧。",
    mentorBadge: "Mentor",
    mentorReplied: "mentor 已回复",
    mentorAnonymousBlocked: "答疑板上 mentor 的评论需要实名。",
    mentorCardMore: "查看完整资料",
    searchPlaceholder: "搜索所有组的问题、回答、mentor 姓名",
    searchResults: (q: string, n: number, groups: number) =>
      `搜索「${q}」· ${n} 条结果，来自 ${groups} 个组`,
    searchEmpty: "没有找到相关内容。换个关键词，或到对应的组直接提问。",
    searchAllGroups: "全部组",
    searchMentorIn: (name: string, group: string) => `mentor ${name} 在 ${group}`,
    searchGoToGroup: "前往该组",
    noticeGuideTitle: "留言须知",
    noticeGuideEmpty: "还没有留言须知。",
    noticeGuideEdit: "编辑须知",
    noticeReminderTitle: "志愿者提醒",
    noticeReminderAdd: "发布提醒",
    noticeReminderPlaceholder: "例如：本周四 20:00 前提问，mentor 会在周五集中回复。",
    noticeGuidePlaceholder: "怎么提问、谁来回复、匿名规则…",
    noticeDismiss: "关闭提醒",
    noticeExpired: "已过期（仅负责人可见）",
    noticeDelete: "删除",
    noticeSave: "保存",

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
    boardClosed: "该留言板当前已关闭，仅可浏览。",
    seasonArchived: "本季度活动已结束，留言板仅可浏览。",
    otherSeasonReadOnly: "你不是本季度的成员，可以浏览往期内容，但不能发布或互动。",
  },
  cohorts: {
    title: "季度管理",
    subtitle:
      "每期活动是一个季度。留言板、名单导入、配对记录都挂在季度上。人数按人去重：同一个人只算一次，同时是导师和志愿者会出现在两列里，但总人数里只有一个。",
    createButton: "新建季度",
    createTitle: "新建季度",
    editTitle: "编辑季度",
    nameLabel: "季度名称",
    startsAtLabel: "开始日期",
    endsAtLabel: "结束日期",
    bulletinOpenLabel: "留言板开放",
    unset: "未设置",
    archived: "已归档",
    mentorCount: "导师",
    mentorCountHint: "有门户账号、且加入了该季度的导师。",
    menteeCount: "学员",
    menteeCountHint: "有门户账号、且加入了该季度的学员。",
    volunteerCount: "志愿者",
    volunteerCountHint:
      "志愿者名单里参与了该季度的人（不要求有门户账号），加上该季度账号标了志愿者的人。",
    totalCount: "总人数",
    totalCountHint:
      "该季度的不重复人数。一个人同时是导师和志愿者只算一次，所以不等于前几列相加。",
    uncategorisedCount: "未分类",
    uncategorisedCountHint:
      "加入了该季度、有账号，但既不是导师、学员，也不是志愿者的人（例如只有管理员身份）。",
    boardCount: "留言板",
    actions: "操作",
    edit: "编辑",
    save: "保存",
    cancel: "取消",
    empty: "还没有任何季度，先新建一个。",
    loading: "加载中…",
    adminOnly: "仅负责人可访问季度管理。",
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
    noGroupTab: "未分组",
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
    emptyAll: "还没有志愿者记录。负责人可以在「志愿者管理」中批量导入。",
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
    publicHint: "会出现在官网的志愿者致谢名单里",
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

    adminOnly: "仅负责人可以添加、编辑或删除志愿者。",

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

    // Self-service change log, shown to admins in the edit dialog
    changesTitle: "组别修改记录",
    changesHint: "志愿者本人在「我的资料」里做的修改。",
    changesEmpty: "暂无修改记录。",
    changeLine: (from: string, to: string) => `${from} → ${to}`,
  },
  myVolunteer: {
    title: "志愿者信息",
    subtitle: "你参与过的季度与所在的组别。可以修改组别；新增或移除季度请联系负责人。",
    noRecord: "还没有关联到你的志愿者记录，请联系负责人。",
    seasonColumn: "季度",
    groupColumn: "组别",
    noGroup: "未分组",
    leadChip: "负责人",
    leadHint: "负责人必须属于一个组别。",
    saved: "组别已更新",
    loading: "加载中…",
  },
  adminVolunteers: {
    title: "志愿者管理",
    subtitle: "批量导入志愿者名单，并维护组别。",
    adminOnly: "仅负责人可访问志愿者管理。",

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
    matchReject: "不是同一人",
    matchRejectTitle: "标记为非同一人",
    matchRejectBody: (v: string, p: string) =>
      `确认志愿者「${v}」与门户账号「${p}」不是同一个人？这一对之后不再出现在待确认列表里，随时可以在下方撤销。`,
    rejectedTitle: (n: number) => `已判定为非同一人（${n}）`,
    rejectedUndo: "撤销",
    matchConfirmTitle: "确认关联",
    matchConfirmBody: (v: string, p: string) =>
      `确认志愿者「${v}」就是门户账号「${p}」本人？关联后名单会改用其门户资料里的姓名与联系方式。`,
  },
  nameChange: {
    fieldLabel: "昵称",
    lockedHint: "昵称以导入名单为准，如需修改请提交申请，由负责人审核。",
    requestButton: "申请修改",
    dialogTitle: "申请修改昵称",
    currentLabel: "当前昵称",
    newNameLabel: "新昵称",
    reasonLabel: "修改理由",
    reasonHint: "请说明为什么要修改，方便负责人审核。",
    submit: "提交申请",
    cancel: "取消",
    withdraw: "撤回申请",
    pending: (name: string) => `审核中：申请改为「${name}」，请等待负责人处理。`,
    approved: (name: string) => `你的昵称修改已通过，现在是「${name}」。`,
    rejected: (name: string, note: string) =>
      `你把昵称改为「${name}」的申请未通过：${note}`,
    dismiss: "知道了",
    reviewTitle: "昵称修改申请",
    reviewRow: (oldName: string, newName: string) => `${oldName || "（空）"} → ${newName}`,
    reasonPrefix: "理由：",
    approve: "通过",
    reject: "拒绝",
    rejectDialogTitle: "拒绝申请",
    rejectNoteLabel: "拒绝原因",
    rejectNoteHint: "必填，申请人会看到这段话。",
    confirmReject: "确认拒绝",
  },
  requiredTag: "必填",
  requiredFieldError: "请填写后再保存。",
  mentorQa: {
    sectionTitle: "答疑组分享",
    sectionHelp:
      "答疑组活动有两个目的：① 针对大家的共性问题，让 mentor 之间的经验得以共享；② 自我推荐——方便 mentee 在后续环节更了解你，从而让 mentorship 的匹配更合适。上一期填写过的内容会保留在这里，请确认是否仍适用，需要的话直接修改。",
    carryOverNote:
      "参加过往期答疑组的 mentor，之前填写的记录会被保留，确认后按需修改即可；第一次参加的新 mentor 需要自己填写。",
    introLabel: "答疑组自我介绍",
    introPlaceholder:
      "【我是谁】\nHi 大家好，我是 ××。本科 / 研究生学的是 ○○ 专业，毕业后进入 ○○ 行业，现在在 ○○ 公司做 ○○ 岗位，日常主要负责 ○○。\n入行契机：专业不对口时是怎么转行的，为什么选了这个方向。\n工作之外：喜欢什么、最近在折腾什么（可选）。",
    topicLabel: "本次分享的主题",
    topicHelp: "可以用几个关键词或提纲描述，供志愿者制作 PPT、供 mentee 选择场次时参考。可参考留言板上 mentee 的提问，选自己更想聊、更有共性的话题。",
    topicPlaceholder:
      "1. 转行契机\n2. 跨行需要的准备\n3. AI 在工作中的应用",
    canHelpLabel: "我能帮上什么",
    canHelpPlaceholder:
      "① 求职与面试：简历怎么改、面试怎么准备、跨专业怎么切入\n② 岗位日常：这个岗位具体做什么、需要哪些能力\n③ 其他：海外求职 / 职场沟通 / AI 在工作中的应用 / 职业规划……",
  },
  namePronunciation: {
    fieldLabel: "昵称读音（选填）",
    placeholder: "例如：Xiǎo Míng，或“像……”",
    helperText: "帮助大家更准确地称呼你，可填写拼音、音标或文字说明。",
    directoryLabel: "读音",
    dialogLabel: "读音提示",
  },
  myMentorship: {
    title: "我的 mentorship 小组",
    intro: "按季度查看你的导师与学员，以及同导师的其她学员。",
    seasonLabel: "季度",
    loading: "正在加载我的 mentorship 小组…",
    loadError: "小组或成员资料加载失败，请重试。如果持续失败，请联系负责人确认配对读取迁移已部署。",
    retry: "重试",
    noSeason: "你尚未加入任何季度。",
    empty: "本季度暂无你的配对结果。",
    unavailable: "成员资料不可用（资料未公开或不在可见季度内）。",
    mentor: "导师",
    mentees: "学员",
  },
  dashboard: {
    title: "数据看板",
    hint: "本季参与情况一览。只显示人数，不显示任何成员的个人信息。",
    updatedAt: (t: string) => `数据更新于 ${t}`,
    forbidden: "仅负责人或当季志愿者可查看数据看板。",
    noCohorts: "你暂无可查看的季度，请联系负责人确认志愿者账号关联。",
    loading: "正在加载数据看板…",
    cohortLabel: "季度",
    people: "人",
    sessionsUnit: "场",
    hero: {
      title: "账号激活率",
      detail: (activated: number, actual: number) => `${activated} / ${actual} 人已激活`,
      scope: "Mentor + Mentee",
    },
    colorLegend: {
      label: "颜色",
      total: "全部",
      activity: "活动",
    },
    insight: {
      paired: (n: number) => `还有 ${n} 位 Mentee 没配对，建议优先安排`,
      pairedDone: "所有 Mentee 都已配对",
    },
    pendingBreakdown: {
      title: "待激活构成",
      unit: "人待激活",
      mentee: "Mentee",
      mentor: "Mentor",
      none: "没有待激活的人 🎉",
    },
    headline: {
      total: "实际参与",
      totalNote: "导入人数 − 不参与",
      mentors: "Mentor",
      mentees: "Mentee",
      volunteers: "志愿者",
      volunteersNote: (leads: number) => `含负责人 ${leads} 人`,
    },
    attention: {
      title: "需要关注",
      allGood: "目前没有需要跟进的事项。",
      pending: (n: number) => `${n} 人还没激活账号`,
      unpaired: (n: number) => `${n} 位 Mentee 尚未配对`,
      mentorIdle: (n: number) => `${n} 位 Mentor 还没有 Mentee`,
    },
    funnel: {
      title: "导入与激活",
      hint: "实际 = 预计 − 不参与；激活率 = 已激活 ÷ 实际。",
      expected: "预计导入",
      excluded: "不参与",
      actual: "实际参与",
      activated: "已激活",
      noData: "本季还没有导入名单。",
    },
    volunteers: {
      title: "志愿者各组人数",
      total: "志愿者",
      noGroup: "未分组",
      empty: "本季还没有志愿者记录。",
      directSuffix: "（直属）",
      leadershipLine: (name: string) => `${name}（含各组负责人兼任）`,
      leadershipNote: "负责人在环形图里算在各自所在的组，所以这一行不计入上方合计。",
    },
    activities: {
      title: "活动与互动",
      sessionsTotal: (n: number) => `活动场次合计 ${n} 场`,
      roundtable: "圆桌分享会",
      officeHour: "Office Hour",
      qaGroup: "Mentor 答疑组活动",
      qaGroupNote: "由其他文档统计",
    },
    mentoring: {
      title: "配对进展",
      paired: "已配对 Mentee",
      mentorActive: "已有 Mentee 的 Mentor",
      unpaired: "未配对 Mentee",
      mentorIdle: "还没有 Mentee 的 Mentor",
    },
    board: {
      title: "留言板帖子",
      unit: "条",
      comments: (n: number) => `评论 ${n} 条`,
    },
  },
  roster: {
    staffTitle: "成员名单",
    staffHint: "查看你参与志愿工作的季度成员，并编辑内部备注。",
    staffForbidden: "仅负责人或志愿者可访问成员名单。",
    staffNoCohorts: "你暂无已关联的志愿者季度，请联系负责人确认志愿者账号关联。",
    staffLoading: "正在加载成员名单与备注…",
    notesLoadError: "内部备注读取失败，请刷新重试。",
    noteSaveError: "备注保存失败，修改尚未保存，请重试。",
    noteSaving: "正在保存…",
    notePlaceholder: "添加备注",
    noteAdd: "添加",
    noteDelete: "删除这条备注",
    noteEdit: "编辑这条备注",
    noteEditSave: "保存",
    noteEditCancel: "取消",
    noteEdited: "已编辑",
    noteEditedAt: (date: string) => `编辑于 ${date}`,
    noteDeleteError: "删除失败，请重试。",
    /** `author` is set when deleting someone else's entry (admins only). */
    noteDeleteConfirm: (author: string | null) =>
      author
        ? `删除 ${author} 写的这条备注？删除后无法恢复。`
        : "删除这条备注？删除后无法恢复。",
    noteLegacyAuthor: "早期备注",
    noteUnknownAuthor: "未知成员",
    noteShowAll: (n: number) => `展开全部 ${n} 条`,
    noteCollapse: "收起",
    noteFilterLabel: "备注",
    noteFilterOptions: { all: "全部", has: "有备注", none: "无备注" },
    noteAuthorLabel: "备注人",
    noteAuthorMine: "我写的",
    noteAuthorAll: "全部",
    noteAuthorMe: (name: string) => `${name}（我）`,
    noteAuthorCount: (n: number) => `${n} 条`,
    noteAuthorSelected: (names: string[]) =>
      names.length <= 2 ? names.join("、") : `${names.slice(0, 2).join("、")} 等 ${names.length} 人`,
    noteAuthorClear: "清除选择",
    noteAuthorEmpty: "本季还没有人写备注",
    authorCardEmail: "邮箱",
    authorCardWechat: "微信",
    authorCardActivity: (notes: number, recs: number) =>
      [notes > 0 ? `本季写了 ${notes} 条备注` : null, recs > 0 ? `推荐了 ${recs} 位导师` : null]
        .filter(Boolean)
        .join(" · "),
    recommendColumn: "推荐",
    recommendFilterLabel: "推荐",
    recommendFilterOptions: {
      all: "全部",
      current: "本季被推荐",
      past: "往期被推荐",
      mine: "我推荐的",
    },
    recommendButton: (n: number) => (n > 0 ? `推荐 ${n}` : "推荐"),
    recommendPast: (n: number) => `往期 ${n}`,
    recommendDialogTitle: (name: string) => `推荐导师：${name}`,
    recommendDialogHint:
      "推荐合作中表现优秀的导师，供下期配对参考。推荐和理由仅负责人与相关季度的志愿者可见。",
    recommendThisSeason: "本季推荐",
    recommendPastSeasons: "往期推荐",
    recommendNone: "暂无推荐",
    recommendReasonLabel: "推荐理由（可选）",
    recommendReasonPlaceholder: "例如：沟通积极、活动参与度高",
    recommendSubmit: "推荐",
    recommendUpdate: "更新理由",
    recommendWithdraw: "取消推荐",
    recommendClose: "关闭",
    recommendError: "保存失败，请重试。",
    recommendNoReason: "（未填写理由）",
    staffSearch: "搜索昵称、邮箱、微信号、备注或备注人",
    staffColumns: ["昵称", "邮箱", "微信号", "身份", "推荐", "内部备注"],
    pairSearchPlaceholder: "搜索导师昵称、邮箱或 ID",
    pairLoading: "正在加载配对关系与活动记录…",
    pairLoadError: "配对关系或活动记录加载失败，请刷新重试。",
    pairNoCohort: "暂无可查看的项目。",
    pairNoMatches: "负责人尚未上传本项目的配对结果。请在「名单导入」页上传配对表。",
    pairNoSearchResults: "没有符合搜索条件的导师。",
    pairUnavailableMentor: "导师资料不可用",
    pairUnavailableMentee: "学员资料不可用",
    pairUnavailableHint: "部分配对成员资料不可用，仍按配对记录保留显示。",
    pairActivityUnavailable: "活动统计不可用",
    pairRowsPerPage: "每页导师",
    pairDisplayedRows: (from: number, to: number, count: number) =>
      `${from}–${to} / ${count} 位导师`,
    identityTitle: "编辑身份",
    identityHint: "导师与学员互斥；负责人与志愿者是独立的标记。",
    identityLabels: {
      mentor: "导师",
      mentee: "学员",
      admin: "负责人",
      volunteer: "志愿者",
    },
    identityNone: "暂无身份",
    identityRequired: "每位成员至少需要一种身份。",
    identitySelfAdminWarning:
      "这会移除你自己的负责人身份，之后你将无法再打开这个页面。",
    save: "保存",
    cancel: "取消",
    editIdentity: (name: string) => `编辑「${name}」的身份`,
  },
  memberImport: {
    title: "成员导入",
    subtitle: "一份表格，一人一行；「身份」列决定这一行会做什么。",
    intro:
      "支持 Excel（.xlsx）与 CSV。必需的列：姓名、身份、季度；可选的列：邮箱、组别、微信、备注、公开、开通门户。",
    routingHint:
      "「身份」可填导师、学员、志愿者、负责人，多个用「+」连接（例如「导师+志愿者」）。导师 / 学员 / 负责人会开通门户账号，所以必须有邮箱；志愿者只记入名册，除非把「开通门户」填成「是」—— 也就是说，给志愿者填邮箱只是留联系方式，不会悄悄发出账号。",
    seasonHint:
      "「季度」填一个或多个，用分号隔开：2026秋季;2027春季。要给每个季度单独指定组别，写成 2026秋季:运营组;2027春季:项目组；负责人写成 2026秋季:运营组(负责人)。",
    dedupeHint:
      "认人规则：有邮箱的按邮箱认，没邮箱的按姓名认。只要有任意一行冲突，两张表都不会写入。",
    chooseFile: "选择文件",
    downloadTemplate: "下载模板",
    templateFileName: "成员导入模板.csv",
    selected: (name: string, rows: number) => `已选择：${name}（${rows} 行）`,
    checking: "预检中…",
    importing: "导入中…",
    confirmImport: (rows: number) => `确认导入 ${rows} 行`,
    recheck: "重新选择文件",
    previewTitle: "预检结果 —— 确认前请看清楚每一行会做什么",
    resultTitle: "导入结果",
    accountWarning: (n: number) =>
      `这次会为 ${n} 个人开通门户账号，他们将可以登录并查看成员信息。请确认名单无误。`,
    countInvites: (n: number) => `开通账号 ${n}`,
    countInviteUpdates: (n: number) => `更新门户身份 ${n}`,
    countVolunteers: (n: number) => `新增志愿者 ${n}`,
    countVolunteerUpdates: (n: number) => `更新志愿者 ${n}`,
    blocked: "文件中存在冲突，两张表都没有写入。请按下列提示修改后重新上传。",
    done: (invites: number, added: number, updated: number) =>
      `导入完成：开通账号 ${invites} 个，新增志愿者 ${added} 位，更新 ${updated} 位。`,
  },
  pendingInvites: {
    title: "已邀请、待激活",
    intro:
      "这些人已经被导入邀请名单，但还没有登录过 —— 在他们首次登录并完善资料之前，成员目录和上面的名单里都不会有他们。列出全部季度，方便去催。",
    empty: "所有被邀请的成员都已经登录过了。",
    columns: {
      name: "姓名",
      email: "邮箱",
      identity: "身份",
      season: "邀请的季度",
      invitedAt: "邀请时间",
      status: "状态",
    },
    notParticipating: "不参与本次项目",
    stillExpected: "待激活",
    mark: "标记不参与",
    unmark: "取消标记",
    markFailed: "更新标记失败，请稍后重试。",
    accountOnly: "已有账号 · 不在本季名单",
    loadFailed: "读取邀请名单或成员资料失败，请刷新页面重试。",
    summary: (out: number, waiting: number, account: number) =>
      `其中 ${out} 人已标记为不参与本次项目，${waiting} 人仍在等待激活` +
      (account > 0 ? `，${account} 人已有账号但不在对应季度的名单里` : "") +
      "。",
    searchPlaceholder: "姓名 / 邮箱",
    statusLabel: "状态",
    allSeasons: "全部季度",
    total: (shown: number, all: number) =>
      shown === all ? `共 ${shown} 条` : `共 ${shown} 条 (筛选自 ${all} 条)`,
  },
  /** Shared by every filterable, paged table. */
  tableFilters: {
    searchLabel: "搜索",
    all: "全部",
    /** Multi-select filter: shown while something is picked. */
    multiSelected: (labels: string[]) =>
      labels.length <= 2 ? labels.join("、") : `${labels.slice(0, 2).join("、")} 等 ${labels.length} 项`,
    rowsPerPage: "每页",
    displayedRows: (from: number, to: number, count: number) =>
      `${from}–${to} / ${count}`,
  },
  rosterTable: {
    searchPlaceholder: "姓名 / 邮箱 / 微信号 / 备注",
    statusLabel: "激活状态",
    statusOptions: {
      active: "已激活（含待填资料）",
      setup: "已激活 · 待填资料",
      waiting: "已邀请 · 待激活",
      account: "已有账号 · 不在本季名单",
      out: "不参与本次项目",
    },
    roleLabel: "身份",
    roleOptions: {
      mentor: "导师",
      mentee: "学员",
      volunteer: "志愿者",
      admin: "负责人",
    },
    doneLabel: "完成情况",
    doneOptions: { done: "已完成", todo: "未完成" },
    activityLabel: "活动记录",
    gratitudeLabel: "感谢赠言",
    exportButton: "导出名单",
    exportHeader: "昵称",
    exportFailed: "导出失败，请稍后重试。",
    /** The status chip in the 状态 column. */
    state: {
      active: "已激活",
      setup: "已激活 · 待填资料",
      waiting: "待激活",
      account: "已有账号 · 不在本季名单",
      out: "不参与本次项目",
    },
    statusColumn: "状态",
    total: (shown: number, all: number) =>
      shown === all ? `共 ${shown} 人` : `共 ${shown} 人\n(筛选自 ${all} 人)`,
    emptyCohort: "该项目暂时没有成员。",
    emptyFiltered: "没有符合筛选条件的成员。",
  },
  personPicker: {
    placeholder: "输入姓名或邮箱搜索",
    noOptions: "没有匹配的人",
    clear: "清除",
    open: "展开",
    close: "收起",
  },
  persona: {
    label: "当前视角",
    switchTo: "切换视角",
    options: {
      admin: "负责人",
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

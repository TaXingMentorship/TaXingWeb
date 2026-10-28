# 旧头像瘦身（一次性操作）

老头像是原图，最大的有 1–2 MB，但网站上只显示 36–72 像素。每天大部分 Supabase
流量都花在下载这些原图上。`scripts/migrateAvatars.mjs` 把它们缩成 128×128 的
WebP 小图，每张不超过 50 KB，用户什么都不用做。

工具从 `.env.local` 读取 `NEXT_PUBLIC_SUPABASE_URL` 和
`SUPABASE_SERVICE_ROLE_KEY`（不会打印出来），所以只能在有这个文件的电脑上运行。
原图永远不会被删除。

## 1. 预览（只看不改）

```bash
node scripts/migrateAvatars.mjs
```

列出有多少张头像超过 100 KB、一共多大。查文件大小只读存储的记录，不产生流量。

## 2. 执行

```bash
node scripts/migrateAvatars.mjs --apply
```

对每一张：下载原图 → 摆正方向、居中裁成正方形、转成 WebP → 上传到
`<用户 id>/avatar-<随机 id>.webp` → 确认能读到 → 把用户头像换成新图。

- 用户如果在这期间自己换了头像，就不动他的（记为 `orphan`：新图传了但没用上）。
- 一张图出错不影响其他人，最后会列出失败的是哪些。
- 可以重复运行：换过的头像已经小于 100 KB，不会再被选中。
- 想要 192×192 的话加 `--size 192`。

每张图的新旧对照写在 `~/Downloads/avatar-migration-<时间>/mapping.json`
（可用 `--out` 指定，必须在仓库外面，因为里面有用户 id）。至少保留一个计费周期。

## 3. 检查

打开网站看几个人的头像是否正常。第二天到 Supabase → Observability → Storage
看最近 24 小时，原图地址应该不再出现在访问最多的列表里。

## 出问题时

```bash
node scripts/migrateAvatars.mjs --rollback ~/Downloads/avatar-migration-<时间>/mapping.json
```

把换过的头像全部换回原图。用户后来自己换的不受影响。

## 删除原图

不在这次做。至少观察一个计费周期没问题后，再单独决定。

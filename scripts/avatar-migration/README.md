# 旧头像瘦身（一次性操作）

老头像是原图，最大的有 1–2 MB，但网站上只显示 36–72 像素。每天大部分 Supabase
流量都花在下载这些原图上。这里的工具把它们缩成 128×128 的 WebP 小图，每张不超过
50 KB，用户什么都不用做。

整个过程不需要 Supabase 管理员密钥：缩图在本地电脑上完成，改数据库的 SQL 由你在
Supabase 后台的 SQL 编辑器里运行。原图不会被删除。

## 步骤

1. **预览（只看不改）**
   在 Supabase → SQL Editor 运行 `preview.sql`。第一行的 `total_count` 和
   `total_size` 就是要处理多少张、一共多大。确认后点 Export → CSV 下载结果。

2. **本地缩图**

   ```bash
   node scripts/migrateAvatars.mjs ~/Downloads/<导出的文件>.csv
   ```

   结果默认放在 `~/Downloads/avatar-migration-<时间>/`（必须在仓库外面，因为里面
   有用户 id）。终端最后会打印处理了几张、失败几张、总共缩小了多少。里面有：
   - `upload/` — 每个用户一个文件夹，里面是新的小图
   - `apply.sql` — 把头像换成新图
   - `check.sql` — 查看每个人的状态
   - `rollback.sql` — 全部换回原图
   - `mapping.json` — 每张图的新旧对照记录，至少保留一个计费周期

   想要 192×192 的话加 `--size 192`。

3. **上传新图**
   Supabase → Storage → `avatars`，把 `upload/` 里的**所有文件夹**拖进 bucket
   根目录。文件夹名就是用户 id，必须保持这个结构：网站规定每个人只能管理自己
   文件夹里的头像。

4. **换图**
   在 SQL Editor 运行 `apply.sql`。它只会换"新图已经上传、并且用户这期间没自己
   换过头像"的人，并把换过的记录备份进 `avatar_migration_backup` 表。可以重复运行。
   运行完下面会显示每个人的状态；以后也可以随时运行 `check.sql` 再看。

5. **检查**
   打开网站看几个人的头像是否正常。第二天到 Supabase → Observability → Storage
   看最近 24 小时，原图地址应该不再出现在访问最多的列表里。

## 出问题时

运行 `rollback.sql`，所有换过的头像会换回原图（用户后来自己换的不受影响）。

## 删除原图

不在这次做。至少观察一个计费周期没问题后，再单独决定。

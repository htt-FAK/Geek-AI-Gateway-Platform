-- 用户角色：user 普通成员 / admin 管理员（手机号管理员登录管理页，与 ADMIN_TOKEN 并行）
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
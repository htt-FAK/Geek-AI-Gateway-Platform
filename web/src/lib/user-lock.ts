/**
 * 按用户串行的内存互斥锁：充值、自愈预算回写、密钥轮换等「读本地余额 → 推网关
 * max_budget」的复合操作必须互斥，否则旧快照会把充值后的网关预算盖回去。
 *
 * 只在路由 / 编排层取锁；litellm.ts 的辅助函数内部绝不嵌套取锁（防死锁）。
 * 单实例内存实现——与 SQLite 单写者同属单机边界，多副本部署需换分布式锁。
 */
const userLocks = new Map<string, Promise<unknown>>();

export function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const previous = userLocks.get(userId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  // 链上挂一个吞错副本，避免失败阻塞后续任务；调用方仍拿到原始 run 的结果/异常。
  const tail = run.catch(() => undefined).finally(() => {
    if (userLocks.get(userId) === tail) userLocks.delete(userId);
  });
  userLocks.set(userId, tail);
  return run;
}
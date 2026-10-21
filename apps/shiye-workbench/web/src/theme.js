export const people = [{ name: "我", color: "blue" }];
export const statusMap = {
  queued: ["等待中", "gray"],
  running: ["采集中", "blue"],
  paused: ["已暂停", "amber"],
  waiting: ["待登录 / 验证", "amber"],
  completed: ["已完成", "green"],
  partial: ["部分完成", "amber"],
  stopped: ["已停止", "gray"],
  error: ["运行异常", "red"],
  interrupted: ["可继续", "purple"],
};

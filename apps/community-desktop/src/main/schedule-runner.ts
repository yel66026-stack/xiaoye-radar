import type { CommunityService } from './community-service'

export class ScheduleRunner {
  #timer: ReturnType<typeof setInterval> | null = null
  #running = false
  #stopped = false
  constructor(private readonly service: CommunityService) {}

  start(): void {
    if (this.#timer) return
    this.#stopped = false
    this.#timer = setInterval(() => {
      void this.tick().catch(() => undefined)
    }, 30000)
    void this.tick().catch(() => undefined)
  }

  stop(): void {
    this.#stopped = true
    if (this.#timer) clearInterval(this.#timer)
    this.#timer = null
  }

  async tick(now = new Date()): Promise<void> {
    if (this.#running || this.#stopped) return
    this.#running = true
    try {
      const jobs = (await this.service.state()).jobs
      for (const job of jobs) {
        if (this.#stopped) break
        // Re-read so a pause made while another job runs takes effect immediately.
        const current = (await this.service.state()).jobs.find(({ id }) => id === job.id)
        if (
          !current?.enabled ||
          current.intervalMinutes === null ||
          !current.nextRunAt ||
          Date.parse(current.nextRunAt) > now.getTime()
        )
          continue
        try {
          await this.service.runJob(current.id)
        } catch {
          /* Service persists the failure and schedules the next run, or pauses for user action. */
        }
      }
    } finally {
      this.#running = false
    }
  }
}

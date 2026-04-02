import fs from "node:fs/promises";

export interface LockOptions {
  timeoutMs?: number;
  retryDelayMs?: number;
}

export class FileLock {
  private lockHeld = false;

  public constructor(private readonly lockPath: string) {}

  public async acquire(options: LockOptions = {}): Promise<boolean> {
    const timeoutMs = options.timeoutMs ?? 5000;
    const retryDelayMs = options.retryDelayMs ?? 25;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      try {
        const handle = await fs.open(this.lockPath, "wx");
        await handle.writeFile(`${process.pid}:${Date.now()}`);
        await handle.close();
        this.lockHeld = true;
        return true;
      } catch {
        await delay(retryDelayMs);
      }
    }

    return false;
  }

  public async release(): Promise<void> {
    if (!this.lockHeld) {
      return;
    }

    await fs.unlink(this.lockPath).catch(() => undefined);
    this.lockHeld = false;
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

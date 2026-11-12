import {
  ApplicationError,
  type ApplicationCommand,
  type ApplicationSnapshot,
  type CommandEnvelope,
  type CommandOutcome,
} from './application-contracts';
import { executeCommand } from './application-commands';

/**
 * Where a surface keeps one person's record. A hosted store, a local bridge or an
 * Android database implements this; `write` must reject a snapshot whose expected
 * revision is no longer current, so two writers cannot silently overwrite each other.
 */
export interface MealbookRepository {
  read(): Promise<ApplicationSnapshot>;
  write(next: ApplicationSnapshot, expectedRevision: number): Promise<void>;
}

/**
 * For tests and local tools only. It never stands in for the person's app: the real
 * record lives where that app stores it.
 */
export function createInMemoryRepository(initial: ApplicationSnapshot): MealbookRepository {
  let current = structuredClone(initial);
  return {
    async read() {
      return structuredClone(current);
    },
    async write(next, expectedRevision) {
      if (current.revision !== expectedRevision)
        throw new ApplicationError(
          'CONFLICT',
          'Your book changed since this change was prepared. Review the current version and try again.',
        );
      current = structuredClone(next);
    },
  };
}

/**
 * Runs commands against a repository one at a time: each reads, executes and writes
 * before the next starts, so concurrent requests cannot both take the last portion.
 */
export class MealbookApplication {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly repository: MealbookRepository) {}

  execute<C extends ApplicationCommand>(envelope: CommandEnvelope<C>): Promise<CommandOutcome<C>> {
    const run = this.queue.then(async () => {
      const snapshot = await this.repository.read();
      const { snapshot: next, outcome } = executeCommand(snapshot, envelope);
      if (outcome.status === 'applied') await this.repository.write(next, snapshot.revision);
      return outcome;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** The current snapshot, after every queued command has finished. */
  read(): Promise<ApplicationSnapshot> {
    const run = this.queue.then(() => this.repository.read());
    this.queue = run.catch(() => undefined);
    return run;
  }
}

import type { RawInput } from "@/lib/server/input-layer/types";

export interface RawInputRepository {
  save(rawInput: RawInput): Promise<void>;
  findDuplicateForSameDay(input: {
    anonymousDeviceId?: string;
    userId?: string;
    sourceHash: string;
    yyyyMmDd: string;
  }): Promise<RawInput | undefined>;
}

export class InMemoryRawInputRepository implements RawInputRepository {
  private readonly rawInputs: RawInput[] = [];

  async save(rawInput: RawInput): Promise<void> {
    this.rawInputs.push(rawInput);
  }

  async findDuplicateForSameDay(input: {
    anonymousDeviceId?: string;
    userId?: string;
    sourceHash: string;
    yyyyMmDd: string;
  }): Promise<RawInput | undefined> {
    return this.rawInputs.find((rawInput) => {
      const sameSubject =
        (input.userId && rawInput.userId === input.userId) ||
        (input.anonymousDeviceId && rawInput.anonymousDeviceId === input.anonymousDeviceId);

      return sameSubject && rawInput.sourceHash === input.sourceHash && rawInput.receivedAt.startsWith(input.yyyyMmDd);
    });
  }
}

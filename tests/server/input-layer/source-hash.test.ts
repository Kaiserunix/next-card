import { describe, expect, it } from "vitest";
import { createSourceHash } from "@/lib/server/input-layer/source-hash";

describe("createSourceHash", () => {
  it("normalizes whitespace for equivalent text inputs", () => {
    expect(createSourceHash({ sourceType: "text", text: " 明天 早八 去高数课 " })).toBe(
      createSourceHash({ sourceType: "text", text: "明天早八去高数课" }),
    );
  });

  it("keeps source types separate even when text matches", () => {
    expect(createSourceHash({ sourceType: "text", text: "今晚八点交作文" })).not.toBe(
      createSourceHash({ sourceType: "manual-dictation", text: "今晚八点交作文" }),
    );
  });

  it("uses content references for file-like inputs without parsed text", () => {
    expect(createSourceHash({ sourceType: "pdf", contentRef: "upload://course-requirements.pdf" })).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});

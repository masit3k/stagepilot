import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runUserDataVocalAudit } from "./userDataVocalsAudit";

const tempRoots: string[] = [];

async function createAuditFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-audit-"));
  tempRoots.push(root);

  const bandsDir = path.join(root, "user_data", "bands");
  const musiciansDir = path.join(root, "user_data", "musicians");
  const presetGroupsDir = path.join(root, "user_data", "presets", "groups");
  const monitorDir = path.join(root, "user_data", "presets", "monitors");

  await fs.mkdir(path.join(bandsDir), { recursive: true });
  await fs.mkdir(path.join(musiciansDir, "vocs"), { recursive: true });
  await fs.mkdir(path.join(musiciansDir, "keys"), { recursive: true });
  await fs.mkdir(path.join(musiciansDir, "guitar"), { recursive: true });
  await fs.mkdir(path.join(musiciansDir, "bass"), { recursive: true });

  await fs.mkdir(path.join(presetGroupsDir, "guitar"), { recursive: true });
  await fs.mkdir(path.join(presetGroupsDir, "keys"), { recursive: true });
  await fs.mkdir(path.join(presetGroupsDir, "vocs"), { recursive: true });
  await fs.mkdir(path.join(presetGroupsDir, "bass"), { recursive: true });
  await fs.mkdir(path.join(monitorDir), { recursive: true });

  await fs.writeFile(
    path.join(presetGroupsDir, "guitar", "ac_guitar.json"),
    JSON.stringify({ id: "ac_guitar", group: "guitar", type: "preset", inputs: [] }),
  );
  await fs.writeFile(
    path.join(presetGroupsDir, "keys", "keys.json"),
    JSON.stringify({ id: "keys", group: "keys", type: "preset", inputs: [] }),
  );
  await fs.writeFile(
    path.join(presetGroupsDir, "bass", "el_bass_xlr_pedalboard.json"),
    JSON.stringify({ id: "el_bass_xlr_pedalboard", group: "bass", type: "preset", inputs: [] }),
  );
  await fs.writeFile(
    path.join(presetGroupsDir, "vocs", "vocal_lead_no_mic.json"),
    JSON.stringify({ id: "vocal_lead_no_mic", group: "vocs", type: "preset", inputs: [] }),
  );
  await fs.writeFile(
    path.join(presetGroupsDir, "vocs", "vocal_back_no_mic.json"),
    JSON.stringify({ id: "vocal_back_no_mic", group: "vocs", type: "preset", inputs: [] }),
  );

  await fs.writeFile(path.join(monitorDir, "wedge.json"), JSON.stringify({ id: "wedge", type: "monitor", label: "Wedge" }));
  await fs.writeFile(
    path.join(monitorDir, "iem_stereo_wired.json"),
    JSON.stringify({ id: "iem_stereo_wired", type: "monitor", label: "IEM wired" }),
  );

  const musicians = [
    {
      id: "voc-pure",
      firstName: "Pure",
      lastName: "Singer",
      group: "vocs",
      presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }],
    },
    {
      id: "holoubek_lukas",
      firstName: "Lukas",
      lastName: "Holoubek",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "preset", ref: "ac_guitar" },
      ],
    },
    {
      id: "voc-monitor-only",
      firstName: "Mon",
      lastName: "Only",
      group: "vocs",
      presets: [{ kind: "monitor", ref: "iem_stereo_wired" }],
    },
    {
      id: "keys-lead",
      firstName: "Keys",
      lastName: "Lead",
      group: "keys",
      presets: [
        { kind: "preset", ref: "keys" },
        { kind: "vocal", ref: "vocal_lead_no_mic", ownerKey: "keys", ownerLabel: "keys" },
      ],
    },
    {
      id: "guitar-back",
      firstName: "Guitar",
      lastName: "Back",
      group: "guitar",
      presets: [
        { kind: "preset", ref: "ac_guitar" },
        { kind: "vocal", ref: "vocal_back_no_mic", ownerKey: "guitar", ownerLabel: "guitar" },
      ],
    },
    {
      id: "bass-only",
      firstName: "Bass",
      lastName: "Only",
      group: "bass",
      presets: [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }],
    },
    {
      id: "monitor-player",
      firstName: "Monitor",
      lastName: "Player",
      group: "guitar",
      presets: [{ kind: "monitor", ref: "wedge" }],
    },
  ];

  for (const musician of musicians) {
    await fs.writeFile(path.join(musiciansDir, musician.group, `${musician.id}.json`), JSON.stringify(musician));
  }

  await fs.writeFile(
    path.join(bandsDir, "band-a.json"),
    JSON.stringify({
      id: "band-a",
      name: "Band A",
      defaultLineup: {
        keys: ["keys-lead"],
        guitar: ["guitar-back"],
        lead_vocs: ["holoubek_lukas"],
        back_vocs: ["guitar-back"],
      },
    }),
  );

  await fs.writeFile(
    path.join(bandsDir, "band-b.json"),
    JSON.stringify({
      id: "band-b",
      name: "Band B",
      defaultLineup: {
        bass: ["bass-only"],
        lead_vocs: ["missing-member"],
      },
    }),
  );

  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("runUserDataVocalAudit", () => {
  it("classifies pure vocalist", async () => {
    const report = await runUserDataVocalAudit(await createAuditFixture());
    const musician = report.musicianClassifications.find((item) => item.musicianId === "voc-pure");
    expect(musician?.classification).toBe("pure_vocalist");
  });

  it("group=vocs + ac_guitar + lead vocal is vocalist-with-instrument", async () => {
    const report = await runUserDataVocalAudit(await createAuditFixture());
    const musician = report.musicianClassifications.find((item) => item.musicianId === "holoubek_lukas");
    expect(musician?.classification).toBe("vocalist_with_instrument");
    expect(musician?.hasInstrumentCapability).toBe(true);
  });

  it("monitor preset is not treated as instrument ambiguity", async () => {
    const report = await runUserDataVocalAudit(await createAuditFixture());
    const musician = report.musicianClassifications.find((item) => item.musicianId === "monitor-player");
    expect(musician?.hasMonitoringOnlyPresets).toBe(true);
    expect(musician?.hasInstrumentCapability).toBe(false);
    expect(musician?.unknownPresetRefs).toEqual([]);
  });

  it("classifies obvious instrument refs from preset catalog", async () => {
    const report = await runUserDataVocalAudit(await createAuditFixture());
    const musician = report.musicianClassifications.find((item) => item.musicianId === "bass-only");
    expect(musician?.hasInstrumentCapability).toBe(true);
    expect(musician?.instrumentCapabilityRefs).toContain("el_bass_xlr_pedalboard");
  });

  it("selected lead vocalist outside instrument lineup but group=vocs is likely model mismatch", async () => {
    const report = await runUserDataVocalAudit(await createAuditFixture());
    const anomalies = report.bandAnomalies.filter((item) => item.bandId === "band-a");
    expect(anomalies.some((item) => item.severity === "likely-model-mismatch")).toBe(true);
    expect(anomalies.some((item) => item.severity === "conflict")).toBe(false);
  });

  it("reports missing lineup member references as conflicts", async () => {
    const report = await runUserDataVocalAudit(await createAuditFixture());
    const anomalies = report.bandAnomalies.filter((item) => item.bandId === "band-b");
    expect(anomalies.some((item) => item.severity === "conflict" && item.code === "missing-musician-reference")).toBe(true);
  });
});

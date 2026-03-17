import type { DrumDefinition, DrumPad } from "./drumDefinition.js";

export type DrumSetup = DrumDefinition;
export type PadMode = Exclude<Extract<DrumPad, { enabled: true }>['mode'], never>;
export type PadChannels = Exclude<Extract<DrumPad, { enabled: true }>['channels'], never>;

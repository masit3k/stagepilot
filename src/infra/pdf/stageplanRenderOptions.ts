export interface StageplanRenderOptions {
  hideMusicianNames: boolean;
}

export function resolveStageplanRenderOptions(
  options?: Partial<StageplanRenderOptions>,
): StageplanRenderOptions {
  return {
    hideMusicianNames: options?.hideMusicianNames ?? false,
  };
}


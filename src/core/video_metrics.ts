export const portraitVideoThreshold = 1;
export const portraitPlayerViewportFraction = 0.46;
export const portraitPlayerMinHeight = 180;
export const portraitPlayerMaxDp = 380;

type VideoSize = Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight'>;

export function videoAspectRatio(video: VideoSize): number {
  const { videoWidth: width, videoHeight: height } = video;
  if (width > 0 && height > 0) {
    const ratio = width / height;
    if (Number.isFinite(ratio) && ratio >= 0.1 && ratio <= 10) return ratio;
  }
  return 16 / 9;
}

export function isPortraitVideoAspectRatio(ratio: number): boolean {
  return ratio < portraitVideoThreshold;
}

export function isPortraitVideo(video: VideoSize): boolean {
  return isPortraitVideoAspectRatio(videoAspectRatio(video));
}

export function playerHeightLimit(viewportHeight: number): number {
  return Math.max(
    portraitPlayerMinHeight,
    Math.min(viewportHeight * portraitPlayerViewportFraction, portraitPlayerMaxDp),
  );
}

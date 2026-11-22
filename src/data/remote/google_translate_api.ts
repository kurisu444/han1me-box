import { get } from './han1me_http_client';
import { type VideoDetail, type VideoTranslation } from '../../domain/models/video';

export async function translate(text: string, targetLanguage: string): Promise<string> {
  const query = new URLSearchParams({
    client: 'gtx',
    dt: 't',
    sl: 'auto',
    tl: targetLanguage,
    q: text,
  });
  const response = await get(`https://translate.googleapis.com/translate_a/single?${query}`);
  if (response.statusCode >= 400)
    throw new Error(`Translation failed: HTTP ${response.statusCode}`);
  const segments = JSON.parse(response.body)?.[0];
  if (!Array.isArray(segments)) throw new Error('Invalid Google Translate response');
  const result = segments
    .filter(Array.isArray)
    .map((segment) => segment[0])
    .filter((value) => typeof value === 'string')
    .join('');
  if (!result) throw new Error('Empty Google Translate response');
  return result;
}

export async function translateVideo(
  video: VideoDetail,
  language: string,
): Promise<VideoTranslation> {
  const values = await Promise.all([
    translate(video.title, language),
    ...(video.captionTitle?.trim() ? [translate(video.captionTitle, language)] : []),
    ...(video.description?.trim() ? [translate(video.description, language)] : []),
  ]);
  let index = 1;
  return {
    title: values[0],
    captionTitle: video.captionTitle?.trim() ? values[index++] : undefined,
    description: video.description?.trim() ? values[index] : undefined,
  };
}

/** Turn an ApiError (or anything else) into text in the current language. */
export function errMsg(t, error) {
  const key = `err.${error?.code || 'error'}`;
  const text = t(key);
  return text === key ? t('err.error') : text;
}

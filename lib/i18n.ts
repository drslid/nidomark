import { browser } from 'wxt/browser';

/** Translated message; "{1}", "{2}"… are replaced by the substitutions. */
export function t(key: string, ...subs: (string | number)[]): string {
  const msg = browser.i18n.getMessage(key as Parameters<typeof browser.i18n.getMessage>[0]) || key;
  return msg.replace(/\{(\d)\}/g, (_, n: string) => String(subs[Number(n) - 1] ?? ''));
}

export function uiLanguage(): string {
  // Language of the message file actually in use, so that folder names always match the interface.
  return browser.i18n.getMessage('lang' as Parameters<typeof browser.i18n.getMessage>[0]) || browser.i18n.getUILanguage();
}

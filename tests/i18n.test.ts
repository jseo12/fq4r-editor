import { test } from 'node:test';
import assert from 'node:assert/strict';
import ko from '../packages/save-core/src/locales/ko.json' with { type: 'json' };
import en from '../packages/save-core/src/locales/en.json' with { type: 'json' };
import ja from '../packages/save-core/src/locales/ja.json' with { type: 'json' };
import { SUPPORTED_LOCALES, resolveLocale, t, formatMessage, getLocale, setLocale, subscribeLocale } from '../packages/save-core/src/i18n.ts';

test('i18n supports only Korean, Japanese and English with complete placeholder-compatible catalogs', () => {
  assert.deepEqual(SUPPORTED_LOCALES, ['ko', 'ja', 'en']);
  for (const dictionary of [en, ja]) {
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(ko).sort());
    for (const [key, value] of Object.entries(dictionary)) {
      assert.ok(value.length > 0, key);
      const placeholders = (text: string) => [...text.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
      assert.deepEqual(placeholders(value), placeholders(key), key);
    }
  }
  assert.equal(resolveLocale(['en-US']), 'en');
  assert.equal(resolveLocale(['ja-JP']), 'ja');
  assert.equal(resolveLocale(['ko_KR']), 'ko');
  assert.equal(resolveLocale(['zh-CN', 'fr-FR']), 'ko');
  assert.equal(resolveLocale(['de-DE', 'ja']), 'ja');
});

test('i18n translates display messages, interpolation and fallbacks without changing values', () => {
  assert.equal(t('저장', 'en'), 'Save');
  assert.equal(t('개요', 'ja'), '概要');
  assert.equal(t('골드', 'ko'), '골드');
  assert.equal(formatMessage('영역 {0} 체크섬 수정', [3], 'en'), 'Repair region 3 checksum');
  assert.equal(t('영역 3 체크섬 수정', 'en'), 'Repair region 3 checksum');
  assert.equal(t('부대 7 편집', 'ja'), '部隊7を編集');
  assert.equal(t('0x01 궁병', 'en'), '0x01 Archer');
  assert.equal(t('save00.dat: 파일을 읽지 못했습니다.', 'en'), 'save00.dat: Could not read the file.');
  assert.equal(t('이 부대를 강제로 삭제하면 게임에 버그나 충돌이 발생할 수 있습니다.\n이 부대 데이터를 삭제하시겠습니까?', 'en'), 'Forcibly deleting this troop may cause game bugs or crashes. Delete this troop?');
  assert.equal(t('번역되지 않은 게임 이름', 'en'), '번역되지 않은 게임 이름');
  assert.equal(t(220, 'ja'), 220);
  const bytes = new Uint8Array([1, 2]); assert.equal(t(bytes, 'en'), bytes);
  assert.equal(t('POWER', 'ja'), 'POWER');
});

test('i18n language subscriptions reject unsupported languages and notify only on changes', () => {
  setLocale('ko'); let notifications = 0;
  const unsubscribe = subscribeLocale(() => notifications++);
  setLocale('en'); assert.equal(getLocale(), 'en'); assert.equal(t('저장'), 'Save');
  setLocale('en'); assert.equal(notifications, 1);
  setLocale('fr' as 'ko'); assert.equal(getLocale(), 'en');
  unsubscribe(); setLocale('ko'); assert.equal(notifications, 1);
});

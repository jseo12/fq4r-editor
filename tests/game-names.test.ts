import { test } from 'node:test';
import assert from 'node:assert/strict';
import { troopCountryName, troopNationLabel, locationName, troopLocationName, getLocationOptions, itemDescription, itemQualityScore, parseSave, characterName, className, itemName, spellName, getCharacterNameOptions, getClassOptions, getItemOptions, getSpellOptions, ITEM_OPTIONS } from '../packages/save-core/src/index.ts';
import { gameNameTable } from '../packages/save-core/src/game-names.ts';
import { getLocale, setLocale } from '../packages/save-core/src/i18n.ts';

test('Japanese name catalogs preserve raw text and keep known table boundaries', () => {
  const characters = gameNameTable('characters', 'ja'); const classes = gameNameTable('classes', 'ja');
  assert.equal(Object.keys(characters).length, 658);
  assert.equal(characters['26'], 'ｱﾚｽ');
  assert.equal(Object.keys(classes).length, 256);
  for (let id = 0; id < 220; id++) assert.ok(classes[id]);
  for (let id = 220; id < 256; id++) assert.equal(classes[id], null);
  assert.equal(Object.keys(gameNameTable('items', 'ja')).length, 73);
  assert.equal(gameNameTable('spells', 'ja')['43'], '？？？');
  for (let id = 44; id < 54; id++) assert.equal(gameNameTable('spells', 'ja')[id], '');
  for (const kind of ['characters', 'classes', 'items', 'spells'] as const) {
    for (const name of Object.values(gameNameTable(kind, 'ja'))) if (name) {
      assert.doesNotMatch(name, /[\x00-\x1f\ufffd]/);
    }
  }
});

test('Japanese game names resolve by ID, with kana width normalization and safe unknown labels', () => {
  assert.equal(characterName(0x1a, 'ja'), 'アレス');
  assert.equal(characterName(0x209, 'ja'), 'エレイン');
  assert.equal(characterName(0, 'ja'), '（名前なし）');
  assert.equal(className(0, 'ja'), 'キング');
  assert.equal(className(1, 'ja'), 'ユウシャ');
  assert.equal(itemName(1, 'ja'), 'ショートソード');
  assert.equal(itemName(16, 'ja'), 'エクスカリバー');
  assert.equal(itemName(0x24, 'ja'), '鏡の鎧');
  assert.equal(spellName(3, 'ja'), '死者召喚');
  assert.equal(spellName(6, 'ja'), 'サンダー');
  assert.equal(spellName(0x25, 'ja'), 'フェニクス');
  assert.equal(spellName(0x2b, 'ja'), '？？？');
  assert.match(className(0xdc, 'ja'), /職業未確認.*DC/);
  assert.match(spellName(0x31, 'ja'), /魔法.*31/);
  assert.match(characterName(65535, 'ja'), /名前未確認.*FFFF/);
  assert.equal(characterName(26, 'ko'), '아레스');
  assert.equal(characterName(26, 'en'), '아레스');
  assert.equal(className(0, 'en'), '킹');
  assert.equal(itemName(16, 'en'), '엑스칼리버');
  assert.equal(spellName(6, 'en'), '썬더');
});

test('Localized option lists refresh without changing stable item IDs or Korean core constants', () => {
  const previous = getLocale();
  try {
    const ids = ITEM_OPTIONS.map(option => option.id);
    setLocale('ja');
    assert.equal(characterName(26), 'アレス');
    assert.equal(getCharacterNameOptions().find(option => option.id === 26)?.name, 'アレス');
    assert.equal(getClassOptions().length, 220);
    assert.equal(getClassOptions()[0].name, 'キング');
    assert.equal(getItemOptions()[0].name, 'ショートソード');
    assert.equal(getSpellOptions().find(option => option.id === 6)?.name, 'サンダー');
    assert.deepEqual(getItemOptions().map(option => option.id), ids);
    assert.equal(ITEM_OPTIONS[0].name, '숏소드');
    setLocale('ko');
    assert.equal(getCharacterNameOptions().find(option => option.id === 26)?.name, '아레스');
    assert.equal(getItemOptions()[0].name, '숏소드');
  } finally { setLocale(previous); }
});


test('Japanese maps use original region labels and interior parent mapping without inventing room names', () => {
  const regions = gameNameTable('locations', 'ja');
  assert.equal(Object.keys(regions).length, 358);
  assert.equal(Object.keys(gameNameTable('internalLocations', 'ja')).length, 256);
  for (let id = 101; id < 256; id++) assert.equal(regions[id], undefined);
  assert.equal(locationName(1, 'ja'), 'カーリオンの城');
  assert.equal(locationName(10, 'ja'), 'ケントの町');
  assert.equal(locationName(0x100, 'ja'), 'リンカーの町');
  assert.equal(locationName(0x14a, 'ja'), 'カーリオンの城');
  assert.equal(troopLocationName(0xff01, 'ja'), 'カーリオンの城');
  assert.equal(troopLocationName(0x0100, 'ja'), 'リンカーの町');
  assert.match(locationName(101, 'ja'), /不明な場所/);
  assert.equal(locationName(0x100, 'ko'), '링커-촌장');
  assert.equal(locationName(0x100, 'en'), '링커-촌장');
  assert.equal(getLocationOptions('ja').find(option => option.id === 0x14a)?.name, 'カーリオンの城');
  const data = new Uint8Array(0x8000); data.set([119, 105, 110, 52]); data[0x204] = 1; data[0x6de] = 255; data[0x59a6] = 255;
  const originalLocale = getLocale();
  try { setLocale('ja'); assert.equal(parseSave(data).summary.location, '카리온성'); }
  finally { setLocale(originalLocale); }
});

test('Japanese item descriptions retain both variants, numeric modifiers and language-independent quality scores', () => {
  assert.equal(itemDescription(1, 'ja'), 'AT+02 AR+02 DF+00 DR+00 短い剣');
  assert.equal(itemDescription(16, 'ja'), 'AT+20 AR+10 DF+00 DR+05 使う者を疲労させない');
  assert.equal(itemDescription(16, 'ja', true), 'AT+20 AR+10 DF+00 DR+05 使う者を疲労しづらくする');
  assert.equal(itemDescription(0, 'ja'), ''); assert.equal(itemDescription(255, 'ja'), '');
  assert.equal(itemDescription(1, 'en'), itemDescription(1, 'ko'));
  const scores = ITEM_OPTIONS.map(option => itemQualityScore(option.id));
  const originalLocale = getLocale();
  try { setLocale('ja'); assert.deepEqual(ITEM_OPTIONS.map(option => itemQualityScore(option.id)), scores); }
  finally { setLocale(originalLocale); }
});


test('nation names use Japanese IDs and preserve Korean fallback and group masking', () => {
  const previous = getLocale();
  try {
    const expected = ['カーリオン', 'バルシア', 'ヒュリア', 'ミュルトン', 'グレイス', 'レスター', 'サネット', 'リンカー', 'ゼム', 'ベニック', 'モロシア', 'ノーフォーク', 'エドウィン', 'マーシア', 'セバート', 'ベルダ', '中立国'];
    assert.deepEqual(Object.values(gameNameTable('nations', 'ja')), expected);
    setLocale('ja');
    for (let id = 0; id < 16; id++) {
      assert.equal(troopCountryName(id), expected[id]);
      assert.equal(troopCountryName(0xa0 | id), expected[id]);
    }
    assert.equal(troopNationLabel(0), expected[0]);
    assert.equal(troopNationLabel(1), expected[1]);
    assert.equal(troopNationLabel(4), expected[16]);
    assert.equal(troopCountryName(0, 'ko'), '카리온');
    assert.equal(troopCountryName(0, 'en'), '카리온');
  } finally { setLocale(previous); }
});

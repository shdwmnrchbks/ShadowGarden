import test from 'node:test';
import assert from 'node:assert/strict';
import { applyArtworkPlan, buildArtworkPlan } from '../../functions/services/artwork.js';

const clone = value => JSON.parse(JSON.stringify(value));
const BOOK_ONE = 'bk_1111111111111111111111';
const BOOK_TWO = 'bk_2222222222222222222222';

function fixture() {
  return {
    main: {
      generatedAt: '2026-09-03T00:00:00Z',
      series: [{
        id: 'artwork-series',
        title: 'Artwork Series',
        cover: '/media/shadow-garden/covers/old-detail.webp',
        coverThumb: '/media/shadow-garden/covers/old-thumb.webp',
        bannerBookId: BOOK_ONE,
        volumes: [
          { title: 'Artwork Series 1', number: 1, file: '/media/shadow-garden/books/artwork/one.epub', bookId: BOOK_ONE, cover: '/media/shadow-garden/covers/old-detail.webp', coverThumb: '/media/shadow-garden/covers/old-thumb.webp' },
          { title: 'Artwork Series 2', number: 2, file: '/media/shadow-garden/books/artwork/two.epub', bookId: BOOK_TWO, cover: '/media/shadow-garden/covers/two-detail.webp', coverThumb: '/media/shadow-garden/covers/two-thumb.webp' }
        ]
      }]
    },
    adult: { generatedAt: '2026-09-03T00:00:00Z', series: [] }
  };
}

test('bulk artwork validates the complete batch before mutating catalog state', async () => {
  const data = fixture(), before = clone(data);
  const planned = await buildArtworkPlan(data, [
    {
      seriesId: 'artwork-series', scope: 'main', coverTarget: 'series',
      coverKey: 'shadow-garden/covers/cv_AAAAAAAAAAAAAAAAAAAAAA-detail.webp',
      coverThumbKey: 'shadow-garden/covers/cv_AAAAAAAAAAAAAAAAAAAAAA-thumb.webp'
    },
    { seriesId: 'missing-series', scope: 'main', bannerBookId: '' }
  ]);

  assert.equal(planned.ok, false);
  assert.equal(planned.status, 409);
  assert.match(planned.error, /missing-series/);
  assert.deepEqual(data, before, 'planning must not change any live catalog object when a later row is stale');
});

test('bulk artwork replaces a volume cover and banner in one validated plan', async () => {
  const data = fixture();
  const planned = await buildArtworkPlan(data, [{
    seriesId: 'artwork-series',
    scope: 'main',
    coverTarget: 'volume',
    volumeFile: '/media/shadow-garden/books/artwork/one.epub',
    coverKey: 'shadow-garden/covers/cv_BBBBBBBBBBBBBBBBBBBBBB-detail.webp',
    coverThumbKey: 'shadow-garden/covers/cv_BBBBBBBBBBBBBBBBBBBBBB-thumb.webp',
    bannerBookId: BOOK_TWO
  }]);

  assert.equal(planned.ok, true);
  const applied = applyArtworkPlan(planned.plan);
  assert.deepEqual(applied, { covers: 1, banners: 1, series: 1 });

  const series = data.main.series[0], volume = series.volumes[0];
  assert.equal(volume.cover, '/media/shadow-garden/covers/cv_BBBBBBBBBBBBBBBBBBBBBB-detail.webp');
  assert.equal(volume.coverThumb, '/media/shadow-garden/covers/cv_BBBBBBBBBBBBBBBBBBBBBB-thumb.webp');
  assert.equal(series.cover, volume.cover, 'series cover follows a replaced volume when it referenced that volume before the batch');
  assert.equal(series.coverThumb, volume.coverThumb);
  assert.equal(series.bannerBookId, BOOK_TWO);
});

test('bulk artwork can replace only the series cover and restore random banner rotation', async () => {
  const data = fixture();
  const planned = await buildArtworkPlan(data, [{
    seriesId: 'artwork-series',
    scope: 'main',
    coverTarget: 'series',
    coverKey: 'shadow-garden/covers/cv_CCCCCCCCCCCCCCCCCCCCCC-detail.webp',
    coverThumbKey: 'shadow-garden/covers/cv_CCCCCCCCCCCCCCCCCCCCCC-thumb.webp',
    bannerBookId: ''
  }]);

  assert.equal(planned.ok, true);
  applyArtworkPlan(planned.plan);
  const series = data.main.series[0];
  assert.equal(series.cover, '/media/shadow-garden/covers/cv_CCCCCCCCCCCCCCCCCCCCCC-detail.webp');
  assert.equal(series.coverThumb, '/media/shadow-garden/covers/cv_CCCCCCCCCCCCCCCCCCCCCC-thumb.webp');
  assert.equal(series.volumes[0].cover, '/media/shadow-garden/covers/old-detail.webp', 'series-only cover replacement must not rewrite volume artwork');
  assert.equal('bannerBookId' in series, false);
});

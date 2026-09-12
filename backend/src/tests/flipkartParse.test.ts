import { describe, expect, it, vi } from 'vitest';

import {
  listingsFromFlipkartRows,
  parseFlipkartRatingReviews,
} from '../services/scraper/flipkartParse.js';

describe('parseFlipkartRatingReviews', () => {
  it('still reads the classic 3.9(33,705) shape', () => {
    expect(parseFlipkartRatingReviews('USB Cable 3.9(33,705) ₹198₹1,89989% off')).toEqual({
      rating: 3.9,
      reviewCount: 33705,
      parsed: true,
    });
  });

  it('tolerates stars, slashes and labels', () => {
    expect(parseFlipkartRatingReviews('4.2/5 (1,234 ratings) ₹499')).toMatchObject({
      rating: 4.2,
      reviewCount: 1234,
      parsed: true,
    });
    expect(parseFlipkartRatingReviews('4★ 1.2k Ratings ₹299')).toMatchObject({
      rating: 4,
      reviewCount: 1200,
      parsed: true,
    });
  });

  it('returns nulls when the rating text is malformed', () => {
    expect(parseFlipkartRatingReviews('n/a stars · reviews pending')).toEqual({
      rating: null,
      reviewCount: null,
      parsed: false,
    });
  });
});

describe('listingsFromFlipkartRows', () => {
  it('keeps a priced listing when the rating format is unusable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const listings = listingsFromFlipkartRows(
      [
        {
          title: 'boAt USB-C Fast Cable',
          href: '/boat-usb-c/p/itm123',
          text: 'boAt USB-C Fast Cable n/a stars ~~ reviews pending ₹349₹99965% off',
          thumbnail: 'https://img.fkcdn.com/cable.jpg',
        },
      ],
      'https://www.flipkart.com',
    );

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      title: 'boAt USB-C Fast Cable',
      price: 349,
      rating: null,
      reviewCount: null,
    });
    expect(listings[0].url).toContain('/boat-usb-c/p/itm123');
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/rating\/review parse failed/i);

    warn.mockRestore();
  });

  it('does not drop a valid card just because reviews are missing', () => {
    const listings = listingsFromFlipkartRows(
      [
        {
          title: 'Classic format cable',
          href: '/classic/p/itm456',
          text: 'Classic format cable 3.9(33,705) ₹198₹1,89989% off',
        },
      ],
      'https://www.flipkart.com',
    );

    expect(listings[0]).toMatchObject({
      title: 'Classic format cable',
      price: 198,
      rating: 3.9,
      reviewCount: 33705,
    });
  });
});

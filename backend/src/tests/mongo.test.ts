import { describe, expect, it } from 'vitest';
import {
  AnalysisModel,
  connectMongo,
  isMongoConnected,
  ListingCacheModel,
  ProductModel,
  SessionModel,
  UserModel,
} from '../models/mongo.js';

describe('MongoDB models and connection helpers', () => {
  it('registers all required Mongoose models', () => {
    expect(UserModel.modelName).toBe('User');
    expect(SessionModel.modelName).toBe('Session');
    expect(ProductModel.modelName).toBe('Product');
    expect(AnalysisModel.modelName).toBe('Analysis');
    expect(ListingCacheModel.modelName).toBe('ListingCache');
  });

  it('validates user model fields', () => {
    const user = new UserModel({
      _id: 'test-user-1',
      email: 'Seller@Example.com',
      passwordHash: 'salt:hash',
      displayName: 'Test Seller',
    });

    expect(user._id).toBe('test-user-1');
    expect(user.email).toBe('seller@example.com');
    expect(user.plan).toBe('free');
    expect(user.authProvider).toBe('password');
  });

  it('returns false gracefully when no URI is provided', async () => {
    const connected = await connectMongo('');
    expect(connected).toBe(false);
    expect(isMongoConnected()).toBe(false);
  });
});

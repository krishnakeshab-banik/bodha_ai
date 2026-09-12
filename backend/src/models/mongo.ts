import mongoose, { Schema, type Model } from 'mongoose';
import { env } from '../config/env.js';

export interface MongoUserDoc {
  _id: string; // user id
  email: string;
  passwordHash: string;
  displayName: string;
  plan: 'free' | 'pro';
  planExpiresAt?: string | null;
  storeName?: string | null;
  storeCity?: string | null;
  storeCategory?: string | null;
  onboardedAt?: string | null;
  authProvider: 'password' | 'google';
  googleId?: string | null;
  createdAt: string;
}

const UserSchema = new Schema<MongoUserDoc>(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    planExpiresAt: { type: String, default: null },
    storeName: { type: String, default: null },
    storeCity: { type: String, default: null },
    storeCategory: { type: String, default: null },
    onboardedAt: { type: String, default: null },
    authProvider: { type: String, enum: ['password', 'google'], default: 'password' },
    googleId: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'users', versionKey: false },
);

export interface MongoSessionDoc {
  _id: string; // token
  userId: string;
  expiresAt: string;
}

const SessionSchema = new Schema<MongoSessionDoc>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: String, required: true },
  },
  { collection: 'sessions', versionKey: false },
);

export interface MongoProductDoc {
  _id: string; // product id
  sellerId: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string | null;
  manufacturingCost: number;
  currentPrice: number;
  createdAt: string;
}

const ProductSchema = new Schema<MongoProductDoc>(
  {
    _id: { type: String, required: true },
    sellerId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, required: true },
    imageUrl: { type: String, default: null },
    manufacturingCost: { type: Number, required: true },
    currentPrice: { type: Number, required: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'products', versionKey: false },
);

export interface MongoAnalysisDoc {
  _id: string; // product id
  recommendedPlatform: string;
  recommendedPrice: number;
  platformsJson: string;
  listingJson: string;
  insightsJson?: string | null;
  createdAt: string;
}

const AnalysisSchema = new Schema<MongoAnalysisDoc>(
  {
    _id: { type: String, required: true },
    recommendedPlatform: { type: String, required: true },
    recommendedPrice: { type: Number, required: true },
    platformsJson: { type: String, required: true },
    listingJson: { type: String, required: true },
    insightsJson: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'analyses', versionKey: false },
);

export interface MongoListingCacheDoc {
  _id: string; // cacheKey
  platformId: string;
  category: string;
  query: string;
  listingsJson: string;
  fetchedAt: string;
}

const ListingCacheSchema = new Schema<MongoListingCacheDoc>(
  {
    _id: { type: String, required: true },
    platformId: { type: String, required: true, index: true },
    category: { type: String, required: true },
    query: { type: String, required: true },
    listingsJson: { type: String, required: true },
    fetchedAt: { type: String, required: true },
  },
  { collection: 'listing_cache', versionKey: false },
);

export const UserModel: Model<MongoUserDoc> =
  mongoose.models.User || mongoose.model<MongoUserDoc>('User', UserSchema);
export const SessionModel: Model<MongoSessionDoc> =
  mongoose.models.Session || mongoose.model<MongoSessionDoc>('Session', SessionSchema);
export const ProductModel: Model<MongoProductDoc> =
  mongoose.models.Product || mongoose.model<MongoProductDoc>('Product', ProductSchema);
export const AnalysisModel: Model<MongoAnalysisDoc> =
  mongoose.models.Analysis || mongoose.model<MongoAnalysisDoc>('Analysis', AnalysisSchema);
export const ListingCacheModel: Model<MongoListingCacheDoc> =
  mongoose.models.ListingCache ||
  mongoose.model<MongoListingCacheDoc>('ListingCache', ListingCacheSchema);

let isConnected = false;

/** Connect to MongoDB if MONGODB_URI is provided. */
export async function connectMongo(uriOverride?: string): Promise<boolean> {
  const uri = uriOverride || env.mongodbUri;
  if (!uri) {
    return false;
  }
  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('[bodha-ai] Connected to MongoDB database successfully');
    return true;
  } catch (error) {
    console.error('[bodha-ai] Failed to connect to MongoDB:', error);
    isConnected = false;
    return false;
  }
}

/** Check if MongoDB is connected and ready. */
export function isMongoConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

/** Disconnect handle for tests and graceful shutdown. */
export async function closeMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  isConnected = false;
}

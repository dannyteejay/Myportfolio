export interface Project {
  id: string;
  title: string;
  slug: string;
  category: "software" | "webdesign";
  summary: string;
  description: string;
  coverImage: string | null;
  liveUrl: string | null;
  repoUrl: string | null;
  tags: string[];
  featured: boolean;
  published: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number; // in kobo
  currency: string;
  coverImage: string | null;
  galleryImages: string[];
  fileUrl: string | null;
  tags: string[];
  published: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: number;
  order: number;
}

export interface Profile {
  id: string;
  name: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  tagline: string;
  bio: string;
  email: string;
  location: string | null;
  avatar: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  resumeUrl: string | null;
}

export interface Message {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export type PaymentGateway = "paystack" | "flutterwave" | "crypto" | "bank";
export type OrderStatus = "pending" | "paid" | "failed" | "cancelled";

export interface Order {
  id: string;
  reference: string;
  productId: string | null;
  productTitle: string;
  email: string;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  status: OrderStatus;
  providerRef: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSettings {
  id: string;
  paystackEnabled: boolean;
  flutterwaveEnabled: boolean;
  cryptoEnabled: boolean;
  bankEnabled: boolean;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankInstructions: string | null;
  cryptoNote: string | null;
}

export interface PaymentMethods {
  paystack: { enabled: boolean; configured: boolean };
  flutterwave: { enabled: boolean; configured: boolean };
  crypto: { enabled: boolean; configured: boolean; note: string | null };
  bank: {
    enabled: boolean;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    instructions: string | null;
  };
}
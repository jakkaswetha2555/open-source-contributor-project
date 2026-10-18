import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Fix for Windows where c-ares defaults to 127.0.0.1 causing querySrv ECONNREFUSED
try {
  const currentServers = dns.getServers();
  if (!currentServers || currentServers.length === 0 || currentServers.every((s) => s.startsWith('127.'))) {
    dns.setServers(['8.8.8.8', '1.1.1.1', '192.168.0.1']);
  }
} catch {
  // Ignore if not supported in environment
}

mongoose.set('strictQuery', true);

export async function connectDb() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
}

export async function disconnectDb() {
  await mongoose.disconnect();
}


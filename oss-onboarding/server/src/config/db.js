import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch {}

mongoose.set('strictQuery', true);

export async function connectDb() {
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || (err.message && err.message.includes('querySrv'))) {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    } else {
      throw err;
    }
  }
  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

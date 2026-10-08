import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDb() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

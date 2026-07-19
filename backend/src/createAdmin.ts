/**
 * One-off script to create the first admin account.
 *
 *   npx tsx src/createAdmin.ts "Admin Name" admin@school.com yourPassword
 *
 * After that, you can add/remove everyone else from the Admin portal UI.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { connectDB } from './config/db.js';
import User from './models/User.js';

dotenv.config();

const [, , nameArg, emailArg, passwordArg] = process.argv;

const name = nameArg || 'Administrator';
const email = (emailArg || 'admin@axesai.com').toLowerCase().trim();
const password = passwordArg || 'admin123';

(async () => {
  await connectDB();
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      existing.role = 'admin';
      if (password) existing.passwordHash = await bcrypt.hash(password, 10);
      await existing.save();
      console.log(`✅ Existing user "${email}" promoted to ADMIN.`);
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await User.create({ name, email, passwordHash, role: 'admin' });
      console.log(`✅ Admin created!\n   Email:    ${email}\n   Password: ${password}`);
    }
    console.log('👉 Sign in at http://localhost:3000 — you\'ll land on /dashboard/admin');
  } catch (err) {
    console.error('❌ Failed to create admin:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();

require('dotenv/config');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDb } = require('../src/config/db.js');
const User = require('../src/models/User.js');
const Session = require('../src/models/Session.js');
const Booking = require('../src/models/Booking.js');
const Waitlist = require('../src/models/Waitlist.js');
const { genCode } = require('../src/utils/codes.js');

// Wipe every collection, then load a small believable gym:
//   - one admin, two members you can log in as
//   - sessions spread over the next few days
//   - one session that is completely full, with a short waitlist
async function seed() {
  await connectDb();

  console.log('Clearing old data...');
  // Drop the database entirely so any leftover indexes from earlier model
  // versions do not clash with the current schema.
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.deleteMany({}),
    Session.deleteMany({}),
    Booking.deleteMany({}),
    Waitlist.deleteMany({}),
  ]);

  console.log('Creating accounts...');
  const passwordHash = await bcrypt.hash('admin123', 10);
  const memberHash = await bcrypt.hash('member123', 10);

  const admin = await User.create({
    name: 'Gym Admin',
    email: 'admin@gym.test',
    passwordHash,
    role: 'admin',
  });

  const alice = await User.create({
    name: 'Alice Member',
    email: 'alice@example.com',
    passwordHash: memberHash,
    role: 'member',
  });
  const bob = await User.create({
    name: 'Bob Member',
    email: 'bob@example.com',
    passwordHash: memberHash,
    role: 'member',
  });

  // Extra members used only to fill the full session.
  const fillers = [];
  for (let i = 1; i <= 22; i += 1) {
    fillers.push(
      await User.create({
        name: `Filler Member ${i}`,
        email: `filler${i}@example.com`,
        passwordHash: memberHash,
        role: 'member',
      })
    );
  }

  console.log('Creating sessions...');
  const today = new Date();
  const dayStr = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const plan = [
    { date: dayStr(0), startHour: 18, capacity: 20 }, // today, full below
    { date: dayStr(1), startHour: 7, capacity: 20 },
    { date: dayStr(1), startHour: 12, capacity: 20 },
    { date: dayStr(1), startHour: 18, capacity: 20 },
    { date: dayStr(2), startHour: 7, capacity: 20 },
    { date: dayStr(2), startHour: 19, capacity: 20 },
    { date: dayStr(3), startHour: 9, capacity: 20 },
  ];

  const sessions = [];
  for (const s of plan) {
    sessions.push(await Session.create({ ...s, createdBy: admin._id }));
  }
  const fullSession = sessions[0];

  console.log('Filling one session to capacity...');
  // The first filler takes every seat, so this session shows as full.
  for (let i = 0; i < 20; i += 1) {
    await Booking.create({
      session: fullSession._id,
      member: fillers[i]._id,
      status: 'booked',
      code: genCode(),
    });
  }
  fullSession.confirmedCount = 20;
  await fullSession.save();

  // Two people waiting for a free place.
  await Waitlist.create({ session: fullSession._id, member: alice._id });
  await Waitlist.create({ session: fullSession._id, member: bob._id });

  // Give Alice and Bob a couple of real bookings to look at.
  await Booking.create({
    session: sessions[1]._id,
    member: alice._id,
    status: 'booked',
    code: genCode(),
  });
  await Booking.create({
    session: sessions[1]._id,
    member: bob._id,
    status: 'booked',
    code: genCode(),
  });
  sessions[1].confirmedCount = 2;
  await sessions[1].save();

  console.log('\nSeed complete. Log in with:');
  console.log('  Admin : admin@gym.test / admin123');
  console.log('  Member: alice@example.com / member123');
  console.log('  Member: bob@example.com   / member123');

  await mongoose.connection.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

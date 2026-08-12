import { db } from '../src/lib/db';

async function main() {
  const users = await db.user.findMany({
    select: { id: true, username: true, displayName: true, role: true, status: true }
  });
  console.log(JSON.stringify(users, null, 2));
  if (users.length === 0) console.log('No users found.');
  await db.$disconnect();
}
main();

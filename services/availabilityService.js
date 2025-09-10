const { db } = require('../config/firebase');

async function batchDeleteAvailabilities(guildId, items) {
  const batch = db.batch();
  let deleteCount = 0;
  let opCount = 0;

  for (const { userId, shortIds } of items) {
    if (!Array.isArray(shortIds) || shortIds.length === 0) continue;

    const snapshot = await db
      .collection('availabilities')
      .where('guildId', '==', guildId)
      .where('userId', '==', userId)
      .where('shortId', 'in', shortIds)
      .get();

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      deleteCount++;
      opCount++;

      if (opCount >= 500) {
        batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    });
  }

  if (opCount > 0) {
    await batch.commit();
  }

  if (deleteCount === 0) {
    return { success: false, message: 'No matching availabilities found.' };
  }
  
  return { succes: true, message: `Deleted ${deleteCount} availabilities.` };
}
module.exports = { batchDeleteAvailabilities };

const { initializeApp, cert } = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

// Usage check
const command = process.argv[2];
const arg = process.argv[3];

if (!command || (command !== 'clear-all' && command !== 'delete-user')) {
  console.log(`
Password Cracking Lab — Database Admin Panel
===========================================
Usage:
  node db-admin.js clear-all            -> Clears users and leaderboard data from Firestore
  node db-admin.js delete-user <email>  -> Deletes a user by email (Auth + Firestore)
`);
  process.exit(1);
}

// Locate service account key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`
Error: serviceAccountKey.json not found in the project root!

To get one:
1. Go to Firebase Console -> Project Settings -> Service Accounts.
2. Click "Generate new private key".
3. Save the downloaded JSON file as 'serviceAccountKey.json' in this folder:
   x:/ISFCR/Internship/password-cracking-next/serviceAccountKey.json
`);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

async function deleteUserByEmail(email) {
  try {
    console.log(`Searching for user with email: ${email}...`);
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;
    
    // Delete from Firebase Auth
    await auth.deleteUser(uid);
    console.log(`[AUTH] Successfully deleted user record for ${email} (${uid})`);
    
    // Delete Firestore profile
    await db.collection('users').doc(uid).delete();
    console.log(`[STORE] Successfully deleted user profile for ${uid}`);
    
    // Delete leaderboard entries if exist
    const lbRef = db.collection('leaderboard').doc(uid);
    const lbSnap = await lbRef.get();
    if (lbSnap.exists) {
      await lbRef.delete();
      console.log(`[STORE] Successfully deleted user from leaderboard`);
    }
    
    console.log(`✓ User ${email} completely deleted from system.`);
  } catch (error) {
    console.error(`✗ Error deleting user ${email}:`, error.message);
  }
}

async function deleteCollection(collectionRef, batchSize) {
  const query = collectionRef.limit(batchSize);
  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

async function clearAllUsersFromAuth() {
  console.log("Deleting all users from Firebase Auth...");
  let nextPageToken;
  let totalDeleted = 0;
  do {
    const listUsersResult = await auth.listUsers(1000, nextPageToken);
    const uids = listUsersResult.users.map((userRecord) => userRecord.uid);
    if (uids.length > 0) {
      await auth.deleteUsers(uids);
      totalDeleted += uids.length;
      console.log(`[AUTH] Deleted batch of ${uids.length} users`);
    }
    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);
  console.log(`✓ Deleted ${totalDeleted} users from Firebase Auth.`);
}

async function clearAllData() {
  console.log("Clearing all data in Firebase Auth and Firestore...");
  try {
    // 1. Clear users from Firebase Auth
    await clearAllUsersFromAuth();

    // 2. Clear Firestore collections
    const collections = ['users', 'leaderboard'];
    for (const coll of collections) {
      console.log(`Deleting collection: ${coll}`);
      await deleteCollection(db.collection(coll), 100);
    }
    console.log("✓ Firestore collections and Firebase Auth cleared successfully!");
  } catch (error) {
    console.error("✗ Error clearing data:", error.message);
  }
}

(async () => {
  if (command === 'delete-user') {
    if (!arg) {
      console.error("Please provide an email address.");
      process.exit(1);
    }
    await deleteUserByEmail(arg.trim());
  } else if (command === 'clear-all') {
    await clearAllData();
  }
})();

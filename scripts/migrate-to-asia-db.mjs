import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBAPSOOVmpyt562qKGrM-Vec7szm-vxhEE",
  authDomain: "once-upon-24709.firebaseapp.com",
  projectId: "once-upon-24709",
  storageBucket: "once-upon-24709.firebasestorage.app",
  messagingSenderId: "826735245456",
  appId: "1:826735245456:web:bbde016d660736b6d2c015",
  measurementId: "G-7S9RM4C1NK"
};

const app = initializeApp(firebaseConfig);
const sourceDb = getFirestore(app); // default (US)
const targetDb = getFirestore(app, 'asia-db'); // new (Asia)

async function copyCollection(collectionName) {
  console.log(`\n--- Migrating collection: ${collectionName} ---`);
  const snapshot = await getDocs(collection(sourceDb, collectionName));
  const total = snapshot.docs.length;
  console.log(`Found ${total} documents in '${collectionName}'`);

  if (total === 0) return;

  const BATCH_SIZE = 400; // Firestore batch write limit is 500
  let batch = writeBatch(targetDb);
  let batchCount = 0;
  let copied = 0;

  for (const docSnap of snapshot.docs) {
    const docRef = doc(targetDb, collectionName, docSnap.id);
    batch.set(docRef, docSnap.data());
    batchCount++;
    copied++;

    if (batchCount >= BATCH_SIZE) {
      console.log(`Writing batch of ${batchCount} documents... (${copied}/${total})`);
      await batch.commit();
      batch = writeBatch(targetDb);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    console.log(`Writing final batch of ${batchCount} documents... (${copied}/${total})`);
    await batch.commit();
  }

  console.log(`Successfully migrated ${copied} documents for '${collectionName}'!`);
}

async function runMigration() {
  console.log('Starting migration from (default) to asia-db...');
  const collections = [
    'products',
    'counters',
    'subscribers',
    'ambassadors',
    'tracked_links',
    'orders'
  ];

  for (const col of collections) {
    await copyCollection(col);
  }

  console.log('\nAll collections successfully migrated to asia-db!');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

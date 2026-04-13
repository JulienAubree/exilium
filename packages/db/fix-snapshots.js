#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const metaDir = path.join(__dirname, 'drizzle/meta');

// Function to read and generate a unique ID for snapshots
function generateNewId() {
  // Generate a pseudo-random UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0,
        v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Read both problematic snapshots
const snap21Path = path.join(metaDir, '0021_snapshot.json');
const snap22Path = path.join(metaDir, '0022_snapshot.json');

const snap21 = JSON.parse(fs.readFileSync(snap21Path, 'utf8'));
const snap22 = JSON.parse(fs.readFileSync(snap22Path, 'utf8'));

// Get the ID from 0021 to use as prevId for 0022
const snap21Id = snap21.id;

// Generate a new unique ID for 0022
const newSnap22Id = generateNewId();

// Update 0022 with correct prevId pointing to 0021
snap22.id = newSnap22Id;
snap22.prevId = snap21Id;

// Write back
fs.writeFileSync(snap22Path, JSON.stringify(snap22, null, 2) + '\n', 'utf8');

console.log('Fixed snapshot collision:');
console.log(`0021: id=${snap21Id}`);
console.log(`0022: id=${newSnap22Id}, prevId=${snap21Id}`);
console.log('Done!');

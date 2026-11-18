const add = require('./add');
if (add(1, 2) !== 3) { console.error('add が壊れています'); process.exit(1); }
console.log('ok');

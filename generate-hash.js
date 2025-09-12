const bcrypt = require('bcryptjs');

const password = 'admin123';
const rounds = 12;

const hash = bcrypt.hashSync(password, rounds);
console.log('Password:', password);
console.log('Hash:', hash);

// Test the hash
const isValid = bcrypt.compareSync(password, hash);
console.log('Hash validation:', isValid);

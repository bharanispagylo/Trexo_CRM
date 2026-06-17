const fs = require('fs');
const content = fs.readFileSync('src/components/pages/Operations/Tasks.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 4201; i <= 4300; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}

const fs = require('fs');
const vm = require('vm');
try {
  const code = fs.readFileSync('../api/index.js', 'utf8');
  new vm.Script(code);
  console.log('index.js syntax is 100% VALID!');
} catch (err) {
  console.error('Syntax error found in index.js:', err.message);
  console.error(err.stack);
}

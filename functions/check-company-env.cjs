// Runs before `firebase deploy --only functions` (see "predeploy" in firebase.json).
//
// The offers and e-mails read the business details from functions/.env (see .env.example).
// Without that file the functions fall back to fictional example details and mail the owner
// notifications to an example address. That would go wrong silently, so stop the deploy instead.
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs
  .readdirSync(dir)
  .filter(name => /^\.env(\.[\w-]+)?$/.test(name) && name !== '.env.local' && name !== '.env.example');

const content = files.map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
const email = /^\s*COMPANY_EMAIL\s*=\s*"?([^"\r\n#]+?)"?\s*(#.*)?$/m.exec(content)?.[1]?.trim();

if (!email || email.endsWith('.example')) {
  console.error(
    '\nDeploy stopped: functions/.env is missing or still has the example details.\n' +
      'Copy functions/.env.example to functions/.env and fill in your own business details.\n',
  );
  process.exit(1);
}
// The other way round: the real details belong in functions/.env only. If one of them shows up in the
// source code again (this repo is published as a showcase), stop as well.
function sourceFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

const secretKeys = ['COMPANY_ADDRESS', 'COMPANY_PHONE', 'COMPANY_KVK', 'COMPANY_VAT', 'COMPANY_EMAIL'];
const secrets = secretKeys
  .map(key => ({
    key,
    value: new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\r\\n#]+?)"?\\s*(#.*)?$`, 'm').exec(content)?.[1]?.trim(),
  }))
  .filter(item => item.value && item.value.length >= 6);

const leaks = [];
for (const file of sourceFiles(path.join(dir, 'src'))) {
  const text = fs.readFileSync(file, 'utf8');
  for (const { key, value } of secrets) {
    if (text.includes(value)) leaks.push(`${path.relative(dir, file)} contains the value of ${key}`);
  }
}
if (leaks.length > 0) {
  console.error('\nDeploy stopped: business details are hardcoded in the source:\n  ' + leaks.join('\n  ') +
    '\nUse getCompany() from src/shared/company.ts instead.\n');
  process.exit(1);
}

console.log(`Business details found in ${files.join(', ')} (COMPANY_EMAIL=${email}); none hardcoded in src/.`);

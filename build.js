/**
 * Monorepo build script for Firebase App Hosting.
 *
 * Firebase App Hosting runs `npm run build` to compile the app.
 * The @apphosting/adapter-angular reads `angular.json`'s `defaultProject`
 * field to locate the build output manifest.
 *
 * This script reads ANGULAR_PROJECT from the environment, sets `defaultProject`
 * in angular.json, then runs `ng build <project>`.
 *
 * apphosting.quote.yaml sets ANGULAR_PROJECT=quote-tool at BUILD time.
 */

const { execSync } = require('child_process');
const fs = require('fs');

const project = process.env.ANGULAR_PROJECT || 'quote-tool';

// Read and patch angular.json
const angularJson = JSON.parse(fs.readFileSync('angular.json', 'utf8'));
angularJson.defaultProject = project;
fs.writeFileSync('angular.json', JSON.stringify(angularJson, null, 2));

console.log(`Building Angular project: ${project}`);
execSync(`npx ng build ${project}`, { stdio: 'inherit' });

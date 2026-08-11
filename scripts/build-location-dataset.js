#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SOURCE_RELEASE = 'v3.2-export.6';
const SOURCE_COMMIT = '71dbdcca522725b1c7290c0ff2fafd0902904fec';
const SOURCE_SHA256 = 'c93ad3c0eeab9e11850020d214a0c25ee2b97113d637d052ffa3064860b0e234';
const SOURCE_URL = `https://github.com/dr5hn/countries-states-cities-database/releases/tag/${SOURCE_RELEASE}`;
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '../src/data/locations/v1.json');

function fail(message) {
  throw new Error(message);
}

function nonEmptyText(value, label) {
  const text = String(value || '').trim();
  if (!text) fail(`${label} is required.`);
  return text;
}

function uniqueCode(code, seen, label) {
  if (!/^[A-Z0-9_-]{1,32}$/.test(code)) fail(`${label} has an invalid code: ${code}`);
  if (seen.has(code)) fail(`${label} has a duplicate code: ${code}`);
  seen.add(code);
}

function sortByName(left, right) {
  return left.name.localeCompare(right.name, 'tr', { sensitivity: 'base' })
    || left.code.localeCompare(right.code, 'en');
}

function compactDataset(source) {
  if (!Array.isArray(source)) fail('Source dataset must be an array.');

  const countryCodes = new Set();
  const countries = source.map((country) => {
    const code = nonEmptyText(country.iso2, 'Country').toUpperCase();
    uniqueCode(code, countryCodes, 'Country');

    const subdivisionCodes = new Set();
    const subdivisions = (Array.isArray(country.states) ? country.states : [])
      .filter((subdivision) => Array.isArray(subdivision.cities) && subdivision.cities.length > 0)
      .map((subdivision) => {
        const subdivisionCode = nonEmptyText(
          subdivision.iso2 || `S${subdivision.id}`,
          `Subdivision in ${code}`
        ).toUpperCase();
        uniqueCode(subdivisionCode, subdivisionCodes, `Subdivision in ${code}`);

        const localityCodes = new Set();
        const localities = subdivision.cities.map((locality) => {
          const localityCode = nonEmptyText(locality.id, `Locality in ${code}/${subdivisionCode}`);
          uniqueCode(localityCode, localityCodes, `Locality in ${code}/${subdivisionCode}`);

          return {
            code: localityCode,
            name: nonEmptyText(locality.name, `Locality ${localityCode}`)
          };
        }).sort(sortByName);

        return {
          code: subdivisionCode,
          name: nonEmptyText(subdivision.native || subdivision.name, `Subdivision ${subdivisionCode}`),
          localities
        };
      }).sort(sortByName);

    if (!subdivisions.length) return null;

    return {
      code,
      name: nonEmptyText(
        country.translations && country.translations.tr
          ? country.translations.tr
          : country.native || country.name,
        `Country ${code}`
      ),
      subdivisions
    };
  }).filter(Boolean).sort(sortByName);

  const subdivisionCount = countries.reduce((total, country) => total + country.subdivisions.length, 0);
  const localityCount = countries.reduce(
    (total, country) => total + country.subdivisions.reduce(
      (countryTotal, subdivision) => countryTotal + subdivision.localities.length,
      0
    ),
    0
  );

  return {
    version: 'v1',
    source: 'Countries States Cities Database',
    sourceUrl: SOURCE_URL,
    sourceRelease: SOURCE_RELEASE,
    sourceCommit: SOURCE_COMMIT,
    sourceSha256: SOURCE_SHA256,
    license: 'ODbL-1.0',
    transformations: [
      'Removed fields not required by enrollment.',
      'Localized country names to Turkish when available.',
      'Removed subdivisions without localities and countries without usable subdivisions.',
      'Sorted labels using the Turkish locale.'
    ],
    counts: {
      countries: countries.length,
      subdivisions: subdivisionCount,
      localities: localityCount
    },
    countries
  };
}

function main() {
  const sourcePath = process.argv[2];
  const outputPath = path.resolve(process.argv[3] || DEFAULT_OUTPUT_PATH);
  if (!sourcePath) {
    fail('Usage: node scripts/build-location-dataset.js <source.json.gz> [output.json]');
  }

  const compressed = fs.readFileSync(path.resolve(sourcePath));
  const sha256 = crypto.createHash('sha256').update(compressed).digest('hex');
  if (sha256 !== SOURCE_SHA256) {
    fail(`Unexpected source SHA-256: ${sha256}`);
  }

  const source = JSON.parse(zlib.gunzipSync(compressed));
  const dataset = compactDataset(source);
  const serialized = `${JSON.stringify(dataset)}\n`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, 'utf8');

  console.log(JSON.stringify({
    outputPath,
    bytes: Buffer.byteLength(serialized),
    sha256: crypto.createHash('sha256').update(serialized).digest('hex'),
    counts: dataset.counts
  }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  compactDataset
};

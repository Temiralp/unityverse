# Location dataset notice

The generated `v1.json` database is derived from the Countries States Cities
Database and is distributed separately from the application source under the
Open Database License (ODbL) v1.0.

- Source: https://github.com/dr5hn/countries-states-cities-database
- Release: `v3.2-export.6`
- Commit: `71dbdcca522725b1c7290c0ff2fafd0902904fec`
- Retrieved: 2026-08-11
- Source artifact: `json-countries+states+cities.json.gz`
- Source SHA-256: `c93ad3c0eeab9e11850020d214a0c25ee2b97113d637d052ffa3064860b0e234`
- Generated `v1.json` SHA-256: `177598926d7e049ad2920ec8e2db2837c7f31b0fac7998f5054b88b12ee141d8`
- Generated records: 223 countries, 4,279 subdivisions, 152,970 localities
- License: https://opendatacommons.org/licenses/odbl/1-0/

Attribution:

> Data by Countries States Cities Database  
> https://github.com/dr5hn/countries-states-cities-database | ODbL v1.0

## Applied transformation

The deterministic generator at `scripts/build-location-dataset.js`:

1. removes coordinates, timezones, currencies, postcodes and other fields not
   needed by the enrollment form;
2. keeps stable country, subdivision and locality identifiers plus labels;
3. uses the Turkish country translation when the source provides one;
4. removes subdivisions without localities and countries without a usable
   subdivision/locality hierarchy; and
5. sorts labels using the Turkish locale.

The generated database remains available in this repository under ODbL v1.0.
Application code is not part of this database and retains its own license.

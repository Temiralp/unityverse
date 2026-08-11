# Location dataset v1

`v1.json` is a versioned, immutable location dataset loaded by
`src/services/locations.js`.

Expected schema:

```json
{
  "version": "v1",
  "source": "upstream dataset name or URL",
  "license": "upstream license identifier",
  "sourceRelease": "upstream release identifier",
  "sourceCommit": "40-character upstream Git commit SHA",
  "sourceSha256": "64-character SHA-256 of the upstream source artifact",
  "countries": [
    {
      "code": "TR",
      "name": "Türkiye",
      "subdivisions": [
        {
          "code": "34",
          "name": "İstanbul",
          "localities": [
            { "code": "107763", "name": "Kadıköy" }
          ]
        }
      ]
    }
  ]
}
```

Codes must be non-empty and unique among siblings; names must be non-empty.
Country codes are ISO 3166-1 alpha-2. Subdivision and locality codes are stable
source identifiers. Every included country and subdivision must have at least
one child record.

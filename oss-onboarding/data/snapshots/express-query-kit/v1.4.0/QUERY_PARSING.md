# Query Parsing Specifications

This document defines the query parsing syntax supported by Express Query Kit.

## Supported Operators
| Operator | HTTP Query Example | MongoDB Equivalent | SQL Equivalent |
|---|---|---|---|
| `eq` | `?filter[status]=active` | `{ status: 'active' }` | `status = 'active'` |
| `ne` | `?filter[status][ne]=archived` | `{ status: { $ne: 'archived' } }` | `status <> 'archived'` |
| `gt` | `?filter[age][gt]=21` | `{ age: { $gt: 21 } }` | `age > 21` |
| `gte` | `?filter[score][gte]=80` | `{ score: { $gte: 80 } }` | `score >= 80` |
| `lt` | `?filter[price][lt]=100` | `{ price: { $lt: 100 } }` | `price < 100` |
| `lte` | `?filter[rating][lte]=5` | `{ rating: { $lte: 5 } }` | `rating <= 5` |
| `in` | `?filter[role][in]=admin,mod` | `{ role: { $in: ['admin', 'mod'] } }` | `role IN ('admin', 'mod')` |
| `like` | `?filter[name][like]=John` | `{ name: { $regex: 'John', $options: 'i' } }` | `name ILIKE '%John%'` |

## Range Parsing
Multiple range bounds can be applied on the same key:
```
GET /api/products?filter[price][gte]=20&filter[price][lte]=150
```
This parses into:
```json
{
  "price": { "$gte": 20, "$lte": 150 }
}
```

## Date & Time Handling
ISO 8601 timestamps are automatically converted to JavaScript `Date` instances when the schema identifies the target field as a temporal attribute:
```
GET /api/events?filter[createdAt][gte]=2026-01-01T00:00:00.000Z
```

# Gold Inr Open Intrest API

Production-ready .NET 10 Web API for MCX GOLD option-chain data.

## What it does

- Fetches GOLD option-chain data through `HttpClient`
- Uses browser-like headers and cookie support
- Caches each expiry for 5 minutes
- Exposes JSON and PNG chart endpoints
- Logs upstream requests and failures

## Run

```powershell
dotnet restore
dotnet run
```

By default the app listens on the standard ASP.NET Core development port(s) shown in the console.

## Endpoints

### JSON

```http
GET /api/options/gold?expiry=27MAY2026
```

Returns:

```json
[
  {
    "strikePrice": 10000,
    "callOI": 12345,
    "putOI": 23456
  }
]
```

### Chart

```http
GET /api/options/gold/graph?expiry=27MAY2026
```

Returns a PNG chart with strike price on the X-axis and open interest on the Y-axis.

## Test with curl

```powershell
curl "https://localhost:5001/api/options/gold?expiry=2026-04-30"
curl -o gold.png "https://localhost:5001/api/options/gold/graph?expiry=27MAY2026"
```

## Configuration

The MCX upstream path is isolated in `appsettings.json`:

- `McxApi:BaseUrl`
- `McxApi:CandidatePaths`
- `McxApi:UserAgent`
- `McxApi:Referer`

If MCX changes its backend contract, update `CandidatePaths` instead of the controller code.

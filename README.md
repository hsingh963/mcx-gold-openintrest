# MCX Gold Open Interest

## Run

```powershell
dotnet restore .\GoldInrOpenIntrest.Api.csproj
dotnet run --project .\GoldInrOpenIntrest.Api.csproj --urls http://localhost:5055
```

Open:

```text
http://localhost:5055
```

## API

```text
GET /api/options/expiries
GET /api/options/gold/analysis?expiry=27MAY2026
```

## Notes

- The UI is served from `wwwroot/index.html`
- The chart is rendered in the browser with Chart.js
- Expiries are loaded from `expiries.txt`

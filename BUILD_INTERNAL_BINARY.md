# Build the internal go-music-api binary

The Feiniu N100 uses Linux amd64.

The plugin expects this file:

```text
bin/go-music-api-linux-amd64
```

## Build on a Linux amd64 machine or Feiniu NAS

```bash
cd go-music-api
go mod download
CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o go-music-api-linux-amd64 .
```

Then place the binary here:

```text
songloft-plugin-go-music/bin/go-music-api-linux-amd64
```

Rebuild the plugin:

```bash
cd songloft-plugin-go-music
npm run build
```

## Runtime

The plugin starts the binary with:

```text
GO_MUSIC_PORT=17890
PORT=17890
GIN_MODE=release
```

So the internal API listens at:

```text
http://127.0.0.1:17890
```

## Build with GitHub Actions

In your fork of `go-music-api`, add or keep:

```text
.github/workflows/songloft-linux-amd64.yml
```

Then open GitHub:

```text
Actions -> Build Songloft Linux amd64 Binary -> Run workflow
```

Download the artifact named:

```text
go-music-api-linux-amd64
```

Place it in:

```text
songloft-plugin-go-music/bin/go-music-api-linux-amd64
```

Then rebuild the Songloft plugin zip:

```bash
cd songloft-plugin-go-music
npm run build
```

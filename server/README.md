# The community server (E4)

PHP 8.2+, PDO MySQL, MariaDB 10.6+ (or MySQL 8), Apache 2.4 with
`mod_rewrite`, `mod_headers`, and `AllowOverride All`. No node, GD, shell or cron
is needed on the host. The game is at the HTTPS root of its own subdomain.

## Local development

1. Create a **scratch** database and run `server/schema.sql` in it.
2. Copy `server/config.example.php` to `server/config.php`. Set the database
   credentials and a random 64-character hex `ip_secret`. Never commit it.
3. `npm run api` serves the API at `127.0.0.1:8081`; `npm run dev -- --host`
   serves the game and proxies `/api`. `GYRO_API` changes Vite's proxy target.
   Without a config or a database, every request is answered with HTTP 503 and
   the game says the community server isn't set up.
4. Open `/profile`. Pick a name, copy its code, restore it on another browser,
   save the data, and delete the online profile.

`npm run api` can run the database too, if it's a MariaDB of your own with its
settings in `~/.local/share/gyrorocket/my.cnf` (or the file `GYRO_DB` names):

```ini
[mariadbd]
datadir=/home/you/.local/share/gyrorocket/db
socket=/home/you/.local/share/gyrorocket/db.sock
pid-file=/home/you/.local/share/gyrorocket/db.pid
log-error=/home/you/.local/share/gyrorocket/db.log
port=13306
bind-address=127.0.0.1
```

Make the data directory once with `mariadb-install-db --no-defaults
--datadir=…`, start it, and create the database, its user and the schema as in
steps 1 and 2. From then on, if nothing answers on that port, `npm run api`
starts `mariadbd` with that file before PHP, and stops it again when the API
stops; one that's already running is left alone. Keep the data directory out of
the project: deploying uploads everything under `server/` but `config.php`.

The PHP development router exposes only API responses. It never serves the
private directory. `GYRO_CONFIG=/absolute/path/config.php` selects an alternative
local config without changing checked-in files.

`npm test` always tests the JS client. `GYRO_API=http://127.0.0.1:8081 npm test`
also runs the API suite. To exercise rate limits, schema changes, token hashing,
cascading deletion and bans, set `GYRO_TEST_CONFIG` to the **same scratch config**.
That enables direct test DB access. The test config should give each limit 1000
requests normally; the suite fills and clears buckets in its scratch database.
The scratch database name must start with `gyro_test`; the helper refuses others.
Never run the integration suite against a production database.

## Hosting and deployment

1. Create the database in the host's control panel. Import `server/schema.sql`
   in phpMyAdmin. Give the web DB user only SELECT, INSERT, UPDATE and DELETE.
2. Copy `deploy.example.json` to the ignored `deploy.json`. Choose `ftps`, `ftp`
   or `ssh`; SSH uses your key with BatchMode. FTPS uses explicit TLS on port 21.
   FTP/FTPS require local `curl`, SSH requires local `ssh` and `scp` with SFTP.
3. Set `webRoot` to the upload path of the subdomain's document root.
   `serverDir` is relative to that root, preferably `../gyrorocket-server`.
   PHP and FTP must see the same directory relationship. If the host confines
   uploads to the document root, use exactly `server`; two `.htaccess` guards
   deny it. The upload paths on FTP are relative to the FTP login directory.
4. Run `npm run deploy -- --dry-run` to inspect the exact files and locations.
5. Upload your real `config.php` manually into the private server directory.
   Deploy never overwrites or uploads it.
6. `npm run deploy` builds, seeds the built-in IDs/hashes and sim version, and
   uploads the game and PHP. Private-directory guards go first, assets before
   the new HTML, and every file is renamed into place after it fully uploads.
   Old assets are retained so an open game keeps working during deployment.
7. For future changes, upload the code, run numbered SQL migrations by hand in
   phpMyAdmin, and check `/api/health`. Until the DB version matches the code,
   the API returns JSON with HTTP 503. Initial schema version is 1.

Check HTTPS, `/play/1-3`, `/editor`, `/profile`, a missing API route, the response
headers, and that `/server/config.php` and `/server/schema.sql` return 403.
HSTS is set only on HTTPS. CSP includes the exact hash of the built inline theme
script; it permits same-site scripts, workers and connections, and inline styles
used by the game's HUD. Use the hosting control panel to disable PHP display
errors globally as well. API exceptions already return generic JSON.

The API trusts `REMOTE_ADDR`, never an arbitrary forwarded header. If a host uses
a reverse proxy, configure its trusted proxy address handling in Apache so rate
limits see the connecting client. Address HMACs change daily; expired buckets are
pruned during requests. No player tokens or request bodies should be included in
host access logs.

## API

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/api/health` | `{ api, sim, schema }`; 503 during updates |
| POST | `/api/players` | `{}` → `{ token, player }` (201) |
| GET | `/api/players/me` | `{ player }` |
| PATCH | `/api/players/me` | `{ name }` → `{ player }` |
| DELETE | `/api/players/me` | `{}` → `{ forgotten: true }` |
| GET | `/api/players/me/data` | All of this player's online data |

All player-specific routes require `Authorization: Bearer <64 hex characters>`.
No cookies or CORS. Writes require `Content-Type: application/json`; only known
fields are accepted, bodies are limited to 128 KiB and JSON to 16 levels deep.
Errors are `{ error }` with 400, 401, 403, 404, 405, 409, 413, 415, 429 or 503.
429 includes `Retry-After`. Names are trimmed, 3–16 ASCII letters/digits/spaces,
hyphens or underscores, with at least one letter or digit; uniqueness ignores
case. The token is generated once, stored only as a SHA-256 hash on the server,
and cannot be retrieved or reset.

Levels, scores, checks, ratings, plays and reports have their schema ready for
E5/E6; those endpoints are not implemented in E4. Their foreign keys already
ensure Forget me removes owned data and references to deleted content. Stats in
E7 will be separate, anonymous tables. Moderation queries are in `admin.sql`.

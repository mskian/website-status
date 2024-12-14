# Website Status

CLI to check website HTTP status and send notifications to Self-hosted ntfy push server.  

## Usage

- clone or download this repo
- install the packages

```sh
pnpm install
```

- create `.env` file and add your ntfy URL **(Important Step)**

**Example**  

```env
NTFY_BASE_URL=https://ntfy.sh
```

- you can also include the ENV Variable like this

```sh
NTFY_BASE_URL=https://ntfy.sh pnpm dev -u "https://example.com" -t "status"
```

- Test CLI

**Example**  

```sh
pnpm dev -u "https://example.com" -t "status"
```

- build CLI

```sh

## Build CLI
pnpm build

## Test the Production CLI
pnpm start -u "https://example.com" -t "status"

```

- Link and run the CLI Locally

```sh
pnpm link --global
```

- Run the CLI

**Example**  

```sh
website -u "https://example.com" -t "status"
```

- unlink CLI

```sh
pnpm uninstall --global website-status
```

## Push Notification

For Notification Updates you can try `htfy.sh` self-hosted push notification service while setup replace `ntfy.sh` URL with your push server URL in `.env` File.  

> **I mainly built this CLI for my tasker and termux automations.**  

## LICENSE

MIT

# Tunnel Sevice

This is an experimental tunnel service for http,
it supports authentication and load balancing

## Installation
```shell
npm -g install @eslym/tunnel
mkdir tunnel-service
cd tunnel-service
ssh-keygen -f server_key.pem
mkdir users
```
## Configuration
The directory for user configuration
```
users
└── username.yml
```
The extension may be `yml`, `json` or `json5`, the content of the file is like:
```yaml
password: "" # Bcrypt hash
keys:
  - ssh-rsa ... # ssh keys
domains: # Allowed domains
  - "**" # Catch all
  - "example.com" # Match exact
  - "*.example.com" # Match wildcard
  - "**.example.com" # Catch all including subdomains
```
The user must have either key or password.

## Start the service
```shell
tunnel-service -H $HTTP_PORT -s $SSH_PORT -k ./tunnel.pem -a ./users
```

## Connect the service
```shell
ssh -R $BIND_DOMAIN:$BIND_PORT:$LOCAL_ADDR:$LOCAL_PORT username@$SERVICE_HOST -p $SSH_PORT
```
The port forward is just virtually bound, the `BIND_PORT` is either `80` or `443`,
use `80` when the local server is serving `http`, use `443` when local server is serving `https`.

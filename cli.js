#!/usr/bin/node

if (process.env.NODE_ENV === 'production') {
    require('./dist/cli');
} else {
    require('ts-node').register();
    require('./src/cli');
}

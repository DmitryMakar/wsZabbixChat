#!/bin/bash

./stopChat.sh

pm2 ls

./purgeLogs.sh

rm -rf ./wsServer/node_modules
rm -rf ./wsBridge/node_modules



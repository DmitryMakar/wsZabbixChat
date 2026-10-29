#!/bin/bash

cd wsServer
./startServer.sh
cd ../

cd wsBridge
./startBridge.sh
cd ../

sleep 3
./displayLogs.sh




#!/bin/bash

cd wsBridge
./curl.sh
./sendTest.sh
cd ../

sleep 5
./displayLogs.sh




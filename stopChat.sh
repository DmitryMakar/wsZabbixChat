#!/bin/bash

pm2 stop   wsBridge
pm2 delete wsBridge

pm2 stop   wsServer
pm2 delete wsServer

pm2 ls





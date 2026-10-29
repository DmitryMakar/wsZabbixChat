#!/bin/bash

#curl -X POST -H "Content-Type: application/json" -d '{"key":"value"}' http://example.com/api

#curl -X POST -H "Content-Type: application/json" -d '{"command":"STATUS"}' http://www.dmpsy.ru:3778

#curl -X POST -H "Content-Type: application/json" -d '{"command":"STATUS"}' http://localhost:3778

curl -X POST -H "Content-Type: application/json" -d '{"command":"PUBLIC_MSG","text":"Test message from wsBridge"}' http://localhost:3778

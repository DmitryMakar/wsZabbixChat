#!/bin/bash

#set 1 to generate a problem with the test.webhook data item on the server
zabbix_sender -z 127.0.0.1 -s "Zabbix server" -k test.webhook -o 1

#delay 5 seconds
sleep 5

#set 7 to resolve the problem with the test.webhook data item on the server
zabbix_sender -z 127.0.0.1 -s "Zabbix server" -k test.webhook -o 7

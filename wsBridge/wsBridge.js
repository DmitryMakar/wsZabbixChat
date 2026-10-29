const WebSocket = require('ws');
const express = require('express');
// Импортируем конфигурационный файл
const config = require('./config.json');

const app = express();
app.use(express.json());

// Используем адрес из конфигурации
const wsUrl = config.wsUrl;
let ws = new WebSocket(wsUrl);

ws.on('open', () => {
	console.log('Connected to WSS');
        if (ws.readyState === WebSocket.OPEN) {
        	ws.send(JSON.stringify({ command: 'LOGIN', username: 'Zabbix Server' }));
    	} else {
        	console.log('WebSocket is not open');
    	};
   });

ws.on('close', () => {
        console.log('Disconnecting from WSS...');
        if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ command: 'LOGOUT', username: 'Zabbix Server' }));
        } else {
                console.log('WebSocket is not open');
        };
   });

ws.on('error', console.error);

// Принимаем POST запрос от Zabbix
app.post('/', (req, res) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(req.body));
        res.status(200).send('Message sent to WSS');
    } else {
        res.status(503).send('WSS disconnected');
    }
});

// Основная функция завершения работы
async function gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Starting cleanup...`);

    // Проверяем, активно ли соединение с wsServer
    if (ws.readyState === WebSocket.OPEN) {
        try {
            // Отправляем сообщение LOGOUT
            const logoutMsg = JSON.stringify({ command: 'LOGOUT', username: 'Zabbix Server'  });
            ws.send(logoutMsg);
            console.log('LOGOUT message sent to wsServer');

            // Небольшая задержка, чтобы сообщение точно ушло перед закрытием сокета
            await new Promise(resolve => setTimeout(resolve, 500));
            ws.close();
        } catch (err) {
            console.error('Error sending LOGOUT:', err);
        }
    }

    // Завершаем процесс
    console.log('Shutting down wsBridge...');
    process.exit(0);
}

// Слушаем системные сигналы (например, от systemd или Docker)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Обычное завершение
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C в консоли

// Используем порт из конфигурации (с резервным вариантом)
const PORT = config.port || 3778;
app.listen(PORT, () => console.log(`Bridge listening on port ${PORT}`));

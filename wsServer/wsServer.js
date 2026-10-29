const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'chat.log');
const HISTORY_LINES_COUNT = 30; // Сколько последних сообщений загружать из истории

function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
}

// Универсальная функция логирования
function writeLog(type, message) {
    const logLine = `[${getTimestamp()}] [${type}] ${message}\n`;
    console.log(`[${type}] ${message}`);

    fs.appendFile(LOG_FILE, logLine, 'utf8', (err) => {
        if (err) console.error(`[ERROR] Не удалось записать в лог-файл: ${err.message}`);
    });
}

// Функция для безопасного чтения истории (ИСКЛЮЧАЕТ ПРИВАТ)
function sendSafeHistory(ws) {
    if (!fs.existsSync(LOG_FILE)) return;

    fs.readFile(LOG_FILE, 'utf8', (err, data) => {
        if (err) {
            writeLog('ERROR', `Не удалось прочитать историю: ${err.message}`);
            return;
        }

        const lines = data.split('\n').filter(line => line.trim() !== '');
        const publicMessages = [];

        // Фильтруем строки: ищем только PUBLIC_MSG
        // Формат строки: [YYYY-MM-DD HH:MM:SS] [TYPE] От Имя: Текст
        for (const line of lines) {
            if (line.includes('[PUBLIC_MSG]')) {
                // Извлекаем контент сообщения из лога
                const match = line.match(/^\[.*?\]\s+\[PUBLIC_MSG\]\s+От\s+(.*?):\s+(.*)$/s);
                if (match) {
                    publicMessages.push({
                        command: 'PUBLIC_MSG',
                        user_from: match[1],
                        text: match[2]
                    });
                }
            }
        }

        // Берем только последние N сообщений
        const historyToSend = publicMessages.slice(-HISTORY_LINES_COUNT);

        // Отправляем массив истории клиенту
        if (historyToSend.length > 0) {
            ws.send(JSON.stringify({
                command: 'HISTORY_REPLY',
                data: historyToSend
            }));
        }
    });
}

// Чтение конфигурации
let port = 3777;
try {
    const configData = fs.readFileSync('config.json', 'utf8');
    const config = JSON.parse(configData);
    if (config.port) port = config.port;
} catch (err) {
    writeLog('WARN', `Ошибка конфигурации, порт по умолчанию 3777: ${err.message}`);
}

const wss = new WebSocket.Server({ port });
writeLog('SYSTEM', `wsChat Server запущен на порту: ${port}`);

function broadcastUserList() {
    const users = [];
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.isLoggedIn) {
            users.push(client.username);
        }
    });

    const userListMessage = JSON.stringify({ command: 'USER_LIST', data: users });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(userListMessage);
        }
    });
}

wss.on('connection', (ws) => {
    ws.isLoggedIn = false;
    ws.username = 'Anonymous';

    ws.on('message', (rawMessage) => {
        try {
            const data = JSON.parse(rawMessage.toString());

            switch (data.command) {

                case 'LOGIN':
                    ws.username = data.username || data.user_from || 'Unknown';
                    ws.isLoggedIn = true;
                    writeLog('LOGIN', `Пользователь вошел: ${ws.username}`);

                    broadcastUserList();
                    // Отправляем безопасную историю сообщений сразу после успешного входа
                    sendSafeHistory(ws);
                    break;

                case 'LOGOUT':
                    writeLog('LOGOUT', `Пользователь вышел: ${ws.username}`);
                    ws.isLoggedIn = false;
                    broadcastUserList();
                    break;

                case 'PUBLIC_MSG':
                    writeLog('PUBLIC_MSG', `От ${ws.username}: ${data.text}`);

                    const outboundPublic = JSON.stringify({
                        command: 'PUBLIC_MSG',
                        user_from: ws.username,
                        text: data.text
                    });

                    wss.clients.forEach((client) => {
                        if (client !== ws && client.readyState === WebSocket.OPEN && client.isLoggedIn) {
                            client.send(outboundPublic);
                        }
                    });
                    break;

                case 'PRIVATE_MSG':
                    // Приват сохраняется ТУТ в файл для аудита, но функция sendSafeHistory его никогда не считает
                    writeLog('PRIVATE_MSG', `От ${ws.username} для ${data.user_to}: ${data.text}`);

                    const outboundPrivate = JSON.stringify({
                        command: 'PRIVATE_MSG',
                        user_from: ws.username,
                        text: data.text
                    });

                    wss.clients.forEach((client) => {
                        if (client.username === data.user_to && client.readyState === WebSocket.OPEN) {
                            client.send(outboundPrivate);
                        }
                    });
                    break;

                default:
                    writeLog('WARN', `Неизвестная команда от ${ws.username}: ${data.command}`);
            }

        } catch (error) {
            writeLog('ERROR', `Ошибка обработки JSON: ${error.message}`);
        }
    });

    ws.on('close', () => {
        if (ws.isLoggedIn) {
            writeLog('DISCONNECT', `Соединение разорвано: ${ws.username}`);
            ws.isLoggedIn = false;
            broadcastUserList();
        }
    });
});

// ==========================================
// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И НАСТРОЙКИ
// ==========================================
let myUsername = "User_" + Math.floor(Math.random() * 1000);
let privateRecipient = null; // Текущий получатель приватных сообщений
let cachedUsers = []; // Хранилище списка пользователей

const nicknameInput = document.getElementById('inputName');
const buttonEnter = document.getElementById('buttonEnter');
const messagesDiv = document.getElementById('messages');
const input = document.getElementById('input');

let blinkInterval = null;
const originalTitle = document.title;
const notificationSound = new Audio('icq.mp3');

// Устанавливаем сгенерированный ник в инпут
if (nicknameInput) nicknameInput.value = myUsername;

// ==========================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ОБЪЯВЛЕНЫ СРАЗУ)
// ==========================================

// Функция добавления сообщений на экран
function appendMessage(author, text, type = 'public') {
    if (!messagesDiv) return;

    const msgEl = document.createElement('div');
    msgEl.className = `msg-block`;

    if (type.includes('own')) msgEl.classList.add('msg-own');
    if (type.includes('system')) msgEl.classList.add('msg-system');
    if (type.includes('zabbix')) msgEl.classList.add('msg-zabbix');
    if (type.includes('private')) msgEl.classList.add('msg-private');

    if (type !== 'system') {
        const authorEl = document.createElement('span');
        authorEl.className = 'msg-author';
        authorEl.innerText = author + ':';
        msgEl.appendChild(authorEl);
    }

    const textEl = document.createElement('span');
    textEl.innerText = text;
    msgEl.appendChild(textEl);

    messagesDiv.appendChild(msgEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Автопрокрутка вниз
}

// Отрисовка списка пользователей
function renderUserList() {
    const list = document.getElementById('user-list');
    const countEl = document.getElementById('count');
    if (!list || !countEl) return;

    countEl.innerText = cachedUsers.length;

    list.innerHTML = cachedUsers.map(u => {
        if (u === myUsername) return `<li><b>${u} (вы)</b></li>`;
        const activeClass = (u === privateRecipient) ? 'class="active-recipient"' : '';
        return `<li ${activeClass} data-username="${u}">${u}</li>`;
    }).join('');

    // Вешаем обработчики кликов на элементы списка
    list.querySelectorAll('li[data-username]').forEach(li => {
        li.onclick = () => {
            const targetUser = li.getAttribute('data-username');
            togglePrivateMode(targetUser);
        };
    });
}

// Включение/выключение приватного режима
function togglePrivateMode(username) {
    if (!input) return;

    if (privateRecipient === username) {
        // Повторный клик — ВЫКЛЮЧАЕМ приватный режим
        privateRecipient = null;
        input.placeholder = "Напишите сообщение... (Кликните по юзеру слева для привата)";
        input.classList.remove('private-mode');
    } else {
        // Клик по другому юзеру — ВКЛЮЧАЕМ приватный режим
        privateRecipient = username;
        input.placeholder = `Приватное сообщение для ${username}... (Нажмите Enter)`;
        input.classList.add('private-mode');
    }
    renderUserList(); // Перерисовать для подсветки активного юзера
}

function startNotification() {
    notificationSound.play().catch(() => {});
    if (!blinkInterval) {
        blinkInterval = setInterval(() => {
            document.title = (document.title === originalTitle) ? "🔔 Новое сообщение!" : originalTitle;
        }, 1000);
    }
}

// ==========================================
// 3. ИНИЦИАЛИЗАЦИЯ И СЛУШАТЕЛИ СОБЫТИЙ
// ==========================================

window.addEventListener('focus', () => {
    clearInterval(blinkInterval);
    blinkInterval = null;
    document.title = originalTitle;
});

if (buttonEnter) {
    buttonEnter.onclick = () => {
        const newName = nicknameInput.value.trim();
        if (newName && newName !== myUsername) {
            myUsername = newName;
            socket.send(JSON.stringify({ command: 'LOGIN', username: myUsername }));
        }
    };
}

// Получаем адрес сервера из конфига и открываем WebSocket
const wsUrl = await fetch('config.json')
        .then(res => res.json())
        .then(cfg => cfg.wsAddress)
        .catch(() => 'wss://www.dmpsy.ru/ws');

const socket = new WebSocket(wsUrl);

window.addEventListener('beforeunload', () => {
    if (socket.readyState === 1) {
        socket.send(JSON.stringify({ command: 'LOGOUT', username: myUsername }));
        socket.close();
    }
});

socket.onopen = function () {
    appendMessage('Система', 'Соединение установлено', 'system');
    socket.send(JSON.stringify({ command: 'LOGIN', username: myUsername }));
};

socket.onmessage = function (event) {
    if (document.hidden || !document.hasFocus()) {
        startNotification();
    }

    const msg = JSON.parse(event.data);

    if (msg.command === 'USER_LIST') {
        cachedUsers = msg.data;
        renderUserList();
    } else if (msg.command === 'HISTORY_REPLY') {
        // Обработка пачки исторических сообщений
        msg.data.forEach(oldMsg => {
            const type = (oldMsg.user_from === 'Zabbix Server') ? 'zabbix' : 'public';
            appendMessage(oldMsg.user_from, oldMsg.text, type);
        });
        // Добавим системную черту, чтобы отделить историю от новых сообщений
        appendMessage('Система', '--- Загружена история публичных сообщений ---', 'system');
    } else if (msg.command === 'PUBLIC_MSG') {
        const type = (msg.user_from === 'Zabbix Server') ? 'zabbix' : 'public';
        appendMessage(msg.user_from, msg.text, type);
    } else if (msg.command === 'PRIVATE_MSG') {
        appendMessage(`[Приватно] ${msg.user_from}`, msg.text, 'private');
    }
};

if (input) {
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            const textValue = input.value;

            if (privateRecipient) {
                socket.send(JSON.stringify({
                    command: 'PRIVATE_MSG',
                    user_from: myUsername,
                    user_to: privateRecipient,
                    text: textValue
                }));
                appendMessage(`Вы -> [Приватно для ${privateRecipient}]`, textValue, 'private msg-own');
            } else {
                socket.send(JSON.stringify({
                    command: 'PUBLIC_MSG',
                    user_from: myUsername,
                    text: textValue
                }));
                appendMessage(myUsername, textValue, 'own');
            }
            input.value = '';
        }
    };
}

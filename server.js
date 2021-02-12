const express = require('express');
const { join } = require('path');
const { createServer } = require('http');
const { renderFile } = require('ejs');

const app = express();
const server = createServer(app);
const io = (require('socket.io'))(server);

app.use(express.static(join(__dirname, 'public')));
app.set('views', join(__dirname, 'public'));
app.engine('html', renderFile);
app.set('view engine', 'html');

app.use('/', (_, res) => res.render('index.html'));
app.use('/chat', (_, res) => res.render('index.html'));

const lastDate = {};
const rateLimiter = {};

const DEFAULT_USER_AVATAR = 'https://i.pinimg.com/originals/b4/00/85/b400851a6b07f8877a9236f275bd8d4f.jpg';

const mentionRegExp = new RegExp(/@(\w*[a-zA-Z0-9])/gm);

function breakString(s, a) {
    if (s.length > a) s = s.slice(0, a);
    return s;
}

function getMentions(s) {
    console.log(mentionRegExp.exec(s));
    return [];
}

io.on('connection', (socket) => {
    console.log(`Socket ${socket.id} conectado.`);

    socket.on('sendMessage', (data) => {
        // Remove additional information sended by client.
        data = {
            author: {
                name: data.author.name,
                avatar_url: data.author.avatar_url || DEFAULT_USER_AVATAR,
            },
            content: breakString(data.content, 250),
        };

        data.mentions = getMentions(data.content);

        if (data.content.length > 250) data.content = data.content.slice(0, 250);

        let lastMessageSendedDate = lastDate[socket.id];
        if (!lastMessageSendedDate) lastMessageSendedDate = Date.now();

        let rateLimit = rateLimiter[socket.id]
        if (!rateLimit) {
            rateLimiter[socket.id] = [];
            rateLimit = rateLimiter[socket.id];
        }

        if (rateLimit.length >= 5 && rateLimit.reduce((a, b) => a + b, 0) <= 800) {
            if (lastMessageSendedDate + 30 * 1000 <= Date.now()) rateLimiter[socket.id] = [];

            return socket.emit('messageNotSended', data);
        }

        if (lastMessageSendedDate <= Date.now()) {
            rateLimiter[socket.id].push(Date.now() - lastMessageSendedDate);
            lastDate[socket.id] = Date.now() + 1000;

            socket.broadcast.emit('receivedMessage', data);
            return socket.emit('messageSended', data);
        }
        
        return socket.emit('messageNotSended', data);
    });
});

io.on('disconnect', (socket) => {
    delete lastDate[socket.id];
    delete rateLimiter[socket.id];
});

server.listen(process.env.PORT || 3000, () => console.log("Running!"));

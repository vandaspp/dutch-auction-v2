
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const AUCTION_PASSWORD = "flower123";
app.use(express.static(__dirname + '/public'));

let users = {};
let auction = {
  item: "",
  price: 0,
  minPrice: 0,
  decrement: 0,
  interval: 2000,
  timer: null,
  running: false
};

let history = [];

io.on('connection', (socket) => {
  socket.on('set-nickname', (nickname) => {
    users[socket.id] = nickname;
  });

  socket.on('verify-host', (pw) => {
    socket.emit('host-verified', pw === AUCTION_PASSWORD);
  });

  socket.on('start-auction', (data) => {
    if (auction.running) return;
    auction = {
      ...data,
      interval: Number(data.interval),
      running: true,
      timer: null
    };
    io.emit('auction-started', auction);

    auction.timer = setInterval(() => {
      if (auction.price <= auction.minPrice) {
        clearInterval(auction.timer);
        auction.running = false;
        io.emit('auction-ended', { reason: 'no-bid' });
      } else {
        auction.price -= auction.decrement;
        io.emit('price-updated', { price: auction.price });
      }
    }, auction.interval);
  });

  socket.on('bid', () => {
    if (!auction.running) return;
    clearInterval(auction.timer);
    auction.running = false;
    const winner = users[socket.id] || socket.id;
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const record = {
      winner,
      item: auction.item,
      price: auction.price,
      time: timestamp
    };
    history.unshift(record);
    io.emit('auction-won', record);
    io.emit('history-updated', history.slice(0, 10));
  });

  socket.on('end-auction', () => {
    if (auction.timer) clearInterval(auction.timer);
    auction.running = false;
    io.emit('auction-ended', { reason: 'manual-stop' });
  });

  socket.on('get-history', () => {
    socket.emit('history-updated', history.slice(0, 10));
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

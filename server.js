
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const AUCTION_PASSWORD = "flower123";

app.use(express.static(__dirname + '/public'));

let auctionItems = [
  { item: "粉紅文心蘭一束", startPrice: 100, minPrice: 30, decrement: 5 },
  { item: "紅玫瑰十枝", startPrice: 200, minPrice: 50, decrement: 10 },
  { item: "百合花三支", startPrice: 150, minPrice: 60, decrement: 5 }
];

let currentIndex = 0;
let auction = {
  ...auctionItems[currentIndex],
  interval: 2000,
  running: false,
  timer: null
};

let users = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('set-nickname', (nickname) => {
    users[socket.id] = nickname;
  });

  socket.on('verify-host', (pw) => {
    if (pw === AUCTION_PASSWORD) {
      socket.emit('host-verified', true);
    } else {
      socket.emit('host-verified', false);
    }
  });

  socket.on('start-auction', () => {
    if (auction.running) return;
    auction = { ...auctionItems[currentIndex], interval: 2000, running: true };
    io.emit('auction-started', auction);

    auction.timer = setInterval(() => {
      if (auction.price <= auction.minPrice) {
        clearInterval(auction.timer);
        auction.running = false;
        io.emit('auction-ended', { reason: 'no-bid' });
        return;
      }
      auction.price -= auction.decrement;
      io.emit('price-updated', { price: auction.price });
    }, auction.interval);
  });

  socket.on('bid', () => {
    if (!auction.running) return;
    clearInterval(auction.timer);
    auction.running = false;
    const winner = users[socket.id] || socket.id;
    io.emit('auction-won', { winner, price: auction.price, item: auction.item });
    if (currentIndex + 1 < auctionItems.length) {
      currentIndex++;
      setTimeout(() => {
        io.emit('next-item-ready', auctionItems[currentIndex]);
      }, 1000);
    }
  });

  socket.on('end-auction', () => {
    if (auction.timer) clearInterval(auction.timer);
    auction.running = false;
    io.emit('auction-ended', { reason: 'manual-stop' });
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

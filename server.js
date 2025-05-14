
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname + '/public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

let auctionInterval;
let currentPrice = 0;
let auctionData = {};
let hasWinner = false;

io.on('connection', socket => {
  console.log('User connected');

  socket.on('preview', data => {
    auctionData = data;
    currentPrice = data.start;
    hasWinner = false;
    io.emit('preview', { item: data.item, start: data.start });
  });

  socket.on('start', data => {
    auctionData = data;
    currentPrice = data.start;
    hasWinner = false;
    io.emit('update', { item: data.item, price: currentPrice });
    clearInterval(auctionInterval);
    auctionInterval = setInterval(() => {
      if (currentPrice - data.decrease >= data.min) {
        currentPrice -= data.decrease;
        io.emit('update', { item: data.item, price: currentPrice });
      } else {
        clearInterval(auctionInterval);
        io.emit('stop');
      }
    }, data.interval);
  });

  socket.on('stop', () => {
    clearInterval(auctionInterval);
    io.emit('stop');
  });

  socket.on('bid', ({ user }) => {
    if (!hasWinner) {
      hasWinner = true;
      clearInterval(auctionInterval);
      io.emit('winner', { user, item: auctionData.item, price: currentPrice });
    }
  });

  socket.on('clear', () => {
    io.emit('clear');
  });
});

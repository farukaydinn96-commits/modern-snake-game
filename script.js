const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("current-score");
const highScoreElement = document.getElementById("high-score");
const gameOverScreen = document.getElementById("game-over-screen");
const restartBtn = document.getElementById("restart-btn");
const gameContainer = document.getElementById("game-container");
const finalScoreDisplay = document.getElementById("final-score-display");

const gridSize = 20;
const tileCount = canvas.width / gridSize;

let highScore = localStorage.getItem("premiumSnakeHighScore") || 0;
highScoreElement.innerText = highScore;

const bgCanvas = document.getElementById("bgCanvas");
const bgCtx = bgCanvas.getContext("2d");

function resizeBgCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeBgCanvas);
resizeBgCanvas();

const letters = "010101010101XASDFGHJKLQWERTYUIOPZXCVBNM";
const fontSize = 14;
let columns = bgCanvas.width / fontSize;
let drops = [];
for (let x = 0; x < columns; x++) drops[x] = Math.random() * 100;

function drawMatrixBackground() {
  bgCtx.fillStyle = "rgba(2, 2, 2, 0.1)";
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  for (let i = 0; i < drops.length; i++) {
    const text = letters.charAt(Math.floor(Math.random() * letters.length));

    const isPurple = Math.random() > 0.8;
    bgCtx.fillStyle = isPurple ? "#b300ff" : "#00ffcc";
    bgCtx.font = fontSize + "px monospace";
    bgCtx.fillText(text, i * fontSize, drops[i] * fontSize);

    if (drops[i] * fontSize > bgCanvas.height && Math.random() > 0.975) {
      drops[i] = 0;
    }
    drops[i] += 0.5;
  }
}
setInterval(drawMatrixBackground, 30);

function drawTronGrid() {
  ctx.strokeStyle = "rgba(0, 255, 204, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += gridSize) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = Math.random() * 4 + 1;
    this.vx = (Math.random() - 0.5) * 10;
    this.vy = (Math.random() - 0.5) * 10;
    this.life = 1.0;
    this.decay = Math.random() * 0.05 + 0.02;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
  }
}

class Snake {
  constructor() {
    this.reset();
  }

  reset() {
    this.body = [{ x: 10, y: 10 }];
    this.dx = 0;
    this.dy = 0;
    this.tailLength = 3;
  }

  update() {
    const head = { x: this.body[0].x + this.dx, y: this.body[0].y + this.dy };
    this.body.unshift(head);
    while (this.body.length > this.tailLength) {
      this.body.pop();
    }
  }

  draw(ctx) {
    this.body.forEach((part, index) => {
      ctx.fillStyle =
        index === 0
          ? "#00ffcc"
          : `rgba(0, 200, 150, ${1 - index / this.body.length})`;
      ctx.shadowBlur = index === 0 ? 15 : 0;
      ctx.shadowColor = "#00ffcc";
      ctx.fillRect(
        part.x * gridSize + 1,
        part.y * gridSize + 1,
        gridSize - 2,
        gridSize - 2,
      );
      ctx.shadowBlur = 0;
    });
  }

  setDirection(dx, dy) {
    if (this.dx === 0 && dx !== 0) {
      this.dx = dx;
      this.dy = 0;
    } else if (this.dy === 0 && dy !== 0) {
      this.dy = dy;
      this.dx = 0;
    }
  }

  checkCollision() {
    const head = this.body[0];
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount)
      return true;
    for (let i = 1; i < this.body.length; i++) {
      if (head.x === this.body[i].x && head.y === this.body[i].y) return true;
    }
    return false;
  }
}

class Food {
  constructor() {
    this.respawn([]);
  }

  respawn(snakeBody) {
    let isOccupied = true;
    while (isOccupied) {
      this.x = Math.floor(Math.random() * tileCount);
      this.y = Math.floor(Math.random() * tileCount);
      isOccupied = snakeBody.some(
        (part) => part.x === this.x && part.y === this.y,
      );
    }
  }

  draw(ctx) {
    ctx.fillStyle = "#ff0055";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ff0055";
    ctx.fillRect(
      this.x * gridSize + 2,
      this.y * gridSize + 2,
      gridSize - 4,
      gridSize - 4,
    );
    ctx.shadowBlur = 0;
  }
}

class Game {
  constructor() {
    this.snake = new Snake();
    this.food = new Food();
    this.particles = [];
    this.score = 0;
    this.isGameOver = false;
    this.lastRenderTime = 0;
    this.snakeSpeed = 8;
  }

  start() {
    this.setupKeyboardControls();
    this.setupSwipeControls();
    restartBtn.addEventListener("click", () => this.restart());
    window.requestAnimationFrame((time) => this.loop(time));
  }

  setupKeyboardControls() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "w") this.snake.setDirection(0, -1);
      else if (e.key === "ArrowDown" || e.key === "s")
        this.snake.setDirection(0, 1);
      else if (e.key === "ArrowLeft" || e.key === "a")
        this.snake.setDirection(-1, 0);
      else if (e.key === "ArrowRight" || e.key === "d")
        this.snake.setDirection(1, 0);
    });
  }

  setupSwipeControls() {
    let touchStartX = 0;
    let touchStartY = 0;

    window.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      },
      { passive: false },
    );

    window.addEventListener(
      "touchmove",
      (e) => {
        if (e.target === canvas) e.preventDefault();
      },
      { passive: false },
    );

    window.addEventListener("touchend", (e) => {
      let touchEndX = e.changedTouches[0].screenX;
      let touchEndY = e.changedTouches[0].screenY;
      let dx = touchEndX - touchStartX;
      let dy = touchEndY - touchStartY;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) this.snake.setDirection(1, 0);
        else if (dx < -30) this.snake.setDirection(-1, 0);
      } else {
        if (dy > 30) this.snake.setDirection(0, 1);
        else if (dy < -30) this.snake.setDirection(0, -1);
      }
    });
  }

  restart() {
    this.snake.reset();
    this.food.respawn(this.snake.body);
    this.particles = [];
    this.score = 0;
    this.isGameOver = false;
    this.snakeSpeed = 8;
    scoreElement.innerText = this.score;
    gameOverScreen.classList.add("hidden");
    gameContainer.classList.remove("glow-crash");
    gameContainer.classList.remove("shake");
    window.requestAnimationFrame((time) => this.loop(time));
  }

  triggerExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  checkFoodConsumption() {
    const head = this.snake.body[0];
    if (head.x === this.food.x && head.y === this.food.y) {
      this.triggerExplosion(
        this.food.x * gridSize + gridSize / 2,
        this.food.y * gridSize + gridSize / 2,
        "#ff0055",
      );

      gameContainer.classList.add("glow-eat");
      setTimeout(() => gameContainer.classList.remove("glow-eat"), 200);

      this.food.respawn(this.snake.body);
      this.snake.tailLength++;
      this.score += 10;
      scoreElement.innerText = this.score;

      if (this.score % 50 === 0) this.snakeSpeed += 1.5;
    }
  }

  handleGameOver() {
    this.isGameOver = true;
    gameContainer.classList.add("shake");
    gameContainer.classList.add("glow-crash");

    if (this.score > highScore) {
      highScore = this.score;
      localStorage.setItem("premiumSnakeHighScore", highScore);
      highScoreElement.innerText = highScore;
    }

    finalScoreDisplay.innerText = `SCORE: ${this.score}`;
    setTimeout(() => gameOverScreen.classList.remove("hidden"), 300);
  }

  loop(currentTime) {
    if (this.isGameOver) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawTronGrid();
      this.snake.draw(ctx);
      this.food.draw(ctx);
      this.particles.forEach((p) => p.draw(ctx));
      this.particles.forEach((p) => p.update());
      this.particles = this.particles.filter((p) => p.life > 0);
      if (this.particles.length > 0)
        window.requestAnimationFrame((time) => this.loop(time));
      return;
    }

    window.requestAnimationFrame((time) => this.loop(time));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTronGrid();
    this.food.draw(ctx);
    this.snake.draw(ctx);

    this.particles.forEach((p) => p.draw(ctx));
    this.particles.forEach((p) => p.update());
    this.particles = this.particles.filter((p) => p.life > 0);

    const secondsSinceLastRender = (currentTime - this.lastRenderTime) / 1000;
    if (secondsSinceLastRender < 1 / this.snakeSpeed) return;
    this.lastRenderTime = currentTime;

    if (this.snake.dx !== 0 || this.snake.dy !== 0) {
      this.snake.update();
      this.checkFoodConsumption();
    }

    if (this.snake.checkCollision()) {
      this.handleGameOver();
    }
  }
}

const game = new Game();
game.start();

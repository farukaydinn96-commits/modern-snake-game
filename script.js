window.onerror = function (message, source, lineno, colno, error) {
  alert("CRITICAL ERROR: " + message + "\nSatır: " + lineno);
  return false;
};

const bgCanvas = document.getElementById("bgCanvas");
const bgCtx = bgCanvas.getContext("2d");

function resizeBgCanvas() {
  if (bgCanvas) {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
  }
}
window.addEventListener("resize", resizeBgCanvas);
resizeBgCanvas();

const letters = "010101010101XASDFGHJKLQWERTYUIOPZXCVBNM";
let drops = Array(Math.floor((bgCanvas ? bgCanvas.width : 1000) / 14)).fill(0);

function drawMatrixBackground() {
  if (!bgCtx) return;
  bgCtx.fillStyle = "rgba(2, 2, 2, 0.1)";
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  for (let i = 0; i < drops.length; i++) {
    const text = letters.charAt(Math.floor(Math.random() * letters.length));
    bgCtx.fillStyle = Math.random() > 0.8 ? "#b300ff" : "#00ffcc";
    bgCtx.font = "14px monospace";
    bgCtx.fillText(text, i * 14, drops[i] * 14);
    if (drops[i] * 14 > bgCanvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i] += 0.5;
  }
}
setInterval(drawMatrixBackground, 30);

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
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1.0;
  }
}

class BaseSnake {
  constructor(gridSize) {
    this.gridSize = gridSize;
    this.baseSpeed = 8;
    this.scoreMultiplier = 1;
    this.color = "#00ffcc";
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
    while (this.body.length > this.tailLength) this.body.pop();
  }
  draw(ctx) {
    this.body.forEach((part, index) => {
      ctx.fillStyle =
        index === 0
          ? this.color
          : `rgba(0, 200, 150, ${1 - index / this.body.length})`;
      ctx.shadowBlur = index === 0 ? 15 : 0;
      ctx.shadowColor = this.color;
      ctx.fillRect(
        part.x * this.gridSize + 1,
        part.y * this.gridSize + 1,
        this.gridSize - 2,
        this.gridSize - 2,
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
}

class SpeedSnake extends BaseSnake {
  constructor(gridSize) {
    super(gridSize);
    this.baseSpeed = 12;
    this.scoreMultiplier = 2;
    this.color = "#ffcc00";
  }
}

class PhantomSnake extends BaseSnake {
  constructor(gridSize) {
    super(gridSize);
    this.baseSpeed = 6;
    this.color = "#b300ff";
  }
  draw(ctx) {
    ctx.globalAlpha = 0.7;
    super.draw(ctx);
    ctx.globalAlpha = 1.0;
  }
}

class Food {
  constructor(gridSize, tileCount) {
    this.gridSize = gridSize;
    this.tileCount = tileCount;
    this.respawn([], []);
  }
  respawn(snakeBody, walls) {
    let isOccupied = true;
    let attempts = 0;
    while (isOccupied && attempts < 1000) {
      this.x = Math.floor(Math.random() * this.tileCount);
      this.y = Math.floor(Math.random() * this.tileCount);
      const inSnake = snakeBody.some(
        (part) => part.x === this.x && part.y === this.y,
      );
      const inWall = walls.some(
        (wall) => wall.x === this.x && wall.y === this.y,
      );
      isOccupied = inSnake || inWall;
      attempts++;
    }
  }
  draw(ctx) {
    ctx.fillStyle = "#ff0055";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ff0055";
    ctx.fillRect(
      this.x * this.gridSize + 2,
      this.y * this.gridSize + 2,
      this.gridSize - 4,
      this.gridSize - 4,
    );
    ctx.shadowBlur = 0;
  }
}

class GameEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    const width = this.canvas.width || 400;
    this.gridSize = 20;
    this.tileCount = width / this.gridSize;

    this.particles = [];
    this.walls = [];
    this.score = 0;
    this.isGameOver = false;
    this.lastRenderTime = 0;
    this.animationId = null;

    this.scoreEl = document.getElementById("current-score");
    this.highScoreEl = document.getElementById("high-score");

    try {
      this.highScoreEl.innerText =
        localStorage.getItem("premiumSnakeHighScore") || 0;
    } catch (e) {}
    this.setupInputs();
  }

  init(characterType, mapType) {
    if (characterType === "speed") this.snake = new SpeedSnake(this.gridSize);
    else if (characterType === "phantom")
      this.snake = new PhantomSnake(this.gridSize);
    else this.snake = new BaseSnake(this.gridSize);

    this.currentSpeed = this.snake.baseSpeed;
    this.walls = [];
    if (mapType === "box") {
      for (let i = 4; i < 16; i++) {
        this.walls.push({ x: i, y: 4 });
        this.walls.push({ x: i, y: 15 });
      }
    }
    this.food = new Food(this.gridSize, this.tileCount);
    this.restart();
  }

  setupInputs() {
    document.addEventListener(
      "keydown",
      (e) => {
        if (
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(
            e.key,
          )
        ) {
          e.preventDefault();
        }
        if (!this.snake || this.isGameOver) return;

        if (["ArrowUp", "w"].includes(e.key)) this.snake.setDirection(0, -1);
        else if (["ArrowDown", "s"].includes(e.key))
          this.snake.setDirection(0, 1);
        else if (["ArrowLeft", "a"].includes(e.key))
          this.snake.setDirection(-1, 0);
        else if (["ArrowRight", "d"].includes(e.key))
          this.snake.setDirection(1, 0);
      },
      { passive: false },
    );

    let touchStartX = 0;
    let touchStartY = 0;
    document.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      },
      { passive: true },
    );

    document.addEventListener(
      "touchmove",
      (e) => {
        if (
          !document.getElementById("screen-game").classList.contains("hidden")
        ) {
          e.preventDefault();
        }
      },
      { passive: false },
    );

    document.addEventListener("touchend", (e) => {
      if (
        !this.snake ||
        this.isGameOver ||
        document.getElementById("screen-game").classList.contains("hidden")
      )
        return;
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
    this.food.respawn(this.snake.body, this.walls);
    this.particles = [];
    this.score = 0;
    this.isGameOver = false;
    this.currentSpeed = this.snake.baseSpeed;
    this.scoreEl.innerText = this.score;
    this.lastRenderTime = window.performance.now();

    document.getElementById("game-container").className = "game-container";
    document.getElementById("game-over-screen").classList.add("hidden");
    document.getElementById("game-over-screen").style.display = "none";

    if (this.animationId) window.cancelAnimationFrame(this.animationId);
    this.animationId = window.requestAnimationFrame((time) => this.loop(time));
  }

  drawWalls() {
    this.ctx.fillStyle = "rgba(0, 255, 204, 0.3)";
    this.walls.forEach((w) =>
      this.ctx.fillRect(
        w.x * this.gridSize,
        w.y * this.gridSize,
        this.gridSize,
        this.gridSize,
      ),
    );
  }

  checkCollisions() {
    const head = this.snake.body[0];
    if (
      head.x < 0 ||
      head.x >= this.tileCount ||
      head.y < 0 ||
      head.y >= this.tileCount
    )
      return true;
    for (let i = 1; i < this.snake.body.length; i++) {
      if (head.x === this.snake.body[i].x && head.y === this.snake.body[i].y)
        return true;
    }
    if (this.walls.some((w) => w.x === head.x && w.y === head.y)) return true;
    return false;
  }

  handleGameOver() {
    this.isGameOver = true;
    const container = document.getElementById("game-container");
    container.classList.add("shake", "glow-crash");

    try {
      let hs = localStorage.getItem("premiumSnakeHighScore") || 0;
      if (this.score > hs) {
        localStorage.setItem("premiumSnakeHighScore", this.score);
        this.highScoreEl.innerText = this.score;
      }
    } catch (e) {}

    document.getElementById("final-score-display").innerText =
      `SCORE: ${this.score}`;
    setTimeout(() => {
      const goScreen = document.getElementById("game-over-screen");
      goScreen.classList.remove("hidden");
      goScreen.style.display = "flex";
    }, 300);
  }

  loop(currentTime) {
    if (this.isGameOver) return;
    this.animationId = window.requestAnimationFrame((time) => this.loop(time));

    const secondsSinceLastRender = (currentTime - this.lastRenderTime) / 1000;
    if (secondsSinceLastRender < 1 / this.currentSpeed) return;
    this.lastRenderTime = currentTime;

    if (this.snake.dx !== 0 || this.snake.dy !== 0) {
      this.snake.update();
      const head = this.snake.body[0];
      if (head.x === this.food.x && head.y === this.food.y) {
        for (let i = 0; i < 20; i++)
          this.particles.push(
            new Particle(
              this.food.x * this.gridSize + 10,
              this.food.y * this.gridSize + 10,
              "#ff0055",
            ),
          );
        this.food.respawn(this.snake.body, this.walls);
        this.snake.tailLength++;
        this.score += 10 * this.snake.scoreMultiplier;
        this.scoreEl.innerText = this.score;
        if (this.score % 50 === 0) this.currentSpeed += 1;

        const c = document.getElementById("game-container");
        c.classList.add("glow-eat");
        setTimeout(() => c.classList.remove("glow-eat"), 200);
      }
      if (this.checkCollisions()) return this.handleGameOver();
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawWalls();
    this.food.draw(this.ctx);
    this.snake.draw(this.ctx);

    this.particles.forEach((p) => {
      p.update();
      p.draw(this.ctx);
    });
    this.particles = this.particles.filter((p) => p.life > 0);
  }
}

class AppManager {
  constructor() {
    this.screens = [
      "screen-menu",
      "screen-character",
      "screen-map",
      "screen-game",
    ];
    this.selectedCharacter = "neon";
    this.gameEngine = new GameEngine("gameCanvas");
  }

  setScreen(screenId) {
    this.screens.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        if (id === screenId) {
          el.classList.remove("hidden");
          el.style.display = "flex";
        } else {
          el.classList.add("hidden");
          el.style.display = "none";
        }
      }
    });
  }

  selectCharacter(char) {
    this.selectedCharacter = char;
    this.setScreen("screen-map");
  }

  startGame(mapType) {
    this.setScreen("screen-game");
    setTimeout(() => {
      this.gameEngine.init(this.selectedCharacter, mapType);
    }, 100);
  }

  restartGame() {
    this.gameEngine.restart();
  }
}

window.onload = () => {
  window.app = new AppManager();
};

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Tetris.css';
import tmusic from './tmusic.wav';

const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const BASE_INTERVAL = 500;
const SPEED_INCREMENT = 50;

const Tetris = () => {
  const [grid, setGrid] = useState(() => {
    console.log("Initializing grid");
    return Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(0));
  });
  const [currentPiece, setCurrentPiece] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const audioRef = useRef(new Audio(tmusic));

  const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[1, 1], [1, 1]], // O
    [[1, 1, 1], [0, 1, 0]], // T
    [[1, 1, 1], [1, 0, 0]], // L
    [[1, 1, 1], [0, 0, 1]]  // J
  ];

  const spawnPiece = useCallback(() => {
    console.log("Spawning piece");
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    return {
      shape,
      pos: { x: Math.floor(GRID_WIDTH / 2) - Math.floor(shape[0].length / 2), y: 0 },
      color: Math.floor(Math.random() * 5) + 1
    };
  }, [SHAPES]);

  const mergePiece = useCallback((gridCopy, piece) => {
    const newGrid = gridCopy.map(row => [...row]);
    piece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const newY = y + piece.pos.y;
          const newX = x + piece.pos.x;
          if (newX >= 0 && newX < GRID_WIDTH && newY >= 0 && newY < GRID_HEIGHT) {
            newGrid[newY][newX] = piece.color;
          }
        }
      });
    });
    return newGrid;
  }, [GRID_WIDTH, GRID_HEIGHT]);

  const checkCollision = useCallback((piece, grid, dx = 0, dy = 0) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = x + piece.pos.x + dx;
          const newY = y + piece.pos.y + dy;
          if (
            newX < 0 ||
            newX >= GRID_WIDTH ||
            newY >= GRID_HEIGHT ||
            (newY >= 0 && grid[newY][newX])
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }, [GRID_WIDTH, GRID_HEIGHT]);

  const clearLines = useCallback((grid) => {
    const newGrid = grid.filter(row => row.some(cell => cell === 0));
    const linesCleared = GRID_HEIGHT - newGrid.length;
    while (newGrid.length < GRID_HEIGHT) {
      newGrid.unshift(Array(GRID_WIDTH).fill(0));
    }
    if (linesCleared > 0) {
      setScore(prev => prev + linesCleared * 100);
    }
    return newGrid;
  }, [GRID_WIDTH, GRID_HEIGHT]);

  useEffect(() => {
    console.log("Audio useEffect running");
    const audio = audioRef.current;
    audio.loop = true;
    try {
      audio.play()
        .then(() => console.log("Audio started on mount"))
        .catch(error => {
          console.error("Initial audio play failed:", error);
          setAudioBlocked(true);
        });
    } catch (error) {
      console.error("Error in audio init:", error);
    }
    return () => {
      audio.pause();
    };
  }, []);

  useEffect(() => {
    console.log("Audio control useEffect running");
    const audio = audioRef.current;
    try {
      if (isPaused || gameOver) {
        audio.pause();
      } else {
        audio.play()
          .then(() => console.log("Audio playing"))
          .catch(error => console.error("Audio play failed:", error));
      }
    } catch (error) {
      console.error("Error in audio control:", error);
    }
  }, [isPaused, gameOver]);

  useEffect(() => {
    console.log("Game loop useEffect running");
    if (!currentPiece && !gameOver) {
      try {
        const newPiece = spawnPiece();
        if (checkCollision(newPiece, grid)) {
          setGameOver(true);
        } else {
          setCurrentPiece(newPiece);
        }
      } catch (error) {
        console.error("Error spawning piece:", error);
      }
    }

    if (!isPaused && !gameOver && currentPiece) {
      const speedLevel = Math.floor(score / 500);
      const interval = Math.max(BASE_INTERVAL - (speedLevel * SPEED_INCREMENT), 100);

      const timer = setInterval(() => {
        try {
          const newPiece = { ...currentPiece, pos: { ...currentPiece.pos, y: currentPiece.pos.y + 1 } };
          if (checkCollision(newPiece, grid)) {
            const newGrid = clearLines(mergePiece(grid, currentPiece));
            setGrid(newGrid);
            setCurrentPiece(null);
          } else {
            setCurrentPiece(newPiece);
          }
        } catch (error) {
          console.error("Error in game loop:", error);
          clearInterval(timer);
        }
      }, interval);

      return () => clearInterval(timer);
    }
  }, [currentPiece, gameOver, isPaused, grid, score, spawnPiece, checkCollision, mergePiece, clearLines]);

  const handleKeyPress = useCallback((e) => {
    if (!currentPiece || gameOver || isPaused) return;

    try {
      let newPiece = { ...currentPiece };

      switch (e.key) {
        case 'ArrowLeft':
          if (!checkCollision(newPiece, grid, -1, 0)) {
            newPiece.pos.x--;
          }
          break;
        case 'ArrowRight':
          if (!checkCollision(newPiece, grid, 1, 0)) {
            newPiece.pos.x++;
          }
          break;
        case 'ArrowDown':
          if (!checkCollision(newPiece, grid, 0, 1)) {
            newPiece.pos.y++;
          }
          break;
        case 'ArrowUp':
          const rotated = currentPiece.shape[0].map((_, i) =>
            currentPiece.shape.map(row => row[row.length - 1 - i])
          );
          const tempPiece = { ...newPiece, shape: rotated };
          const maxX = Math.max(...rotated.map(row => row.length)) + tempPiece.pos.x - 1;
          if (maxX >= GRID_WIDTH) tempPiece.pos.x -= (maxX - GRID_WIDTH + 1);
          if (tempPiece.pos.x < 0) tempPiece.pos.x = 0;

          if (!checkCollision(tempPiece, grid)) {
            newPiece = tempPiece;
          }
          break;
        default:
          return;
      }

      setCurrentPiece(newPiece);
    } catch (error) {
      console.error("Error handling key press:", error);
    }
  }, [currentPiece, gameOver, isPaused, grid, checkCollision, GRID_WIDTH]);

  useEffect(() => {
    console.log("Keypress useEffect running");
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const startNewGame = () => {
    console.log("Starting new game");
    try {
      setGrid(Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(0)));
      console.log("Grid set");
      setCurrentPiece(null);
      console.log("Current piece set to null");
      setGameOver(false);
      console.log("Game over set to false");
      setScore(0);
      console.log("Score set to 0");
      setIsPaused(false);
      console.log("Is paused set to false");
      const audio = audioRef.current;
      audio.currentTime = 0;
      audio.play()
        .then(() => {
          console.log("Audio started with new game");
          setAudioBlocked(false);
        })
        .catch(error => console.error("Audio play failed on new game:", error));
    } catch (error) {
      console.error("Error starting new game:", error);
    }
  };

  const startAudio = () => {
    console.log("Starting audio manually");
    try {
      const audio = audioRef.current;
      audio.play()
        .then(() => {
          console.log("Audio started manually");
          setAudioBlocked(false);
        })
        .catch(error => console.error("Manual audio play failed:", error));
    } catch (error) {
      console.error("Error starting audio:", error);
    }
  };

  const togglePause = () => {
    console.log("Toggling pause, current state:", isPaused);
    try {
      setIsPaused(prev => {
        console.log("Setting isPaused to:", !prev);
        return !prev;
      });
    } catch (error) {
      console.error("Error toggling pause:", error);
    }
  };

  const renderGrid = () => {
    console.log("Rendering grid");
    let displayGrid = grid.map(row => [...row]);
    if (currentPiece && !gameOver) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const newY = y + currentPiece.pos.y;
            const newX = x + currentPiece.pos.x;
            if (newX >= 0 && newX < GRID_WIDTH && newY >= 0 && newY < GRID_HEIGHT) {
              displayGrid[newY][newX] = currentPiece.color;
            }
          }
        });
      });
    }
    return displayGrid.map((row, y) => (
      <div key={y} className="row">
        {row.map((cell, x) => (
          <div key={`${y}-${x}`} className={`cell color-${cell}`} />
        ))}
      </div>
    ));
  };

  console.log("Tetris component rendering");
  return (
    <div className="tetris">
      <div className="logo">Tetris Clone</div>
      <div className="game-layout">
        <div className="game-container">
          <div className="score">Score: {score}</div>
          <div className="grid">{renderGrid()}</div>
          <div className="controls">
            <button onClick={togglePause}>
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={startNewGame}>New Game</button>
            {audioBlocked && (
              <button onClick={startAudio}>Start Audio</button>
            )}
          </div>
          {gameOver && <div className="game-over">Game Over!</div>}
        </div>
        <div className="instructions">
          <h3>Instructions</h3>
          <ul>
            <li>Arrow Left: Move left</li>
            <li>Arrow Right: Move right</li>
            <li>Arrow Down: Move down faster</li>
            <li>Arrow Up: Rotate piece</li>
            <li>Pause/Resume: Pause or resume game</li>
            <li>New Game: Start a new game</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Tetris;
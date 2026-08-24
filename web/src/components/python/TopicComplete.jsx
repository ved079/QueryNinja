import { useEffect, useRef } from 'react';

const TOPIC_MESSAGES = {
  'Variables & Types': {
    emoji: '🧠',
    headline: 'You speak Python now.',
    body: "Every piece of data in Python — numbers, text, booleans — you can now name, read, and describe. This is the bedrock. Everything you'll ever build starts right here.",
  },
  'Strings': {
    emoji: '✍️',
    headline: 'You can talk to your programs.',
    body: "Slicing, formatting, searching — you can now manipulate text like a pro. Almost every real app deals with words. You just unlocked that entire world.",
  },
  'Lists': {
    emoji: '📋',
    headline: "Lists: Python's #1 workhorse.",
    body: "You'll use lists in virtually every program you ever write. Collecting data, building results, looping over items — you can do all of it now.",
  },
  'Loops': {
    emoji: '🔁',
    headline: 'You made the computer work for you.',
    body: "Loops turn 100 lines of repeated code into 3. You just learned how to automate repetition — one of the most powerful things in programming.",
  },
  'Conditionals': {
    emoji: '🧭',
    headline: 'Your code can make decisions.',
    body: "if/elif/else is the foundation of all logic. Every app — from a weather widget to a self-driving car — makes decisions the same way you just learned.",
  },
  'Functions': {
    emoji: '🧩',
    headline: 'You can build reusable tools.',
    body: "Functions are how real software is built. Write it once, use it everywhere. You just made the leap from writing scripts to writing programs.",
  },
  'Dicts & Sets': {
    emoji: '🗺️',
    headline: 'Stage 1 complete. You know Python.',
    body: "Variables, strings, lists, loops, conditions, functions, dicts — that's the complete foundation. Most real Python code is just these 7 things combined. Stage 2 awaits.",
  },
};

function Confetti({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const colors = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa', '#34d399'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: 8 + Math.random() * 8,
      h: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
      vy: 2 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 2,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotSpeed;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();

    const stop = setTimeout(() => cancelAnimationFrame(raf), 4000);
    return () => { cancelAnimationFrame(raf); clearTimeout(stop); };
  }, [canvasRef]);
  return null;
}

export default function TopicComplete({ topic, onClose, onNext }) {
  const canvasRef = useRef(null);
  const msg = TOPIC_MESSAGES[topic] ?? {
    emoji: '🎉',
    headline: `${topic} — done!`,
    body: 'Great work. Keep going.',
  };

  return (
    <div className="topic-complete-overlay" onClick={onClose}>
      <canvas ref={canvasRef} className="confetti-canvas" />
      <div className="topic-complete-card" onClick={(e) => e.stopPropagation()}>
        <Confetti canvasRef={canvasRef} />
        <div className="tc-emoji">{msg.emoji}</div>
        <h2 className="tc-headline">{msg.headline}</h2>
        <p className="tc-body">{msg.body}</p>
        <div className="tc-actions">
          <button className="primary" onClick={onNext ?? onClose}>
            {onNext ? 'Next Problem →' : 'Keep Going →'}
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

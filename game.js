import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';

// Farcaster SDK başlat
sdk.actions.ready();

// Default segments - Crypto theme
const defaultSegments = [
    { name: 'Bitcoin', color: '#f7931a', gradient: '#ffb347', icon: 'btc' },
    { name: 'Ethereum', color: '#627eea', gradient: '#9c88ff', icon: 'eth' },
    { name: 'USDC', color: '#2775ca', gradient: '#74b9ff', icon: 'usdc' },
    { name: 'Toshi', color: '#0052ff', gradient: '#5f9fff', icon: 'toshi' },
    { name: 'Nothing', color: '#2d1b4e', gradient: '#4a3f6b', icon: 'x' }
];

// State - Always use default segments (no customization)
let segments = defaultSegments;
let spinsLeft = getSpinsLeft();
let totalSpins = parseInt(localStorage.getItem('totalSpins')) || 0;
let isSpinning = false;
let currentRotation = 0;
let soundEnabled = true;

// DOM Elements
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const spinsCountEl = document.getElementById('spinsCount');
const totalSpinsEl = document.getElementById('totalSpins');
const resultPopup = document.getElementById('resultPopup');
const resultText = document.getElementById('resultText');
const closePopup = document.getElementById('closePopup');
const wheelWrapper = document.getElementById('wheelWrapper');
const soundBtn = document.getElementById('soundBtn');

// Diamonds
const diamonds = [
    document.getElementById('d1'),
    document.getElementById('d2'),
    document.getElementById('d3'),
    document.getElementById('d4'),
    document.getElementById('d5')
];

// Daily spin check
function getSpinsLeft() {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('spinDate');
    const savedSpins = localStorage.getItem('spinsLeft');
    
    if (savedDate !== today) {
        localStorage.setItem('spinDate', today);
        localStorage.setItem('spinsLeft', '5');
        return 5;
    }
    
    return parseInt(savedSpins) || 0;
}

function updateSpinsLeft() {
    spinsLeft = Math.max(0, spinsLeft - 1);
    localStorage.setItem('spinsLeft', spinsLeft.toString());
    spinsCountEl.textContent = spinsLeft;
    
    // Update total spins
    totalSpins++;
    localStorage.setItem('totalSpins', totalSpins.toString());
    totalSpinsEl.textContent = totalSpins;
    
    // Update diamonds
    updateDiamonds();
    
    if (spinsLeft === 0) {
        spinBtn.disabled = true;
        spinBtn.textContent = 'COME BACK TOMORROW';
    }
}

function updateDiamonds() {
    diamonds.forEach((d, i) => {
        if (i < spinsLeft) {
            d.classList.add('active');
        } else {
            d.classList.remove('active');
        }
    });
}

// Draw custom icon
function drawIcon(ctx, icon, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    
    const s = size;
    
    switch(icon) {
        case 'btc':
            // Bitcoin - Orange coin with B
            ctx.beginPath();
            ctx.arc(0, 0, s, 0, 2 * Math.PI);
            ctx.fillStyle = '#f7931a';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // B letter
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${s * 1.2}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('₿', 0, 0);
            break;
            
        case 'eth':
            // Ethereum - Diamond shape
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.lineTo(s * 0.7, 0);
            ctx.lineTo(0, s);
            ctx.lineTo(-s * 0.7, 0);
            ctx.closePath();
            ctx.fillStyle = '#627eea';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Inner diamond
            ctx.beginPath();
            ctx.moveTo(0, -s * 0.5);
            ctx.lineTo(s * 0.35, 0);
            ctx.lineTo(0, s * 0.5);
            ctx.lineTo(-s * 0.35, 0);
            ctx.closePath();
            ctx.fillStyle = '#8c9eff';
            ctx.fill();
            break;
            
        case 'usdc':
            // USDC - Blue coin with $
            ctx.beginPath();
            ctx.arc(0, 0, s, 0, 2 * Math.PI);
            ctx.fillStyle = '#2775ca';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // $ symbol
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${s * 1.3}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 0);
            break;
            
        case 'toshi':
            // Toshi - Blue circle with T
            ctx.beginPath();
            ctx.arc(0, 0, s, 0, 2 * Math.PI);
            ctx.fillStyle = '#0052ff';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // T letter
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${s * 1.2}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('T', 0, 0);
            break;
            
        case 'x':
            // X - Red X mark
            ctx.beginPath();
            ctx.arc(0, 0, s, 0, 2 * Math.PI);
            ctx.fillStyle = '#4a3f6b';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // X mark
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-s * 0.5, -s * 0.5);
            ctx.lineTo(s * 0.5, s * 0.5);
            ctx.moveTo(s * 0.5, -s * 0.5);
            ctx.lineTo(-s * 0.5, s * 0.5);
            ctx.stroke();
            break;
    }
    
    ctx.restore();
}

// Draw wheel
function drawWheel(rotation = 0) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 12;
    const segmentAngle = (2 * Math.PI) / segments.length;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.translate(-centerX, -centerY);
    
    // Draw segments
    segments.forEach((segment, i) => {
        const startAngle = i * segmentAngle - Math.PI / 2;
        const endAngle = startAngle + segmentAngle;
        const midAngle = startAngle + segmentAngle / 2;
        
        // Create gradient for segment
        const gradient = ctx.createLinearGradient(
            centerX + Math.cos(midAngle) * radius,
            centerY + Math.sin(midAngle) * radius,
            centerX,
            centerY
        );
        gradient.addColorStop(0, segment.color);
        gradient.addColorStop(1, segment.gradient);
        
        // Segment
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Segment border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw icon
        const iconX = centerX + Math.cos(midAngle) * radius * 0.6;
        const iconY = centerY + Math.sin(midAngle) * radius * 0.6;
        drawIcon(ctx, segment.icon, iconX, iconY, 18);
    });
    
    // Outer metallic ring
    const ringGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    ringGradient.addColorStop(0, '#c084fc');
    ringGradient.addColorStop(0.3, '#e0b0ff');
    ringGradient.addColorStop(0.5, '#9333ea');
    ringGradient.addColorStop(0.7, '#e0b0ff');
    ringGradient.addColorStop(1, '#7c3aed');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
    ctx.strokeStyle = ringGradient;
    ctx.lineWidth = 12;
    ctx.stroke();
    
    // Ring highlight
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 13, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Ring inner edge
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
}

// Sound effects
function playTickSound() {
    if (!soundEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 500 + Math.random() * 300;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.06;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.03);
        oscillator.stop(audioCtx.currentTime + 0.03);
    } catch (e) {}
}

function playWinSound() {
    if (!soundEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99, 1046.50];
        
        notes.forEach((freq, i) => {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.frequency.value = freq;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            
            oscillator.start(audioCtx.currentTime + i * 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.1 + 0.2);
            oscillator.stop(audioCtx.currentTime + i * 0.1 + 0.2);
        });
    } catch (e) {}
}

// Vibration
function vibrate(pattern = [50]) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

// Confetti effect
function createConfetti() {
    const colors = ['#a855f7', '#7c3aed', '#c084fc', '#8b5cf6', '#f472b6', '#fbbf24'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.width = (5 + Math.random() * 10) + 'px';
        confetti.style.height = confetti.style.width;
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        document.body.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 4000);
    }
}

// Spin the wheel
function spinWheel() {
    if (isSpinning || spinsLeft <= 0) return;
    
    isSpinning = true;
    spinBtn.disabled = true;
    wheelWrapper.classList.add('spinning');
    
    // Random target angle
    const spins = 4 + Math.random() * 3;
    const targetAngle = spins * 2 * Math.PI + Math.random() * 2 * Math.PI;
    const duration = 4000 + Math.random() * 2000;
    
    const startTime = Date.now();
    const startRotation = currentRotation;
    let lastTickAngle = 0;
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        
        currentRotation = startRotation + targetAngle * easeProgress;
        drawWheel(currentRotation);
        
        // Tick sound
        const segmentAngle = (2 * Math.PI) / segments.length;
        const currentSegmentAngle = currentRotation % (2 * Math.PI);
        if (Math.floor(currentSegmentAngle / segmentAngle) !== Math.floor(lastTickAngle / segmentAngle)) {
            if (progress < 0.85) {
                playTickSound();
                vibrate([5]);
            }
        }
        lastTickAngle = currentSegmentAngle;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            finishSpin();
        }
    }
    
    animate();
}

function finishSpin() {
    isSpinning = false;
    wheelWrapper.classList.remove('spinning');
    
    // Find winning segment
    const segmentAngle = (2 * Math.PI) / segments.length;
    
    // Normalize rotation to 0-2π range
    let normalizedRotation = currentRotation % (2 * Math.PI);
    if (normalizedRotation < 0) normalizedRotation += 2 * Math.PI;
    
    // The pointer is at the top (12 o'clock position)
    // Segments are drawn starting from -π/2 (top) going clockwise
    // When wheel rotates, we need to find which segment is at the top
    
    // Calculate the angle at the pointer position
    // The wheel rotates clockwise, so we subtract the rotation
    let pointerAngle = (2 * Math.PI - normalizedRotation) % (2 * Math.PI);
    
    // Find which segment this angle falls into
    const winningIndex = Math.floor(pointerAngle / segmentAngle) % segments.length;
    const winner = segments[winningIndex];
    
    // Effects
    vibrate([100, 50, 100, 50, 100]);
    playWinSound();
    createConfetti();
    
    // Show result
    const isLoss = winner.icon === 'x' || winner.name === 'Nothing';
    
    // Update popup based on result
    const popupEmoji = document.querySelector('.popup-emoji');
    const popupTitle = document.querySelector('.popup-content h2');
    
    if (isLoss) {
        popupEmoji.textContent = '🍀';
        popupTitle.textContent = 'Unfortunately!';
        resultText.innerHTML = `Better luck next time!`;
    } else {
        popupEmoji.textContent = '🎉';
        popupTitle.textContent = 'Congratulations!';
        resultText.innerHTML = `You won: <strong>${winner.name}</strong>`;
    }
    
    resultPopup.classList.remove('hidden');
    
    // Update spins
    updateSpinsLeft();
    
    if (spinsLeft > 0) {
        spinBtn.disabled = false;
    }
}


// Create favicon
function createFavicon() {
    const faviconCanvas = document.createElement('canvas');
    faviconCanvas.width = 32;
    faviconCanvas.height = 32;
    const ctx = faviconCanvas.getContext('2d');
    
    const center = 16;
    const radius = 14;
    const segmentAngle = (2 * Math.PI) / segments.length;
    
    segments.forEach((segment, i) => {
        const startAngle = i * segmentAngle - Math.PI / 2;
        const endAngle = startAngle + segmentAngle;
        
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = segment.color;
        ctx.fill();
    });
    
    ctx.beginPath();
    ctx.arc(center, center, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a0a2e';
    ctx.fill();
    
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center - 4, 6);
    ctx.lineTo(center + 4, 6);
    ctx.closePath();
    ctx.fill();
    
    document.getElementById('favicon').href = faviconCanvas.toDataURL('image/png');
}

// Event Listeners
spinBtn.addEventListener('click', spinWheel);
spinBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    spinWheel();
}, { passive: false });

closePopup.addEventListener('click', () => {
    resultPopup.classList.add('hidden');
});


resultPopup.addEventListener('click', (e) => {
    if (e.target === resultPopup) {
        resultPopup.classList.add('hidden');
    }
});

// Sound toggle
soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.querySelector('.nav-icon').textContent = soundEnabled ? '🔊' : '🔇';
});

// Initialize
createFavicon();
spinsCountEl.textContent = spinsLeft;
totalSpinsEl.textContent = totalSpins;
updateDiamonds();

if (spinsLeft === 0) {
    spinBtn.disabled = true;
    spinBtn.textContent = 'COME BACK TOMORROW';
}

drawWheel();

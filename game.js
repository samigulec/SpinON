import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';

// Farcaster SDK başlat
sdk.actions.ready();

// Default segments - Crypto theme with images
const defaultSegments = [
    { name: 'Bitcoin', color: '#7c3aed', gradient: '#a855f7', img: 'cbbtc.png' },
    { name: 'Ethereum', color: '#8b5cf6', gradient: '#c084fc', img: 'cbeth.png' },
    { name: 'USDC', color: '#6d28d9', gradient: '#8b5cf6', img: 'usdc.png' },
    { name: 'Toshi', color: '#7c3aed', gradient: '#a855f7', img: 'toshi.png' },
    { name: 'Nothing', color: '#5b21b6', gradient: '#7c3aed', img: null }
];

// Preload images
const images = {};
let imagesLoaded = 0;

defaultSegments.forEach(segment => {
    if (segment.img) {
        const img = new Image();
        img.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === defaultSegments.filter(s => s.img).length) {
                drawWheel();
            }
        };
        img.src = segment.img;
        images[segment.img] = img;
    }
});

// State - Always use default segments (no customization)
let segments = defaultSegments;
let totalSpins = parseInt(localStorage.getItem('totalSpins')) || 0;
let isSpinning = false;
let currentRotation = 0;
let soundEnabled = true;
let winStreak = 0;
let lossStreak = 0;

// DOM Elements
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
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

// Update diamonds based on spin result
function updateDiamonds() {
    diamonds.forEach(d => d.classList.remove('active'));
    const activeDiamond = Math.floor(Math.random() * diamonds.length);
    diamonds[activeDiamond].classList.add('active');
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
        ctx.strokeStyle = 'rgba(233, 213, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw image or X
        const iconX = centerX + Math.cos(midAngle) * radius * 0.6;
        const iconY = centerY + Math.sin(midAngle) * radius * 0.6;
        const iconSize = 36;
        
        if (segment.img && images[segment.img]) {
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.rotate(midAngle + Math.PI / 2);
            ctx.drawImage(images[segment.img], -iconSize/2, -iconSize/2, iconSize, iconSize);
            ctx.restore();
        } else if (!segment.img) {
            // Draw X for Nothing
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.strokeStyle = '#e9d5ff';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-10, -10);
            ctx.lineTo(10, 10);
            ctx.moveTo(10, -10);
            ctx.lineTo(-10, 10);
            ctx.stroke();
            ctx.restore();
        }
    });
    
    // Outer metallic ring
    const ringGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    ringGradient.addColorStop(0, '#c084fc');
    ringGradient.addColorStop(0.3, '#e9d5ff');
    ringGradient.addColorStop(0.5, '#a855f7');
    ringGradient.addColorStop(0.7, '#e9d5ff');
    ringGradient.addColorStop(1, '#c084fc');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
    ctx.strokeStyle = ringGradient;
    ctx.lineWidth = 12;
    ctx.stroke();
    
    // Ring highlight
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 13, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(233, 213, 255, 0.5)';
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
    const colors = ['#e9d5ff', '#c084fc', '#a855f7', '#8b5cf6', '#d8b4fe', '#f3e8ff'];
    
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
    if (isSpinning) return;

    isSpinning = true;
    wheelWrapper.classList.add('spinning');

    // Add sparkle effect
    createSparkles();
    
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

    // Update total spins
    totalSpins++;
    localStorage.setItem('totalSpins', totalSpins.toString());
    totalSpinsEl.textContent = totalSpins;

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
    const isLoss = winner.img === null || winner.name === 'Nothing';
    
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

    // Update diamonds animation
    updateDiamonds();
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

// Sparkle effect when spinning
function createSparkles() {
    for (let i = 0; i < 12; i++) {
        const sparkle = document.createElement('div');
        sparkle.style.position = 'fixed';
        sparkle.style.width = '6px';
        sparkle.style.height = '6px';
        sparkle.style.borderRadius = '50%';
        sparkle.style.background = ['#e9d5ff', '#c084fc', '#a855f7'][Math.floor(Math.random() * 3)];
        sparkle.style.pointerEvents = 'none';
        sparkle.style.zIndex = '200';

        const rect = wheelWrapper.getBoundingClientRect();
        const angle = (i / 12) * Math.PI * 2;
        const radius = 170;
        sparkle.style.left = (rect.left + rect.width / 2 + Math.cos(angle) * radius) + 'px';
        sparkle.style.top = (rect.top + rect.height / 2 + Math.sin(angle) * radius) + 'px';

        document.body.appendChild(sparkle);

        sparkle.animate([
            { transform: 'scale(0) translateY(0)', opacity: 1 },
            { transform: `scale(1) translateY(-30px)`, opacity: 0 }
        ], {
            duration: 800,
            easing: 'ease-out'
        }).onfinish = () => sparkle.remove();
    }
}

// Event Listeners
wheelWrapper.addEventListener('click', spinWheel);
wheelWrapper.addEventListener('touchstart', (e) => {
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

// Ad Banner System
const ads = [
    {
        image: 'superboard.png',
        title: 'Superboard',
        desc: 'Meet the new OnchainGM campaign!',
        cta: 'Join Now',
        link: 'https://superboard.xyz/campaigns/meet-the-new-onchaingm'
    },
    {
        image: 'onchaingm.png',
        title: 'OnchainGM',
        desc: 'Your Daily Web3 Ritual. GM every day!',
        cta: 'Say GM',
        link: 'https://onchaingm.com/'
    },
    {
        image: 'infinityname.jpg',
        title: 'Infinity Name',
        desc: 'Get your unique Web3 domain name!',
        cta: 'Get Yours',
        link: 'https://infinityname.com'
    }
];

let currentAdIndex = 0;
let adBannerVisible = true;
let adRotationInterval;

const adBanner = document.getElementById('adBanner');
const adImage = document.getElementById('adImage');
const adTitle = document.getElementById('adTitle');
const adDesc = document.getElementById('adDesc');
const adCta = document.getElementById('adCta');
const adLink = document.getElementById('adLink');
const adClose = document.getElementById('adClose');
const adDots = document.querySelectorAll('.ad-dot');

function showAd(index) {
    currentAdIndex = index;
    const ad = ads[index];
    adImage.src = ad.image;
    adTitle.textContent = ad.title;
    adDesc.textContent = ad.desc;
    adCta.textContent = ad.cta;
    adLink.href = ad.link;
    adBanner.classList.add('show');
    
    // Update dots
    adDots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function rotateAds() {
    if (!adBannerVisible) return;
    currentAdIndex = (currentAdIndex + 1) % ads.length;
    showAd(currentAdIndex);
}

// Dot click handlers
adDots.forEach(dot => {
    dot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(dot.dataset.index);
        showAd(index);
        
        // Reset rotation timer
        clearInterval(adRotationInterval);
        adRotationInterval = setInterval(rotateAds, 10000);
    });
});

// Start ad rotation
setTimeout(() => {
    showAd(0);
    adRotationInterval = setInterval(rotateAds, 10000); // Rotate every 10 seconds
}, 3000); // Show first ad after 3 seconds

adClose.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    adBanner.classList.remove('show');
    adBannerVisible = false;
    clearInterval(adRotationInterval);
});

// Initialize
createFavicon();
totalSpinsEl.textContent = totalSpins;
updateDiamonds();

drawWheel();

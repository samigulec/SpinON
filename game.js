import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';

// Farcaster SDK başlat
sdk.actions.ready();

// Default segments - Crypto theme with images
const defaultSegments = [
    { name: 'Bitcoin', color: '#0052FF', gradient: '#4285F4', img: 'cbbtc.png' },
    { name: 'Ethereum', color: '#0066FF', gradient: '#A8C7FA', img: 'cbeth.png' },
    { name: 'USDC', color: '#001845', gradient: '#0066FF', img: 'usdc.png' },
    { name: 'Toshi', color: '#0052FF', gradient: '#4285F4', img: 'toshi.png' },
    { name: 'Nothing', color: '#001233', gradient: '#0052FF', img: null }
];

// Preload images
const images = {};
let imagesLoaded = 0;
let allImagesLoaded = false;

function preloadImages() {
    defaultSegments.forEach(segment => {
        if (segment.img) {
            const img = new Image();
            img.onload = () => {
                imagesLoaded++;
                checkAllImagesLoaded();
            };
            img.onerror = () => {
                imagesLoaded++;
                checkAllImagesLoaded();
            };
            img.src = segment.img;
            images[segment.img] = img;
        }
    });
}

function checkAllImagesLoaded() {
    if (imagesLoaded === defaultSegments.filter(s => s.img).length) {
        allImagesLoaded = true;
        if (ctx) {
            drawWheel();
        }
    }
}

preloadImages();

// Note: drawWheel will be called from init() after DOM is ready

// State - Always use default segments (no customization)
let segments = defaultSegments;
let totalSpins = parseInt(localStorage.getItem('totalSpins')) || 0;
let isSpinning = false;
let currentRotation = 0;
let soundEnabled = true;
let winStreak = 0;
let lossStreak = 0;

// DOM Elements - wait for DOM to be ready
let canvas, ctx, totalSpinsEl, resultPopup, resultText, closePopup, wheelWrapper, soundBtn;

function initializeDOM() {
    canvas = document.getElementById('wheelCanvas');
    ctx = canvas?.getContext('2d');
    totalSpinsEl = document.getElementById('totalSpins');
    resultPopup = document.getElementById('resultPopup');
    resultText = document.getElementById('resultText');
    closePopup = document.getElementById('closePopup');
    wheelWrapper = document.getElementById('wheelWrapper');
    soundBtn = document.getElementById('soundBtn');

    if (!canvas || !ctx) {
        console.error('Canvas not found');
        return false;
    }
    return true;
}

// Base logo animation
const baseLogoBox = document.querySelector('.base-logo-box');

function animateBaseLogo() {
    if (!baseLogoBox) return;
    baseLogoBox.style.transform = 'scale(1.2)';
    baseLogoBox.style.borderColor = '#4285F4';
    baseLogoBox.style.boxShadow = '0 0 30px rgba(66, 133, 244, 0.8)';
    setTimeout(() => {
        baseLogoBox.style.transform = '';
        baseLogoBox.style.borderColor = '';
        baseLogoBox.style.boxShadow = '';
    }, 500);
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
        ctx.strokeStyle = 'rgba(168, 199, 250, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw image or X
        const iconX = centerX + Math.cos(midAngle) * radius * 0.6;
        const iconY = centerY + Math.sin(midAngle) * radius * 0.6;
        const iconSize = 36;
        
        const img = segment.img ? images[segment.img] : null;
        const isImageValid = img && img.complete && img.naturalWidth > 0;

        if (isImageValid) {
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.rotate(midAngle + Math.PI / 2);
            ctx.drawImage(img, -iconSize/2, -iconSize/2, iconSize, iconSize);
            ctx.restore();
        } else if (segment.img) {
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.font = 'bold 14px SF Pro Display, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.rotate(midAngle + Math.PI / 2);
            ctx.fillText(segment.name.substring(0, 3).toUpperCase(), 0, 0);
            ctx.restore();
        } else if (!segment.img) {
            // Draw X for Nothing
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.strokeStyle = '#A8C7FA';
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
    ringGradient.addColorStop(0, '#4285F4');
    ringGradient.addColorStop(0.3, '#A8C7FA');
    ringGradient.addColorStop(0.5, '#0066FF');
    ringGradient.addColorStop(0.7, '#A8C7FA');
    ringGradient.addColorStop(1, '#4285F4');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
    ctx.strokeStyle = ringGradient;
    ctx.lineWidth = 12;
    ctx.stroke();
    
    // Ring highlight
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 13, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(168, 199, 250, 0.5)';
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
    const colors = ['#A8C7FA', '#4285F4', '#0066FF', '#0052FF', '#BCD4F8', '#E3F2FD'];
    
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

    // Animate base logo
    animateBaseLogo();
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
    ctx.fillStyle = '#001233';
    ctx.fill();

    ctx.fillStyle = '#4285F4';
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
        sparkle.style.background = ['#A8C7FA', '#4285F4', '#0066FF'][Math.floor(Math.random() * 3)];
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

// Event Listeners will be set up in init function

// Pano Banner System
const panoAds = [
    {
        image: 'onchaingm.png',
        title: 'Your Daily Web3 Ritual. GM every day!',
        cta: 'Say GM',
        link: 'https://farcaster.xyz/miniapps/WJydZUDypPkb/onchaingm'
    },
    {
        image: 'infinityname.jpg',
        title: 'Get your unique Web3 domain name!',
        cta: 'Get Yours',
        link: 'https://farcaster.xyz/miniapps/v7M5NCzIgbDZ/infinityname'
    },
   {
        image: 'superboard.png',
        title: 'Meet the new OnChainGM',
        cta: 'Join Now',
        link: 'https://superboard.xyz/campaigns/meet-the-new-onchaingm'
    }
];

let currentPanoIndex = 0;
let panoBannerVisible = true;
let panoRotationInterval;
let panoBanner, panoLink, panoClose, panoDots, panoImage, panoTitle, panoCta;

function showPano(index) {
    if (!panoBannerVisible || !panoBanner) return;

    currentPanoIndex = index;
    const ad = panoAds[index];

    panoImage.src = ad.image;
    panoTitle.textContent = ad.title;
    panoCta.textContent = ad.cta;
    panoLink.href = ad.link;

    panoDots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function rotatePano() {
    if (!panoBannerVisible) return;
    currentPanoIndex = (currentPanoIndex + 1) % panoAds.length;
    showPano(currentPanoIndex);
}

function openPanoLink() {
    const url = panoAds[currentPanoIndex].link;
    try {
        sdk.actions.openUrl(url);
    } catch (err) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

function initializePano() {
    panoBanner = document.getElementById('adBanner');
    panoLink = document.getElementById('adLink');
    panoClose = document.getElementById('adClose');
    panoImage = document.getElementById('adImage');
    panoTitle = document.getElementById('adTitle');
    panoCta = document.getElementById('adCta');
    panoDots = document.querySelectorAll('.pano-dot');

    if (!panoBanner) return;

    panoDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(dot.dataset.index);
            showPano(index);
            clearInterval(panoRotationInterval);
            panoRotationInterval = setInterval(rotatePano, 8000);
        });
    });

    const handleAdClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPanoLink();
    };

    panoLink.addEventListener('click', handleAdClick);
    panoLink.addEventListener('touchend', handleAdClick, { passive: false });

    panoImage.addEventListener('click', handleAdClick);
    panoImage.addEventListener('touchend', handleAdClick, { passive: false });

    panoCta.addEventListener('click', handleAdClick);
    panoCta.addEventListener('touchend', handleAdClick, { passive: false });

    panoTitle.addEventListener('click', handleAdClick);
    panoTitle.addEventListener('touchend', handleAdClick, { passive: false });

    panoClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panoBanner.classList.remove('show');
        panoBannerVisible = false;
        clearInterval(panoRotationInterval);
    });

    setTimeout(() => {
        showPano(0);
        panoBanner.classList.add('show');
        panoRotationInterval = setInterval(rotatePano, 8000);
    }, 1500);
}

// Initialize
function init() {
    if (!initializeDOM()) {
        setTimeout(init, 100);
        return;
    }

    createFavicon();
    totalSpinsEl.textContent = totalSpins;

    // Setup event listeners
    wheelWrapper.addEventListener('click', (e) => {
        e.preventDefault();
        spinWheel();
    });
    wheelWrapper.addEventListener('touchend', (e) => {
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
    soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundBtn.querySelector('.nav-icon').textContent = soundEnabled ? '🔊' : '🔇';
        vibrate([30]);
    });

    // Draw wheel immediately
    drawWheel();

    // Redraw when images finish loading
    setTimeout(() => {
        drawWheel();
    }, 1000);

    // Base logo link handler
    const baseLogoLink = document.getElementById('baseLogoLink');
    if (baseLogoLink) {
        baseLogoLink.addEventListener('click', (e) => {
            e.preventDefault();
            const url = 'https://base.org';
            try {
                sdk.actions.openUrl(url);
            } catch (err) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        });
    }

    // Initialize pano
    initializePano();
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
